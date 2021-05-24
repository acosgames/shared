const MySQL = require('./mysql');
const mysql = new MySQL();

const credutil = require('../util/credentials')
const { genUnique64string } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError, CodeError, SQLError } = require('../util/errorhandler');

module.exports = class GameService {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    async findGames() {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of games");
            response = await db.sql('select gameid, game_slug, version, ownerid, name, shortdesc, longdesc, git, preview_images, status from game_info');

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async findGame(game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of games");
            response = await db.sql('select gameid, game_slug, version, ownerid, name, shortdesc, longdesc, git, preview_images, status from game_info where game_slug = ?', [game_slug]);

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }
}