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
            response = await db.sql(`
                SELECT 
                    a.gameid, 
                    coalesce(players.count,0) as activePlayers, 
                    a.game_slug, 
                    a.version, 
                    a.latest_version, 
                    a.maxplayers, 
                    a.ownerid, 
                    a.name, 
                    a.shortdesc, 
                    a.longdesc, 
                    a.git, 
                    a.preview_images, 
                    a.status
                FROM game_info a
                LEFT JOIN (
                    SELECT 
                        count(gameid) as count, 
                        gameid 
                    FROM game_room
                    group by gameid
                ) as players
                    on players.gameid = a.gameid
                WHERE (a.status = 2 or a.status = 3)
            `);

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
            console.log("Getting game: ", game_slug);
            response = await db.sql('SELECT gameid, game_slug, version, latest_version, minplayers, maxplayers, ownerid, name, shortdesc, longdesc, git, preview_images, status FROM game_info WHERE game_slug = ?', [game_slug]);

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