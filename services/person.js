const MySQL = require('./mysql');
const mysql = new MySQL();
const { genUnique64string, generateAPIKEY } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError } = require('../util/errorhandler');
const gh = require('./github');
// const gh = GitHub;
const credutil = require('../util/credentials');

module.exports = class UserService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
    }

    async findUser(user, db) {
        try {
            db = db || await mysql.db();
            let response;
            if (user.id) {
                response = await db.sql('select * from person where id = ?', [user.id]);
            }
            else if (user.displayname) {
                response = await db.sql('select * from person where LOWER(displayname) = ?', [user.displayname.toLowerCase()]);
            }
            else if (user.email) {
                response = await db.sql('select * from person where email = ?', [user.email]);
            }
            else if (user.apikey) {
                response = await db.sql('select * from person where apikey = ?', [user.apikey]);
            }
            else {
                throw new GeneralError('E_PERSON_MISSINGINFO', user);
            }

            if (response && response.results.length == 0) {
                return null;
            } else {
                user = response.results[0];
            }

            return user;
        }
        catch (e) {
            //console.error(e);
            throw e;
        }
    }

    async findOrCreateUser(user, session) {

        try {
            let db = await mysql.begin('findOrCreateUser');

            try {
                let existingUser = await this.findUser(user, db);
                if (('github' in user) && existingUser.github != user.github) {
                    user.id = existingUser.id;
                    user.isdev = true;
                    user = await this.updateUser(user, db);
                    user = Object.assign({}, existingUser, user)

                    let org = 'fivesecondgames';
                    let name = user.github;
                    let maintainers = ['5SG'];

                    let result = await gh.teams.create({ org, name, maintainers })
                    console.log(result);
                }
                else {
                    user = existingUser;
                }
            }
            catch (e) {
                user = await this.createUser(user, db);
            }

            await mysql.end('findOrCreateUser');
            //console.log(user);
            return user;
        }
        catch (e) {
            //console.error(e);
            await mysql.end('findOrCreateUser');
            throw e;
        }
    }

    async createDisplayName(user, db) {
        try {
            db = db || await mysql.db();

            user.displayname = user.displayname.replace(/[^A-Za-z0-9\_]/ig, "");
            let updatedUser = { displayname: user.displayname }
            let existingUser = await this.findUser(updatedUser, db);

            if (existingUser) {
                throw new GeneralError("E_PERSON_DUPENAME", updatedUser);
            }
            let { results } = await db.update('person', user, 'WHERE id = ?', [user.id]);
            console.log(results);
            if (results.affectedRows == 0)
                throw new GeneralError('E_PERSON_UPDATEFAILED', user);
            return user;
        }
        catch (e) {
            if (e.errno == 1062) {
                throw new GeneralError("E_PERSON_DUPENAME", user);
            }

            throw e;
        }
    }

    async updateUser(user, db) {
        try {
            db = db || await mysql.db();
            let { results } = await db.update('person', user, 'WHERE id = ?', [user.id]);
            console.log(results);
            if (results.affectedRows == 0)
                throw new GeneralError('E_PERSON_UPDATEFAILED', user);
            return user;
        }
        catch (e) {
            if (e.errno == 1062) {
                throw new GeneralError("E_PERSON_DUPENAME", user);
            }

            throw e;
        }
    }

    async createUser(user, db) {
        try {
            db = db || await mysql.db();
            let newid = genUnique64string({
                datacenter: this.credentials.datacenter.index || 0,
                worker: this.credentials.datacenter.worker || 0
            });
            user.id = { toSqlString: () => newid }
            //user.email = email;

            user.apikey = generateAPIKEY();
            // user.displayname = user.id;

            user.isdev = ('github' in user);
            user.tsapikey = utcDATETIME();



            let { results } = await db.insert('person', user);
            console.log(results);
            if (results.affectedRows == 0)
                throw new GeneralError('E_PERSON_CREATEFAILED', user);
            return user;
        }
        catch (e) {
            throw e;
        }
    }
}