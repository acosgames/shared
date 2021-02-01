const MySQL = require('./mysql');
const mysql = new MySQL();

const { v4: uuidv4 } = require('uuid');

module.exports = class UserService {
    constructor() {

    }

    async findOrCreateUser(email) {
        let user = {};
        try {
            let db = await mysql.begin('findOrCreateUser');
            let { results } = await db.sql('select * from person where email = ?', [user.email]);

            if (results.length == 0)
                user = await this.createUser(email, db);
            else
                user = results[0];
            console.log(user);
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
        db = db || await mysql.db();
        let user = {}
        user.email = email;
        user.displayname = "Player-" + Math.round(Math.random() * Number.MAX_VALUE / 5);
        user.apikey = this.generateAPIKEY();
        user.isdev = false;

        let { results } = await db.insert('person', user);
        console.log(results);
        if (results.length > 0)
            return results[0];
        return null;
    }

    generateAPIKEY() {
        let id = uuidv4().replace(/\-/ig, '').toUpperCase();
        return id;
    }
}