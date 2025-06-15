const MySQL = require("./mysql");
const mysql = new MySQL();

const credutil = require("../util/credentials");
const { genUnique64string } = require("../util/idgen");
const { utcDATETIME } = require("../util/datefns");
const { GeneralError, CodeError, SQLError } = require("../util/errorhandler");

const cache = require("./cache");
const redis = require("./redis");

class LeaderboardService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
    }

    createLeaderboardKey(config) {
        if (config?.redisKey) return config?.redisKey;
        let key = ["rank"];
        if (config?.game_slug) key.push(config.game_slug);
        if (config?.season) key.push(config.season);
        if (config?.type) key.push(config.type);
        if (config?.division_id) key.push(config.division_id);
        if (config?.monthly) {
            let now = new Date();
            key.push(now.getUTCFullYear() + now.getUTCMonth());
        }

        config.redisKey = key.join("/");
        return config.redisKey;
    }

    async verifyRedisLeaderboard(config) {
        this.createLeaderboardKey(config);

        let redisRankings = await redis.zrevrange(config.redisKey, 0, 1);
        if (redisRankings.length == 0) {
            let total = await this.fullRedisLeaderboardUpdate(game_slug);
            if (total > 0) {
                redisRankings = await redis.zrevrange(config.redisKey, 0, 1);
                if (redisRankings.length == 0) {
                    return false;
                }
            }
        }
        return true;
    }

    async fullRedisLeaderboardUpdate(config) {
        this.createLeaderboardKey(config);

        switch (config.type) {
            case "rank":
                return this.getAllRanks(config);
                break;
            case "score":
                return this.getAllHighScores(config);
                break;
        }

        return 0;
    }

    async getAllRanks(config, onResults) {
        if (!config || !config?.game_slug || !config?.season) return;

        let db = await mysql.db();
        let response;
        console.log("getAllRanks ", config.game_slug);

        let total = 0;
        let responseCnt = await db.sql(
            `SELECT count(*) as cnt 
        FROM person_rank b
        LEFT JOIN person a
            ON b.shortid = a.shortid
        LEFT JOIN game_info gi
            ON gi.game_slug = b.game_slug
        WHERE b.game_slug = ? 
        and b.season = ?
        ${config.division_id ? "and b.division = ?" : ""}
        and b.played > 0
        `,
            [config.game_slug, config.season, config.division_id]
        );
        if (responseCnt && responseCnt.results && responseCnt.results.length > 0) {
            total = Number(responseCnt.results[0]?.cnt) || 0;
        }

        if (total == 0) return 0;
        let offset = 0;

        while (offset < total) {
            let count = 10000;
            if (offset + count > total) {
                count = total - offset;
            }

            let values = [config.game_slug, config.season];

            if (config.division_id) values.push(config.division_id);
            values.push(offset);
            values.push(count);
            response = await db.sql(
                `
                SELECT a.displayname as value, b.rating as score, a.countrycode
                FROM person a, person_rank b, game_info gi
                WHERE a.shortid = b.shortid
                AND b.game_slug = ?
                AND gi.game_slug = b.game_slug
                AND b.season = ?
                ${config.division_id ? "and b.division = ?" : ""}
                AND b.played > 0
                LIMIT ?,?
            `,
                values
            );

            if (!response || !response.results || response.results.length == 0) break;
            let result = await redis.zadd(config.redisKey, members);
            offset += count;
        }

        return total;
    }

    async getAllHighScores(config) {
        let db = await mysql.db();
        var response;
        console.log("updateAllHighscores ", game_slug);

        let total = 0;
        let responseCnt = await db.sql(
            `SELECT count(*) as cnt 
            FROM person_rank 
            WHERE game_slug = ? 
            and season = ? 
            ${config.division_id ? "and division = ?" : ""}
            and played > 0 
            and highscore > 0`,
            [config.game_slug, config.season, config.division_id]
        );
        if (responseCnt && responseCnt.results && responseCnt.results.length > 0) {
            total = Number(responseCnt.results[0]?.cnt) || 0;
        }

        if (total == 0) return 0;

        let offset = 0;

        while (offset < total) {
            let count = 1000;
            if (offset + count > total) {
                count = total - offset;
            }

            let values = [config.game_slug, config.season];

            if (config.division_id) values.push(config.division_id);
            values.push(offset);
            values.push(count);

            response = await db.sql(
                `
                SELECT a.displayname as value, b.highscore as score
                FROM person a, person_rank b
                WHERE a.shortid = b.shortid
                AND b.game_slug = ?
                AND b.season = ?
                ${config.division_id ? "and b.division = ?" : ""}
                AND b.played > 0
                AND b.highscore > 0
                LIMIT ?,?
            `,
                values
            );

            if (!response || !response.results || response.results.length == 0) break;

            let result = await redis.zadd(config.redisKey, members);
            offset += count;
        }

        return total;
    }

    async getDivisionLeaderboard(game_slug, division_id) {
        let db = await mysql.db();
        let sqlTop10 = await db.sql(
            `
            SELECT 
                a.displayname, 
                b.win,
                b.tie,
                b.loss,
                a.portraitid, 
                a.countrycode,
                b.rating
            FROM person_rank b 
            INNER JOIN game_info gi 
                ON gi.game_slug = ?
            INNER JOIN person a
                ON a.shortid = b.shortid
                WHERE b.game_slug = gi.game_slug
                AND b.season = gi.season
                AND b.division = ?
                AND b.played > 0
            LIMIT 100;
        `,
            [game_slug, division_id]
        );

        let rankings = sqlTop10.results;
        for (let ranker of rankings) {
            let total = ranker.win + ranker.tie + ranker.loss;
            ranker.winrating =
                ((ranker.win + 0.5 * ranker.tie) / total) * (ranker.win - ranker.loss * 2);
        }

        rankings.sort((a, b) => b.winrating - a.winrating);
        // for (var i = 0; i < rankings.length; i++) {
        //     rankings[i].rank = (i + 1);
        // }

        let prevRating = Number.MAX_VALUE;
        let currentRank = 1;
        for (var i = 0; i < rankings.length; i++) {
            let rating = rankings[i].winrating;
            if (prevRating > rating) {
                currentRank = i + 1;
                prevRating = rating;
            }
            rankings[i].rank = currentRank;
            // rankings[i].rank = (i + 1);
        }

        return rankings;
    }

    async getRatingLeaderboardRedis({ game_slug, countrycode, season }) {
        season = season || 0;

        let redisKey = game_slug + "/rankings";

        // redisKey += '/' + season;
        if (countrycode) redisKey += "/" + countrycode;

        let redisRankings = await redis.zrevrange(redisKey, 0, 100);

        let displaynames = redisRankings.map((r) => r.value);

        let db = await mysql.db();
        let sqlTop10 = await db.sql(
            `
            SELECT 
                a.displayname, 
                b.win,
                b.tie,
                b.loss,
                b.rating, 
                a.portraitid, 
                a.countrycode
            FROM person_rank b
            INNER JOIN game_info gi 
                ON gi.game_slug = ?
            INNER JOIN person a
                ON a.shortid = b.shortid
            WHERE b.game_slug = gi.game_slug 
            ${countrycode ? "AND a.countrycode = ?" : ""}
            AND b.season = ?
            AND b.played > 0
            AND a.displayname IN (?)
        `,
            [game_slug, countrycode, season, displaynames]
        );

        let playerMapping = {};
        sqlTop10.results.map((p) => (playerMapping[p.displayname] = p));

        let leaderboard = [];
        redisRankings.map((r, index) => {
            playerMapping[r.value].rank = index + 1;
            leaderboard.push(playerMapping[r.value]);
        });

        return leaderboard;
    }

    async getRatingLeaderboard(game_slug, config) {
        let db = await mysql.db();
        let sqlTop10 = await db.sql(
            `
            SELECT 
                a.displayname, 
                b.win,
                b.tie,
                b.loss,
                b.rating, 
                a.portraitid, 
                a.countrycode
            FROM person_rank b
            INNER JOIN game_info gi 
                ON gi.game_slug = ?
            INNER JOIN person a
                ON a.shortid = b.shortid
            WHERE b.game_slug = gi.game_slug 
            ${config?.countrycode ? "AND a.countrycode = ?" : ""}
            AND b.season = gi.season
            AND b.played > 0
            ORDER BY b.rating DESC
            LIMIT 100
        `,
            [game_slug, config?.countrycode]
        );

        let rankings = sqlTop10.results;

        let redisKey = game_slug + "/rankings";
        if (config?.countrycode) redisKey += "/" + config?.countrycode;

        let redisRankings = await redis.zrevrange(redisKey, 0, 1);
        if (redisRankings.length == 0) {
            let total = await this.updateAllRankings(game_slug);
            if (total > 0) {
                redisRankings = await redis.zrevrange(redisKey, 0, 1);
                if (redisRankings.length == 0) {
                    return [];
                }
                return this.getRatingLeaderboard(game_slug, config);
            }
        }

        let prevRating = Number.MAX_VALUE;
        let currentRank = 1;
        for (var i = 0; i < rankings.length; i++) {
            let rating = rankings[i].rating;
            if (prevRating > rating) {
                currentRank = i + 1;
                prevRating = rating;
            }
            rankings[i].rank = currentRank;
            // rankings[i].rank = (i + 1);
        }

        return rankings;
    }

    // async updateAllRankings(game_slug) {
    //     let db = await mysql.db();
    //     var response;
    //     console.log("updateAllRankings ", game_slug);

    //     let total = 0;
    //     let responseCnt = await db.sql(
    //         `SELECT count(*) as cnt
    //     FROM person_rank b
    //     LEFT JOIN person a
    //         ON b.shortid = a.shortid
    //     LEFT JOIN game_info gi
    //         ON gi.game_slug = b.game_slug
    //     WHERE b.game_slug = ?
    //     and b.season = gi.season
    //     and b.played > 0
    //     `,
    //         [game_slug]
    //     );
    //     if (responseCnt && responseCnt.results && responseCnt.results.length > 0) {
    //         total = Number(responseCnt.results[0]?.cnt) || 0;
    //     }

    //     if (total == 0) return 0;

    //     let offset = 0;

    //     while (offset < total) {
    //         let count = 10000;
    //         if (offset + count > total) {
    //             count = total - offset;
    //         }

    //         response = await db.sql(
    //             `
    //             SELECT a.displayname as value, b.rating as score, a.countrycode
    //             FROM person a, person_rank b, game_info gi
    //             WHERE a.shortid = b.shortid
    //             AND b.game_slug = ?
    //             AND gi.game_slug = b.game_slug
    //             AND b.season = gi.game_slug
    //             AND b.played > 0
    //             LIMIT ?,?
    //         `,
    //             [game_slug, offset, count]
    //         );

    //         if (!response || !response.results || response.results.length == 0) break;

    //         let members = response.results;
    //         let redisKey = game_slug + "/rankings";

    //         let result = await redis.zadd(redisKey, members);

    //         for (let i = 0; i < response.results.length; i++) {
    //             let player = response.results[i];
    //             redis.zadd(redisKey + "/" + player.countrycode, [
    //                 { value: player.value, score: player.score },
    //             ]);
    //         }
    //         offset += count;
    //     }

    //     return total;
    // }

    async getGameLeaderboardCount(game_slug, config) {
        let redisKey = game_slug + "/rankings";
        if (config?.countrycode) redisKey += "/" + config?.countrycode;
        let count = await redis.zcount(redisKey, 0, 10000000);
        console.log("count: ", game_slug, count);
        return count;
    }

    async getPlayerGameRank(game_slug, player, config) {
        // let db = await mysql.db();
        // let sqlTop10 = await db.sql(`
        //     SELECT
        //         a.displayname,
        //         b.win,
        //         b.tie,
        //         b.loss,
        //         b.rating,
        //         a.portraitid,
        //         a.countrycode,
        //         rank.rank
        //     FROM person_rank b
        //     INNER JOIN game_info gi
        //         ON gi.game_slug = ?
        //     INNER JOIN person a
        //         ON a.shortid = b.shortid
        //     LEFT JOIN (
        //         SELECT
        //             COUNT(*) as rank
        //         FROM person_rank pr
        //         WHERE pr.rating > b.rating
        //         AND pr.season = b.season
        //     ) as rank
        //         ON pr.season = b.
        //     WHERE b.game_slug = gi.game_slug
        //     ${countrycode ? 'AND a.countrycode = ?' : ''}
        //     AND b.season = gi.season
        //     AND b.played > 0
        //     AND a.displayname = ?
        //     ORDER BY b.rating DESC
        //     LIMIT 100
        // `, [game_slug, countrycode, player]);

        let redisKey = game_slug + "/rankings";
        if (config?.countrycode) redisKey += "/" + config?.countrycode;
        let rank = await redis.zrevrank(redisKey, player);
        console.log("rank: ", game_slug, player, rank + 1);

        return rank + 1;
    }

    async getPlayerGameLeaderboard(game_slug, player, rank, config) {
        if (!rank) return [];

        let startingRank = Math.max(0, rank - 3);
        let endingRank = rank + 1;
        let redisKey = game_slug + "/rankings";
        if (config?.countrycode) redisKey += "/" + config?.countrycode;
        let rankings = await redis.zrevrange(redisKey, startingRank, endingRank);
        console.log("rankings raw: ", rankings);
        let playerPos = 1;

        let playerNames = [];
        for (var i = 0; i < rankings.length; i++) {
            playerNames.push(rankings[i].value);
            if (rankings[i].value == player) {
                // playerPos = -i;
                // break;
            }
        }
        playerPos = rank - startingRank;

        try {
            let db = await mysql.db();

            let values = [game_slug];
            if (playerNames && playerNames.length > 0) values.push(playerNames);
            if (config?.countrycode) values.push(config?.countrycode);

            let response = await db.sql(
                `
            SELECT a.displayname, b.rating, a.portraitid, a.countrycode
            FROM person_rank b
            LEFT JOIN person a
                ON a.shortid = b.shortid
            LEFT JOIN game_info gi
                ON gi.game_slug = b.game_slug
            WHERE b.game_slug = ?
            AND b.season = gi.season
            AND b.played > 0
            ${playerNames && playerNames.length > 0 ? "AND a.displayname in (?)" : ""}
            ${config?.countrycode ? " AND a.countrycode = ?" : ""}
            ORDER BY b.rating DESC
            LIMIT 30
        `,
                values
            );

            if (response.results && response.results.length == 0) {
                return [];
            }
            let players = response.results;
            let playersMap = {};
            players.forEach((p) => (playersMap[p.displayname] = p));

            let otherRank = 0;
            for (var i = 0; i < rankings.length; i++) {
                let ranker = rankings[i];
                let p = playersMap[ranker.value];
                if (!p) {
                    await redis.zrem(redisKey, [ranker.value]);
                    return await this.getPlayerGameLeaderboard(game_slug, player, rank, config);
                }
                ranker.displayname = ranker.value;
                ranker.rank = rank + (playerPos + i);
                ranker.portraitid = p.portraitid;
                ranker.countrycode = p.countrycode;
                ranker.rating = p.rating;
            }

            let prevRating = Number.MAX_VALUE;
            let currentRank = startingRank;
            for (var i = 0; i < rankings.length; i++) {
                let rating = rankings[i].rating;
                if (prevRating > rating) {
                    currentRank = startingRank + i + 1;
                    prevRating = rating;
                }
                rankings[i].rank = currentRank;
                // rankings[i].rank = (i + 1);
            }

            console.log("range: ", game_slug, rankings);
        } catch (e) {
            console.error(e);
        }

        return rankings;
    }
    async rankLeaderboard(game_slug, shortid, displayname, config) {
        try {
            let { countrycode, type } = config;
            // let db = await mysql.db();

            console.log("findGameRankGlobal: ", game_slug, shortid, displayname, config);

            let game = {};
            game.leaderboard = (await this.getRatingLeaderboard(game_slug, config)) || [];
            if (displayname) {
                let playerRank = await this.getPlayerGameRank(game_slug, displayname, config);
                game.localboard =
                    (await this.getPlayerGameLeaderboard(
                        game_slug,
                        displayname,
                        playerRank,
                        config
                    )) || [];
            } else {
                game.localboard = [];
            }
            game.total = (await this.getGameLeaderboardCount(game_slug, config)) || 0;
            return game;
        } catch (e) {
            console.error(e);
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findGameRankNational(game_slug, shortid, displayname, countrycode) {
        try {
            // let db = await mysql.db();

            console.log("findGameRankGlobal: ", game_slug, shortid, displayname, countrycode);

            let game = {};
            game.leaderboard = (await this.getRatingLeaderboard(game_slug, countrycode)) || [];
            if (displayname) {
                let playerRank = await this.getPlayerGameRank(game_slug, displayname, countrycode);
                game.localboard =
                    (await this.getPlayerGameLeaderboard(
                        game_slug,
                        displayname,
                        playerRank,
                        countrycode
                    )) || [];
            } else {
                game.localboard = [];
            }
            game.total = (await this.getGameLeaderboardCount(game_slug, countrycode)) || 0;
            return game;
        } catch (e) {
            console.error(e);
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findGameRankGlobal(game_slug, shortid, displayname) {
        try {
            // let db = await mysql.db();

            console.log("findGameRankGlobal: ", game_slug, shortid, displayname);

            let game = {};
            game.leaderboard = (await this.getRatingLeaderboard(game_slug)) || [];
            if (displayname) {
                let playerRank = await this.getPlayerGameRank(game_slug, displayname);
                game.localboard =
                    (await this.getPlayerGameLeaderboard(game_slug, displayname, playerRank)) || [];
            } else {
                game.localboard = [];
            }
            game.total = (await this.getGameLeaderboardCount(game_slug)) || 0;
            return game;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findGameRankDivision(game_slug, division_id) {
        try {
            // let db = await mysql.db();

            console.log("findGameRankDivision: ", game_slug, division_id);

            let game = {};
            game.leaderboard = (await this.getDivisionLeaderboard(game_slug, division_id)) || [];
            game.total = game.leaderboard.length;
            return game;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async getHighscoreLeaderboard(game_slug) {
        //let rankings = await redis.get(game_slug + '/top10hs');
        //if (!rankings) {
        // let rankings = await redis.zrevrange(game_slug + '/lbhs', 0, 19);

        let db = await mysql.db();
        let sqlTop10 = await db.sql(
            `
            SELECT a.displayname, b.highscore, a.portraitid, a.countrycode
            FROM person a
            LEFT JOIN person_rank b
                ON a.shortid = b.shortid
            WHERE b.game_slug = ?
            AND b.season = ?
            AND b.played > 0
            ORDER BY b.highscore DESC
            LIMIT 100
        `,
            [game_slug, 0]
        );

        let rankings = sqlTop10.results;

        if (rankings.length == 0) {
            let total = await this.updateAllHighscores(game_slug);
            if (total > 0) {
                return this.getHighscoreLeaderboard(game_slug);
            }
        }

        for (var i = 0; i < rankings.length; i++) {
            rankings[i].rank = i + 1;
        }

        //redis.set(game_slug + '/top10hs', rankings, 60);
        //}

        // console.log("getGameTop10PlayersHighscore: ", game_slug, rankings);
        return rankings;
    }

    async updateAllHighscores(game_slug) {
        let db = await mysql.db();
        var response;
        console.log("updateAllHighscores ", game_slug);

        let total = 0;
        let responseCnt = await db.sql(
            `SELECT count(*) as cnt FROM person_rank WHERE game_slug = ? and season = ? and played > 0 and highscore > 0`,
            [game_slug, 0]
        );
        if (responseCnt && responseCnt.results && responseCnt.results.length > 0) {
            total = Number(responseCnt.results[0]?.cnt) || 0;
        }

        if (total == 0) return 0;

        let offset = 0;

        while (offset < total) {
            let count = 1000;
            if (offset + count > total) {
                count = total - offset;
            }

            response = await db.sql(
                `
                SELECT a.displayname as value, b.highscore as score
                FROM person a, person_rank b
                WHERE a.shortid = b.shortid
                AND b.game_slug = ?
                AND b.season = ?
                AND b.played > 0
                AND b.highscore > 0
                LIMIT ?,?
            `,
                [game_slug, 0, offset, count]
            );

            if (!response || !response.results || response.results.length == 0) break;

            let members = response.results;
            let result = await redis.zadd(game_slug + "/lbhs", members);
            offset += count;
        }

        return total;
    }

    async getGameLeaderboardCountHighscore(game_slug) {
        let count = await redis.zcount(game_slug + "/lbhs", 0, 10000000);
        console.log("count: ", game_slug, count);
        return count;
    }

    async getPlayerGameHighscore(game_slug, player) {
        let highscore = await redis.zrevrank(game_slug + "/lbhs", player);
        console.log("highscore: ", game_slug, player, highscore);

        return highscore;
    }

    async getPlayerGameLeaderboardHighscore(game_slug, player, rank) {
        if (!rank) return [];
        let rankings = await redis.zrevrange(game_slug + "/lbhs", Math.max(0, rank - 1), rank + 1);
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
            rankings[i].rank = rank + (playerPos + i + 1);
        }

        console.log("highscore range: ", game_slug, rankings);

        return rankings;
    }

    async findGameLeaderboardHighscore(game_slug, shortid, displayname) {
        try {
            // let db = await mysql.db();

            console.log("findGameLeaderboardHighscore: ", game_slug, shortid, displayname);

            let game = {};
            game.leaderboard = (await this.getHighscoreLeaderboard(game_slug, countrycode)) || [];
            if (displayname) {
                let playerRank = await this.getPlayerGameHighscore(
                    game_slug,
                    displayname,
                    countrycode
                );
                game.localboard =
                    (await this.getPlayerGameLeaderboardHighscore(
                        game_slug,
                        displayname,
                        playerRank,
                        countrycode
                    )) || [];
            } else {
                game.localboard = [];
            }
            game.total = (await this.getGameLeaderboardCountHighscore(game_slug, countrycode)) || 0;

            // let game = {};
            // game.top10hs = (await this.getHighscoreLeaderboard(game_slug)) || [];
            // if (displayname) {
            //     let playerRank = await this.getPlayerGameHighscore(game_slug, displayname);
            //     if (playerRank) {
            //         game.lbhs =
            //             (await this.getPlayerGameLeaderboardHighscore(
            //                 game_slug,
            //                 displayname,
            //                 playerRank
            //             )) || [];
            //     } else {
            //         game.lbhs = [];
            //     }
            // } else {
            //     game.lbhs = [];
            // }
            // game.lbhsCount = (await this.getGameLeaderboardCountHighscore(game_slug)) || 0;
            return game;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }
}

module.exports = new LeaderboardService();
