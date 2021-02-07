const MySQL = require('./mysql');
const mysql = new MySQL();
const credutil = require('../util/credentials')
const { genUnique64 } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError, CodeError, SQLError } = require('../util/errorhandler');

module.exports = class DevGameService {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    async findGame(game, user, db) {
        try {
            db = db || await mysql.db();
            var response;
            console.log("Searching for game: ", game);
            if (game.id) {
                response = await db.sql('select * from dev_game where gameid = ?', [{ toSqlString: () => game.id }]);
            }
            else if (game.gameid) {
                response = await db.sql('select * from dev_game where gameid = ?', [{ toSqlString: () => game.gameid }]);
            }
            else if (game.shortid) {
                response = await db.sql('select * from dev_game where shortid = ?', [game.shortid]);
            }

            if (response && response.results.length > 0)
                game = response.results[0];
            else
                return null;
            return game;
        }
        catch (e) {
            throw new CodeError(e);
        }
    }

    updateImages(gameid, user, images) {

    }

    async updateGame(game, user) {
        console.log(game);
        try {
            db = db || await mysql.db();
            game.version = 1;
            game.ownerid = user.id;

            let { results } = await db.update('dev_game', game, 'gameid=?', [game.gameid]);
            console.log(results);

            if (results.affectedRows > 0) {
                game.gameid = game.gameid.toSqlString();
                return game;
            }

        }
        catch (e) {
            //revert back to normal


            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("dev_game.name_UNIQUE")) {
                    throw new GeneralError("E_GAME_DUPENAME", game.name);
                }
            }
            //console.error(e);
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
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

            if (results.affectedRows > 0) {
                game.gameid = game.gameid.toSqlString();
                return game;
            }

        }
        catch (e) {
            //revert back to normal


            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("dev_game.name_UNIQUE")) {
                    throw new GeneralError("E_GAME_DUPENAME", game.name);
                }
            }
            //console.error(e);
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }

    async createOrUpdateGame(game, user) {

        try {
            let db = await mysql.begin('findOrCreateGame');

            let existingGame = await this.findGame(game, user, db);

            if (!existingGame)
                game = await this.createGame(game, user, db);
            else {
                game = await this.updateGame(game, user, db);
                game = Object.assign({}, existingGame, game)
            }

            await mysql.end('findOrCreateGame');
            return game;
        }
        catch (e) {
            await mysql.end('findOrCreateGame');
            throw e;
        }
    }
}