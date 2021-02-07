const MySQL = require('./mysql');
const mysql = new MySQL();
const { genUnique64, generateAPIKEY } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError } = require('../util/errorhandler');

module.exports = class UserService {
    constructor() {

    }

    async findUser(user, db) {
        try {
            db = db || await mysql.db();
            let response;
            if (user.id) {
                response = await db.sql('select * from person where id = ?', [user.id]);
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
                throw new GeneralError('E_PERSON_NOTFOUND', user);
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
            user.id = { toSqlString: () => genUnique64() }
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