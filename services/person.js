const MySQL = require('./mysql');
const mysql = new MySQL();
const { genUnique64, generateAPIKEY } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');

module.exports = class UserService {
    constructor() {

    }

    async findOrCreateUser(user) {


        try {
            let db = await mysql.begin('findOrCreateUser');
            let response;
            if (user.email) {
                response = await db.sql('select * from person where email = ?', [user.email]);
            }
            else {
                throw { code: "E_USER_NOTFOUND", payload: user };
            }

            if (response.results.length == 0)
                user = await this.createUser(user, db);
            else {
                let existingUser = response.results[0];
                if (('github' in user) && existingUser.github != user.github) {
                    user.id = existingUser.id;
                    user.isdev = true;
                    user = await this.updateUser(user, db);
                }
                else {
                    user = response.results[0];
                }
            }

            //console.log(user);
        }
        catch (e) {
            console.error(e);
        }
        finally {
            await mysql.end('findOrCreateUser');
        }

        return user;
    }
    async updateUser(user, db) {
        try {
            db = db || await mysql.db();
            let { results } = await db.update('person', user, 'WHERE id = ?', [user.id]);
            console.log(results);
            if (results.affectedRows > 0)
                return user;
        }
        catch (e) {
            throw e;
        }
        return null;
    }

    async createUser(user, db) {
        try {
            db = db || await mysql.db();
            user.id = { toSqlString: () => genUnique64() }
            //user.email = email;

            user.apikey = generateAPIKEY();
            user.displayname = user.apikey;

            user.isdev = ('github' in user);
            user.tsapikey = utcDATETIME();


            let { results } = await db.insert('person', user);
            console.log(results);
            if (results.affectedRows > 0)
                return user;
        }
        catch (e) {
            throw e;
        }
        return null;
    }
}