const MySQL = require('./mysql');
const mysql = new MySQL();
const credutil = require('../util/credentials')
const { genUnique64 } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');

module.exports = class DevGameService {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    getGame(gameid) {

    }

    updateImages(gameid, user, images) {

    }

    updateGame(game) {

    }

    async createGame(game, user, db) {
        console.log(game);
        try {
            db = db || await mysql.db();
            game.gameid = { toSqlString: () => genUnique64() }
            game.version = 1;
            game.ownerid = user.id;

            let { results } = await db.insert('dev_game', game);
            console.log(results);

            if (results.affectedRows > 0)
                return game;
        }
        catch (e) {
            //revert back to normal
            game.gameid = game.gameid.toSqlString();

            if (e.errno == 1062) {
                if (e.sqlMessage.indexOf("dev_game.name_UNIQUE")) {
                    throw { ecode: "E_DUPE_GAMENAME", payload: game };
                }
            }
            console.error(e);
            throw { ecode: "E_INVALID_GAME", payload: game };
        }
        return null;
    }

    async createOrUpdateGame(game, user) {

        try {
            let db = await mysql.begin('findOrCreateGame');
            let response;
            if (game.id) {
                response = await db.sql('select * from dev_game where gameid = ?', [game.id]);
            }
            else if (game.shortid) {
                response = await db.sql('select * from dev_game where shortid = ?', [game.shortid]);
            }
            // else {
            //     throw { ecode: "E_GAME_NOTFOUND", payload: game };
            // }

            if (!response || !response.results || response.results.length == 0)
                game = await this.createGame(game, user, db);
            else {

                game = await this.updateGame(game, user, db);
                game = Object.assign({}, existingGame, game)

            }

            //console.log(user);
        }
        catch (e) {

            console.error(e);
            return e;

        }
        finally {
            await mysql.end('findOrCreateGame');
        }

        return game;
    }
}