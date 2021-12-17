const MySQL = require('./mysql');
const mysql = new MySQL();

const credutil = require('../util/credentials')
const { genUnique64string } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError, CodeError, SQLError } = require('../util/errorhandler');

const cache = require('./cache');

module.exports = class GameService {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    async reportGame(game_slug, shortid, report) {
        try {
            let db = await mysql.db();
            const { results, fields } = await db.insertBatch('game_review', [{ game_slug, shortid, report }], ['game_slug', 'shortid']);
            return results;

        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async rateGame(game_slug, shortid, vote, previousVote) {
        try {
            let db = await mysql.db();
            const { results, fields } = await db.insertBatch('game_review', [{ game_slug, shortid, vote }], ['game_slug', 'shortid']);

            let key = game_slug + '/votes';
            let votes = await cache.get(key) || 0;

            if (previousVote != null && typeof previousVote !== 'undefined') {
                let likeToDislike = previousVote && !vote;
                let dislikeToLike = !previousVote && vote;

                if (likeToDislike) {
                    votes -= 2;
                }
                else if (dislikeToLike) {
                    votes += 2;
                }
            }
            else {
                if (vote) votes += 1;
                else votes -= 1;
            }


            cache.set(key, votes);

            return votes;

        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async findGames() {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of games");
            response = await db.sql(`
                SELECT 
                    coalesce(players.count,0) as activePlayers, 
                    a.gameid,
                    a.game_slug, 
                    a.version, 
                    a.latest_version, 
                    a.name, 
                    a.preview_images,
                    a.status,
                    a.maxplayers
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
            response = await db.sql('SELECT gameid, game_slug,  version, latest_version, minplayers, maxplayers, ownerid, name, shortdesc, longdesc, git, preview_images, votes, status, tsupdate, tsinsert FROM game_info WHERE game_slug = ?', [game_slug]);

            if (response.results && response.results.length == 0) {
                return null;
            }
            let game = response.results[0];
            game.votes = await this.findGameVotes(game_slug);
            return game;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async findGameVotes(game_slug) {
        try {

            let votes = await cache.get(game_slug + '/votes');
            if (votes != null && typeof votes !== 'undefined') {
                return votes;
            }

            let db = await mysql.db();
            var response;
            console.log("Getting game votes: ", game_slug);
            response = await db.sql(`
                SELECT 
                    coalesce(b.likes,0) as likes, 
                    coalesce(c.dislikes,0) as dislikes
                FROM game_info a
                LEFT JOIN (SELECT count(*) as likes, game_slug FROM game_review WHERE game_slug = ? AND vote = 1 GROUP BY game_slug) b
                    ON a.game_slug = b.game_slug
                LEFT JOIN (SELECT count(*) as dislikes, game_slug FROM game_review WHERE game_slug = ? and vote = 0 GROUP BY game_slug) c
                    ON a.game_slug = c.game_slug
                WHERE a.game_slug = ?
                `, [game_slug, game_slug, game_slug]);

            if (response.results && response.results.length == 0) {
                return 0;
            }
            let result = response.results[0];
            if (result) {
                let votes = Number(result.likes) - Number(result.dislikes);
                cache.set(game_slug + '/votes', votes, 3600);
                return votes;
            }

            return 0;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async updateVotes(game_slug, votes) {

    }

    async findGamePerson(game_slug, shortid) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting game: ", game_slug);
            response = await db.sql(`
                SELECT 
                    
                    a.gameid, a.game_slug,  a.version, 
                    a.votes, 
                    b.vote, 
                    b.report, 
                    coalesce(c.rating,0), 
                    coalesce(c.win,0), 
                    coalesce(c.loss,0), 
                    coalesce(c.tie,0), 
                    coalesce(c.played,0), 
                    a.latest_version, a.minplayers, a.maxplayers, 
                    a.ownerid, a.name, a.shortdesc, a.longdesc, 
                    a.git, a.preview_images, a.status, 
                    a.tsupdate, a.tsinsert 
                FROM game_info a
                LEFT JOIN game_review b
                    ON a.game_slug = b.game_slug AND b.shortid = ?
                LEFT JOIN person_rank c
                    ON a.game_slug = c.game_slug AND c.shortid = ?
                WHERE a.game_slug = ?
            `, [shortid, shortid, game_slug]);

            if (response.results && response.results.length == 0) {
                return new GeneralError('E_NOTFOUND');
            }
            let game = response.results[0];
            game.votes = await this.findGameVotes(game_slug);
            return game;

        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
}