const MySQL = require('./mysql');
const mysql = new MySQL();
const { genUnique64, generateAPIKEY } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');

module.exports = class UserService {
    constructor() {

    }

    async findOrCreateUser(email) {
        let user = {};
        try {
            let db = await mysql.begin('findOrCreateUser');
            let { results } = await db.sql('select * from person where email = ?', [email]);

            if (results.length == 0)
                user = await this.createUser(email, db);
            else
                user = results[0];
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

    async createUser(email, db) {
        try {
            db = db || await mysql.db();
            let user = {}
            user.id = { toSqlString: () => genUnique64() }
            user.email = email;
            user.displayname = "";
            user.apikey = generateAPIKEY();
            user.isdev = false;
            user.tsapikey = utcDATETIME();

            //its a github username
            if (email.indexOf("@") == -1) {
                user.displayname = email;
                user.isdev = true;
                user.github_url = 'https://github.com/' + email;
            }


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