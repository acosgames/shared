const MySQL = require('./mysql');
const mysql = new MySQL();

const credutil = require('../util/credentials')
const { genUnique64string } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError, CodeError, SQLError } = require('../util/errorhandler');

const cache = require('./cache');
const redis = require('./redis');

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
            const { results, fields } = await db.insertBatch('game_review', [{ game_slug, shortid, vote: (vote ? 1 : -1) }], ['game_slug', 'shortid']);

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


    ratingToRank(rating) {


        let ranks = [
            'Wood I',
            'Wood II',
            'Wood III',
            'Wood IV',
            'Bronze I',
            'Bronze II',
            'Bronze III',
            'Bronze IV',
            'Silver I',
            'Silver II',
            'Silver III',
            'Silver IV',
            'Gold I',
            'Gold II',
            'Gold III',
            'Gold IV',
            'Platinum I',
            'Platinum II',
            'Platinum III',
            'Platinum IV',
            'Champion I',
            'Champion II',
            'Champion III',
            'Champion IV',
            'Grand Champion I',
            'Grand Champion II',
            'Grand Champion III',
            'Grand Champion IV',
        ]

        let rt = Math.min(5000, Math.max(0, rating));
        rt = rt / 5000;
        rt = rt * (ranks.length - 1);

        rt = Math.round(rt);
        return ranks[rt];

    }

    async getGameSiteMap() {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of games for sitemap");
            response = await db.sql(`
                SELECT  
                    a.game_slug
                FROM game_info a
                WHERE (a.status = 2 or a.status = 3)
                LIMIT 1000
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

    async findGames() {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of games");
            response = await db.sql(`
                SELECT  
                    a.gameid,
                    a.game_slug, 
                    a.version, 
                    a.shortdesc,
                    a.latest_version, 
                    cur.db as db,
                    cur.screentype as screentype,
                    cur.resow as resow,
                    cur.resoh as resoh,
                    cur.screenwidth as screenwidth,
                    latest.screentype as latest_screentype,
                    latest.resow as latest_resow,
                    latest.resoh as latest_resoh,
                    latest.screenwidth as latest_screenwidth,
                    latest.db as latest_db,
                    a.name, 
                    a.preview_images,
                    a.lbscore,
                    a.status,
                    a.maxplayers
                FROM game_info a, game_version cur, game_version latest
                WHERE (a.status = 2 or a.status = 3)
                AND (a.gameid = cur.gameid AND a.version = cur.version)
                AND (a.gameid = latest.gameid AND a.latest_version = latest.version)
                AND a.visible = 1
                LIMIT 100
            `);

            let games = response.results;

            let queueCounts = await this.getAllGamesQueueCount();
            for (var i = 0; i < games.length; i++) {
                let game = games[i];
                if (typeof queueCounts[game.game_slug] !== 'undefined')
                    game.queueCount = queueCounts[game.game_slug];
                else
                    game.queueCount = 0;
            }

            return games;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async findGameReplays(game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting game replay: ", game_slug);
            response = await db.sql(`
                SELECT a.version, a.mode, a.filename, c.screentype, c.resow, c.resoh, c.screenwidth
                FROM game_replay a, game_info b, game_version c
                WHERE a.game_slug = ?
                AND a.game_slug = b.game_slug 
                AND b.gameid = c.gameid
                AND b.version = c.version
                ORDER BY a.tsupdate DESC
                LIMIT 100
            `, [game_slug]);

            if (!response.results) {
                return [];
            }

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async findGame(game_slug, ignoreExtra) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting game: ", game_slug);
            response = await db.sql(`
                SELECT 
                    b.shortid, b.displayname, b.github,
                    a.*,
                    current.screentype as screentype,
                    current.resow as resow,
                    current.resoh as resoh,
                    current.screenwidth as screenwidth,
                    current.db as db,
                    latest.screentype as latest_screentype,
                    latest.resow as latest_resow,
                    latest.resoh as latest_resoh,
                    latest.screenwidth as latest_screenwidth,
                    latest.db as latest_db
                FROM game_info a, person b, game_version current, game_version latest
                WHERE a.game_slug = ?
                AND a.ownerid = b.id
                AND (a.gameid = current.gameid AND a.version = current.version)
                AND (a.gameid = latest.gameid AND a.latest_version = latest.version)
                AND a.visible != 2
            `, [game_slug]);

            if (response.results && response.results.length == 0) {
                return null;
            }
            let game = response.results[0];
            console.log("Game Found: ", JSON.stringify(game, null, 2));

            if (ignoreExtra)
                return { game }

            game.votes = await this.findGameVotes(game_slug);



            game.queueCount = await this.getGameQueueCount(game_slug) || 0;
            let top10 = await this.getGameTop10Players(game_slug) || [];
            // game.lb = await this.getPlayerGameLeaderboard(game_slug, game.displayname) || [];
            let lbCount = await this.getGameLeaderboardCount(game_slug) || 0;

            let cleaned = {
                game,
                top10,
                lbCount
            }
            return cleaned;
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
                LEFT JOIN (SELECT count(*) as dislikes, game_slug FROM game_review WHERE game_slug = ? and vote = -1 GROUP BY game_slug) c
                    ON a.game_slug = c.game_slug
                WHERE a.game_slug = ?
                `, [game_slug, game_slug, game_slug]);

            if (response.results && response.results.length == 0) {
                return 0;
            }
            let result = response.results[0];
            if (result) {
                let votes = Number(result.likes) - Number(result.dislikes);
                cache.set(game_slug + '/votes', votes, 60);
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

    async findGameTeams(game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting game teams: ", game_slug);
            response = await db.sql(`
                SELECT * FROM game_team a
                WHERE a.game_slug = ?
                `, [game_slug]);

            if (response.results && response.results.length == 0) {
                return [];
            }

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async updateVotes(game_slug, votes) {

    }

    async getAllGamesQueueCount() {
        try {
            let queues = await cache.getLocal('queueCount');
            if (!queues) {
                queues = await redis.hgetall('queueCount');
                cache.setLocal('queueCount', queues, 5);
            }
            console.log("queues=", queues);
            return queues;
        }
        catch (e) {
            console.error(e);
            return {};
        }
    }
    async getGameQueueCount(game_slug) {
        try {
            let queueCount = await redis.hget('queueCount', game_slug);
            console.log(game_slug, "queueCount=", queueCount);
            return Number.parseInt(queueCount);
        }
        catch (e) {
            console.error(e);
            return 0;
        }
    }

    async getGameTop10Players(game_slug) {

        //let rankings = await redis.get(game_slug + '/top10');
        //if (!rankings) {
        let db = await mysql.db();
        let sqlTop10 = await db.sql(`
            SELECT a.displayname, b.rating, concat(c.category, '-', c.sortid, '.', c.ext) as portrait
            FROM person a
            LEFT JOIN person_rank b
                ON a.shortid = b.shortid
            LEFT JOIN avatar c
                ON a.avatarid = c.avatarid
            WHERE b.game_slug = ?
            AND b.season = ?
            AND b.played > 0
            ORDER BY b.rating DESC
            LIMIT 30
        `, [game_slug, 0]);

        let rankings = sqlTop10.results;

        // let rankings = await redis.zrevrange(game_slug + '/lb', 0, 25);

        if (rankings.length == 0) {
            let total = await this.updateAllRankings(game_slug);
            if (total > 0) {
                return this.getGameTop10Players(game_slug);
            }
        }

        for (var i = 0; i < rankings.length; i++) {
            rankings[i].rank = (i + 1);
        }

        //   redis.set(game_slug + '/top10', rankings, 60);
        //}

        console.log("top10: ", game_slug, rankings);
        return rankings;
    }

    async updateAllRankings(game_slug) {
        let db = await mysql.db();
        var response;
        console.log("updateAllRankings ", game_slug);

        let total = 0;
        let responseCnt = await db.sql(`SELECT count(*) as cnt FROM person_rank WHERE game_slug = ? and season = ? and played > 0`, [game_slug, 0]);
        if (responseCnt && responseCnt.results && responseCnt.results.length > 0) {
            total = Number(responseCnt.results[0]?.cnt) || 0;
        }

        if (total == 0)
            return 0;

        let offset = 0;

        while (offset < total) {

            let count = 1000;
            if (offset + count > total) {
                count = total - offset;
            }

            response = await db.sql(`
                SELECT a.displayname as value, b.rating as score
                FROM person a, person_rank b
                WHERE a.shortid = b.shortid
                AND b.game_slug = ?
                AND b.season = ?
                AND b.played > 0
                LIMIT ?,?
            `, [game_slug, 0, offset, count]);

            if (!response || !response.results || response.results.length == 0)
                break;

            let members = response.results;
            let result = await redis.zadd(game_slug + '/lb', members);
            offset += count;
        }

        return total;
    }

    async getGameLeaderboardCount(game_slug) {
        let count = await redis.zcount(game_slug + '/lb', 0, 10000000);
        console.log("count: ", game_slug, count);
        return count;
    }

    async getPlayerGameRank(game_slug, player) {
        let rank = await redis.zrevrank(game_slug + '/lb', player);
        console.log("rank: ", game_slug, player, (rank + 1));

        return rank + 1;
    }

    async getPlayerGameLeaderboard(game_slug, player, rank) {
        if (!rank)
            return [];
        let rankings = await redis.zrevrange(game_slug + '/lb', Math.max(0, rank - 1), rank + 1);
        console.log("rankings raw: ", rankings);
        let playerPos = 0;
        for (var i = 0; i < rankings.length; i++) {
            if (rankings[i].value == player) {
                playerPos = -i;
                break;
            }
        }

        let otherRank = 0;
        for (var i = 0; i < rankings.length; i++) {

            rankings[i].rank = rank + (playerPos + i)
        }

        console.log("range: ", game_slug, rankings);

        return rankings;
    }


    async findGameLeaderboard(game_slug, shortid, displayname) {
        try {
            // let db = await mysql.db();

            console.log("findGameLeaderboard: ", game_slug, shortid, displayname);

            let game = {};
            game.top10 = await this.getGameTop10Players(game_slug) || [];
            if (displayname) {
                let playerRank = await this.getPlayerGameRank(game_slug, displayname);
                game.lb = await this.getPlayerGameLeaderboard(game_slug, displayname, playerRank) || [];
            }
            else {
                game.lb = [];
            }
            game.lbCount = await this.getGameLeaderboardCount(game_slug) || 0;
            return game;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async findGamePerson(game_slug, shortid, displayname) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting game with person stats: ", game_slug, shortid, displayname);
            response = await db.sql(`
                SELECT 
                cur.db as db,
                cur.screentype as screentype,
                cur.resow as resow,
                cur.resoh as resoh,
                cur.screenwidth as screenwidth,
                latest.screentype as latest_screentype,
                latest.resow as latest_resow,
                latest.resoh as latest_resoh,
                latest.screenwidth as latest_screenwidth,
                latest.db as latest_db,
                latest.tsupdate as latest_tsupdate,
                d.shortid, d.displayname, d.github,
                b.vote, 
                b.report, 
                coalesce(c.rating,0) as rating, 
                coalesce(c.win,0) as win, 
                coalesce(c.loss,0) as loss, 
                coalesce(c.tie,0) as tie, 
                coalesce(c.played,0) as played, 
                coalesce(c.highscore,0) as highscore,
                a.*
                FROM game_info a, person d, game_version cur, game_version latest
                LEFT JOIN game_review b ON (b.game_slug = ? AND b.shortid = ?)
                LEFT JOIN person_rank c ON (c.game_slug = ? AND c.shortid = ?)
                WHERE a.game_slug = ?
                AND a.ownerid = d.id
                AND (a.gameid = cur.gameid AND a.version = cur.version)
                AND (a.gameid = latest.gameid AND a.latest_version = latest.version)
                AND a.visible != 2
            `, [game_slug, shortid, game_slug, shortid, game_slug]);

            if (response.results && response.results.length == 0) {
                return new GeneralError('E_NOTFOUND');
            }

            let game = response.results[0];

            game.votes = await this.findGameVotes(game_slug);
            game.top10 = await this.getGameTop10Players(game_slug) || [];
            let playerRank = -1;
            if (displayname) {
                playerRank = await this.getPlayerGameRank(game_slug, displayname);
                if (playerRank) {
                    game.lb = await this.getPlayerGameLeaderboard(game_slug, displayname, playerRank) || [];
                    //game.ratingTxt = await this.ratingToRank(game.rating);
                }
                else {
                    game.lb = [];
                    //game.ratingTxt = 'Unranked'
                }

            }
            else {
                game.lb = [];
                //game.ratingTxt = 'Unranked'
            }
            game.lbCount = await this.getGameLeaderboardCount(game_slug) || 0;
            game.queueCount = await this.getGameQueueCount(game_slug) || 0;
            let cleaned = {
                game: {
                    gameid: game.gameid,
                    game_slug: game.game_slug,
                    name: game.name,
                    version: game.version,
                    screentype: game.screentype,
                    resow: game.resow,
                    resoh: game.resoh,
                    screenwidth: game.screenwidth,
                    db: game.db,
                    latest_version: game.latest_version,
                    latest_screentype: game.latest_screentype,
                    latest_resow: game.latest_resow,
                    latest_resoh: game.latest_resoh,
                    latest_screenwidth: game.latest_screenwidth,
                    latest_db: game.latest_db,
                    latest_tsupdate: game.latest_tsupdate,
                    minplayers: game.minplayers,
                    maxplayers: game.maxplayers,
                    lbscore: game.lbscore,
                    ownerid: game.ownerid,
                    shortid: game.shortid,
                    displayname: game.displayname,
                    github: game.github,
                    shortdesc: game.shortdesc,
                    longdesc: game.longdesc,
                    opensource: game.opensource,
                    preview_images: game.preview_images,
                    status: game.status,
                    votes: game.votes,
                    queueCount: game.queueCount,
                    tsupdate: game.tsupdate,
                    tsinsert: game.tsinsert,
                },
                player: {
                    rating: game.rating,
                    //ratingTxt: game.ratingTxt,
                    ranking: playerRank + 1,
                    vote: game.vote,
                    report: game.report,
                    win: game.win,
                    loss: game.loss,
                    tie: game.tie,
                    played: game.played
                },
                top10: game.top10,
                lb: game.lb,
                lbCount: game.lbCount
            }

            return cleaned;

        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }



    async getGameTop10PlayersHighscore(game_slug) {

        //let rankings = await redis.get(game_slug + '/top10hs');
        //if (!rankings) {
        // let rankings = await redis.zrevrange(game_slug + '/lbhs', 0, 19);

        let db = await mysql.db();
        let sqlTop10 = await db.sql(`
            SELECT a.displayname, b.highscore, concat(c.category, '-', c.sortid, '.', c.ext) as portrait
            FROM person a
            LEFT JOIN person_rank b
                ON a.shortid = b.shortid
            LEFT JOIN avatar c
                ON a.avatarid = c.avatarid
            WHERE b.game_slug = ?
            AND b.season = ?
            AND b.played > 0
            AND b.highscore > 0
            ORDER BY b.rating DESC
            LIMIT 30
        `, [game_slug, 0]);

        let rankings = sqlTop10.results;


        if (rankings.length == 0) {
            let total = await this.updateAllHighscores(game_slug);
            if (total > 0) {
                return this.getGameTop10PlayersHighscore(game_slug);
            }
        }

        for (var i = 0; i < rankings.length; i++) {
            rankings[i].rank = (i + 1);
        }

        //redis.set(game_slug + '/top10hs', rankings, 60);
        //}

        console.log("getGameTop10PlayersHighscore: ", game_slug, rankings);
        return rankings;
    }

    async updateAllHighscores(game_slug) {
        let db = await mysql.db();
        var response;
        console.log("updateAllHighscores ", game_slug);

        let total = 0;
        let responseCnt = await db.sql(`SELECT count(*) as cnt FROM person_rank WHERE game_slug = ? and season = ? and played > 0 and highscore > 0`, [game_slug, 0]);
        if (responseCnt && responseCnt.results && responseCnt.results.length > 0) {
            total = Number(responseCnt.results[0]?.cnt) || 0;
        }

        if (total == 0)
            return 0;

        let offset = 0;

        while (offset < total) {

            let count = 1000;
            if (offset + count > total) {
                count = total - offset;
            }

            response = await db.sql(`
                SELECT a.displayname as value, b.highscore as score
                FROM person a, person_rank b
                WHERE a.shortid = b.shortid
                AND b.game_slug = ?
                AND b.season = ?
                AND b.played > 0
                AND b.highscore > 0
                LIMIT ?,?
            `, [game_slug, 0, offset, count]);

            if (!response || !response.results || response.results.length == 0)
                break;

            let members = response.results;
            let result = await redis.zadd(game_slug + '/lbhs', members);
            offset += count;
        }

        return total;
    }

    async getGameLeaderboardCountHighscore(game_slug) {
        let count = await redis.zcount(game_slug + '/lbhs', 0, 10000000);
        console.log("count: ", game_slug, count);
        return count;
    }

    async getPlayerGameHighscore(game_slug, player) {
        let highscore = await redis.zrevrank(game_slug + '/lbhs', player);
        console.log("highscore: ", game_slug, player, highscore);

        return highscore;
    }

    async getPlayerGameLeaderboardHighscore(game_slug, player, rank) {
        if (!rank)
            return [];
        let rankings = await redis.zrevrange(game_slug + '/lbhs', Math.max(0, rank - 1), rank + 1);
        console.log("highscore rankings raw: ", rankings);
        let playerPos = 0;
        for (var i = 0; i < rankings.length; i++) {
            if (rankings[i].value == player) {
                playerPos = -i;
                break;
            }
        }

        let otherRank = 0;
        for (var i = 0; i < rankings.length; i++) {

            rankings[i].rank = rank + (playerPos + i + 1)
        }

        console.log("highscore range: ", game_slug, rankings);

        return rankings;
    }


    async findGameLeaderboardHighscore(game_slug, shortid, displayname) {
        try {
            // let db = await mysql.db();

            console.log("findGameLeaderboardHighscore: ", game_slug, shortid, displayname);

            let game = {};
            game.top10hs = await this.getGameTop10PlayersHighscore(game_slug) || [];
            if (displayname) {
                let playerRank = await this.getPlayerGameHighscore(game_slug, displayname);
                if (playerRank) {
                    game.lbhs = await this.getPlayerGameLeaderboardHighscore(game_slug, displayname, playerRank) || [];
                }
                else {
                    game.lbhs = [];
                }
            }
            else {
                game.lbhs = [];
            }
            game.lbhsCount = await this.getGameLeaderboardCountHighscore(game_slug) || 0;
            return game;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
}