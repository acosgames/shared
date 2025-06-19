const MySQL = require("./mysql");
const mysql = new MySQL();

const credutil = require("../util/credentials");
const { genUnique64string } = require("../util/idgen");
const { utcDATETIME } = require("../util/datefns");
const { GeneralError, CodeError, SQLError } = require("../util/errorhandler");

const cache = require("./cache");
const redis = require("./redis");

const stats = require("./stats");

/**
 * Lets build a leaderboard
 * Types of leaderboards: Division, Global Rank, National Rank, Global Score, National Score, and Stats
 * Modifiers for Division: none
 * Modifiers for National Rank: Season
 * Modifiers for Global Rank: Season
 * Modifiers for High Score: Monthly, All Time
 * Modifiers for Individual Stat: Monthly, All Time
 * Modifiers for Global Stat: Monthly, All Time
 *
 * Leaderboards on Redis:
 * - Global Rank -- Season
 * - National Rank -- Season
 * - High Score -- Monthly, All Time
 */

class LeaderboardService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
    }

    createRedisKey(config) {
        // if (config?.redisKey) return config?.redisKey;
        let key = ["lb"];
        if (!config?.type) config.type = "rank";
        key.push(config.type);

        if (config?.game_slug) key.push(config.game_slug);
        if (config?.countrycode) key.push(config.countrycode);
        if (typeof config?.season === "number") key.push("S" + config.season);
        if (config?.stat_slug) key.push(config.stat_slug);
        if (config?.division_id) key.push(config.division_id);
        if (config?.monthly) {
            let now = new Date();
            key.push(now.getUTCFullYear() + "" + now.getUTCMonth());
        }

        config.redisKey = key.join("/");
        return config.redisKey;
    }

    async verifyRedisLeaderboard(config) {
        this.createRedisKey(config);

        let redisRankings = await redis.zrevrange(config.redisKey, 0, 1);
        if (redisRankings.length == 0) {
            let total = await this.fullRedisLeaderboardUpdate(config);
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
        this.createRedisKey(config);

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

    async getLeaderboard(config) {
        if (config?.countrycode == "EARTH") {
            delete config.countrycode;
        }

        // if (config?.season == -2) {
        //     config.alltime = true;
        //     delete config.season;
        // } else if (config?.season == -1) {
        //     config.monthly = true;
        //     delete config.season;
        // } else if (config?.season >= 0) {
        // }

        this.createRedisKey(config);

        let leaderboard = { leaderboard: [], localboard: [], total: 0 };
        switch (config.type) {
            case "divisionmulti":
                leaderboard = await this.getDivisionLeaderboard(config);
                break;
            case "divisionsolo":
                leaderboard = await this.getDivisionSoloLeaderboard(config);
                break;
            case "rank":
                leaderboard = await this.getRankLeaderboard(config);
                break;
            case "score":
                leaderboard = await this.getHighscoreLeaderboard(config);
                break;
            case "stat":
                leaderboard = await this.getStatLeaderboard(config);
                break;
        }

        return leaderboard;
    }

    async getDivisionSoloLeaderboard(config) {
        let db = await mysql.db();
        let response = await db.sql(
            `
            SELECT 
            a.displayname, 
            psg.bestINT as highscore,
             a.portraitid, 
             a.countrycode
            FROM  person_stat_global psg
            INNER JOIN game_info gi ON gi.game_slug = psg.game_slug
            INNER JOIN person a ON a.shortid = psg.shortid
            INNER JOIN person_rank pr ON a.shortid = pr.shortid AND pr.game_slug = psg.game_slug
            WHERE psg.game_slug = ?
            AND psg.season = gi.season
            AND psg.stat_slug = 'ACOS_SCORE'
            AND pr.division = ?
            ORDER BY psg.bestINT DESC
            LIMIT ${config.limit || "100"} 
        `,
            [config?.game_slug, config?.division_id]
        );

        //division rating algorithm, its made up
        let rankings = response.results;
        // for (let ranker of rankings) {
        //     let total = ranker.win + ranker.tie + ranker.loss;
        //     ranker.winrating =
        //         ((ranker.win + 0.5 * ranker.tie) / total) * (ranker.win - ranker.loss * 2);
        // }

        //sort based on winrating
        rankings.sort((a, b) => b.highscore - a.highscore);

        //update to rank for ties
        let prevRating = Number.MAX_VALUE;
        let currentRank = 1;
        for (var i = 0; i < rankings.length; i++) {
            let rating = rankings[i].highscore;
            if (prevRating > rating) {
                currentRank = i + 1;
                prevRating = rating;
            }
            rankings[i].rank = currentRank;
        }

        return { leaderboard: rankings, localboard: [], total: rankings.length };
    }

    async getDivisionLeaderboard(config) {
        let db = await mysql.db();
        let response = null;

        response = await db.sql(
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
            INNER JOIN game_info gi ON gi.game_slug = b.game_slug
            INNER JOIN person a ON a.shortid = b.shortid
            WHERE b.game_slug = ?
            AND b.season = gi.season
            AND b.played > 0
            AND b.division = ?
            LIMIT ${config.limit || "100"} 
        `,
            [config?.game_slug, config?.division_id || 0]
        );

        //division rating algorithm, its made up
        let rankings = response.results;
        for (let ranker of rankings) {
            let total = ranker.win + ranker.tie + ranker.loss;
            ranker.winrating = ranker.win * 2 + 0.5 * ranker.tie - ranker.loss;
        }

        //sort based on winrating
        rankings.sort((a, b) => b.winrating - a.winrating);

        //update to rank for ties
        let prevRating = Number.MAX_VALUE;
        let currentRank = 1;
        for (var i = 0; i < rankings.length; i++) {
            let rating = rankings[i].winrating;
            if (prevRating > rating) {
                currentRank = i + 1;
                prevRating = rating;
            }
            rankings[i].rank = currentRank;
        }

        return { leaderboard: rankings, localboard: [], total: rankings.length };
    }

    async getRankLeaderboard(config) {
        let db = await mysql.db();

        let values = [config?.game_slug];
        if (config?.countrycode) values.push(config.countrycode);
        if (typeof config?.season === "number") values.push(config.season);
        let response = await db.sql(
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
            ${typeof config?.season === "number" ? "AND b.season = ?" : "AND b.season = gi.season"}
            AND b.played > 0
            ORDER BY b.rating DESC
            LIMIT ${config.limit || "100"} 
        `,
            values
        );

        let rankings = response.results;

        //make sure we have redis leaderboard, for checking individual players
        if (!(await this.verifyRedisLeaderboard(config))) {
            return await this.getRankLeaderboard(config);
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
        }

        let localboard = [];
        if (config?.displayname) {
            let player = rankings.find((p) => p.displayname == config.displayname);
            if (!player && rankings < config?.limit) {
                localboard = await this.getRedisPlayerRelativeLeaderboard(config, player);
            }
        }

        let total = rankings.length;
        if (rankings.length >= 100) total = await this.getRedisLeaderboardCount(config);

        return { leaderboard: rankings, localboard: [], total };
    }

    async getRedisPlayerRelativeLeaderboard(config, player) {
        this.createRedisKey(config);

        let rank = await redis.zrevrank(config.redisKey, config?.displayname);
        console.log("REDIS player rank: ", config?.game_slug, player, rank + 1);

        if (typeof rank !== "number") return [];

        config.startRank = Math.max(0, rank - 3);
        config.endRank = rank + 1;

        let rankings = await redis.zrevrange(config.redisKey, config.startRank, config.endRank);
        console.log("REDIS range rank: ", config.startRank, config.endRank, rankings);

        //create a list of the player names from redis
        let playerPos = 1;
        let playerNames = [];
        for (var i = 0; i < rankings.length; i++) {
            playerNames.push(rankings[i].value);
        }
        playerPos = rank - config.startRank;

        try {
            let db = await mysql.db();
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
            ORDER BY b.rating DESC
            LIMIT 30
        `,
                [config?.game_slug, playerNames]
            );

            if (response.results && response.results.length == 0) {
                return [];
            }

            //create a map of players data from mysql
            let players = response.results;
            let playersMap = {};
            players.forEach((p) => (playersMap[p.displayname] = p));

            //create the ranking profile for each player
            for (var i = 0; i < rankings.length; i++) {
                let ranker = rankings[i];
                let p = playersMap[ranker.value];
                if (!p) {
                    //delete players who don't exist, don't await
                    redis.zrem(redisKey, [ranker.value]);
                    continue;
                }
                ranker.displayname = ranker.value;
                ranker.rank = rank + (playerPos + i);
                ranker.portraitid = p.portraitid;
                ranker.countrycode = p.countrycode;
                ranker.rating = p.rating;
            }

            //fix the ranking order
            let prevRating = Number.MAX_VALUE;
            let currentRank = config.startRank;
            for (var i = 0; i < rankings.length; i++) {
                let rating = rankings[i].rating;
                if (prevRating > rating) {
                    currentRank = config.startRank + i + 1;
                    prevRating = rating;
                }
                rankings[i].rank = currentRank;
            }

            console.log("range: ", config?.game_slug, rankings);
        } catch (e) {
            console.error(e);
        }

        return rankings;
    }

    async getRedisLeaderboardCount(config) {
        this.createRedisKey(config);
        let count = await redis.zcount(config.redisKey, 0, 10000000);
        console.log("REDIS leaderboard count: ", config.redisKey, count);
        return count;
    }

    formatDateForMySQL(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    getMySQLMonthRange() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startDate = this.formatDateForMySQL(startOfMonth);
        const endDate = this.formatDateForMySQL(endOfMonth);
        return { startDate, endDate };
    }

    async getHighscoreLeaderboard(config) {
        let db = await mysql.db();
        let response = null;

        if (!config.aggregate && config?.monthly) {
            const { startDate, endDate } = this.getMySQLMonthRange();

            let value = [config?.game_slug];
            if (config?.countrycode) value.push(config.countrycode);
            if (!config?.monthly && typeof config?.season === "number") value.push(config.season);
            // if( config?.monthly ) value.push(config.countrycode);
            response = await db.sql(
                `
              SELECT a.displayname, max(psm.valueINT) as highscore, a.portraitid, a.countrycode
            FROM person_stat_match psm
            INNER JOIN person a ON a.shortid = psm.shortid
            WHERE psm.game_slug = ?
            AND psm.stat_slug = 'ACOS_SCORE'
            ${config?.countrycode ? "AND a.countrycode = ?" : ""}
            ${!config?.monthly && typeof config?.season === "number" ? "AND psm.season = ?" : ""}
            ${config?.monthly ? `AND psm.tsinsert BETWEEN '${startDate}' AND '${endDate}'` : ``}
            GROUP BY a.displayname, a.portraitid, a.countrycode
            ORDER BY max(psm.valueINT) DESC
            LIMIT ${config.limit || "100"}  
        `,
                value
            );
        } else {
            let value = [config?.game_slug];
            if (config?.countrycode) value.push(config.countrycode);
            if (typeof config?.season === "number") value.push(config.season);
            response = await db.sql(
                `
            SELECT 
            a.displayname, 
            ${config.aggregate ? "psg.valueINT as highscore," : "psg.bestINT as highscore,"}
             a.portraitid, 
             a.countrycode
            FROM person a
            LEFT JOIN person_stat_global psg
                ON a.shortid = psg.shortid
            WHERE psg.game_slug = ?
            ${config?.countrycode ? "AND a.countrycode = ?" : ""}
            ${typeof config?.season === "number" ? "AND psg.season = ?" : ""}
            AND psg.stat_slug = 'ACOS_SCORE'
            ${config.aggregate ? "ORDER BY psg.valueINT DESC" : "ORDER BY psg.bestINT DESC"}
            LIMIT ${config.limit || "100"} 
        `,
                value
            );
        }

        let rankings = response.results;

        if (!(await this.verifyRedisLeaderboard(config))) {
            return await this.getHighscoreLeaderboard(config);
        }

        for (var i = 0; i < rankings.length; i++) {
            rankings[i].rank = i + 1;
        }

        let localboard = [];
        if (config?.displayname) {
            let player = rankings.find((p) => p.displayname == config.displayname);
            if (!player) {
                localboard = await this.getRedisPlayerRelativeLeaderboard(config);
            }
        }

        let total = await this.getRedisLeaderboardCount(config);

        // console.log("getGameTop10PlayersHighscore: ", game_slug, rankings);

        return { leaderboard: rankings, localboard: [], total };
    }

    async getStatLeaderboard(config) {
        let db = await mysql.db();
        let response = null;
        let playerResponse = null;
        let rankings = [];
        let statDefs = await stats.getGameStats(config?.game_slug, config?.is_solo);
        if (!config?.stat_slug || !statDefs || statDefs.length == 0) return [];

        let statDef = statDefs.find((stat) => stat.stat_slug == config?.stat_slug);
        if (!statDef) return [];

        let valueType = "INT";
        if (statDef.valueTYPE == 1 || statDef.valueTYPE == 2) valueType = "FLOAT";

        if (!config.aggregate && config?.season == -1) {
            const { startDate, endDate } = this.getMySQLMonthRange();
            let sql = `
            SELECT a.displayname, max(psm.value${valueType}) as value, a.portraitid, a.countrycode
                FROM person_stat_match psm
                INNER JOIN person a ON a.shortid = psm.shortid
                WHERE psm.game_slug = ?
                AND psm.stat_slug = ?
                ${
                    config?.season == -1
                        ? `AND psm.tsinsert BETWEEN '${startDate}' AND '${endDate}'`
                        : ``
                }
                ${config?.countrycode ? "AND a.countrycode = ?" : ""}
                GROUP BY a.displayname, a.portraitid, a.countrycode
                ORDER BY value DESC
                LIMIT ${config.limit || "100"} 
            `;
            response = await db.sql(sql, [
                config?.game_slug,
                config?.stat_slug,
                config?.countrycode,
            ]);

            rankings = response.results;

            let playerFound = rankings.find((p) => p.displayname == config?.displayname);
            if (!playerFound) {
                playerResponse = await db.sql(
                    `
                SELECT a.displayname, max(psm.value${valueType}) as value, a.portraitid, a.countrycode
                FROM person_stat_match psm
                INNER JOIN person a ON a.shortid = psm.shortid
                WHERE psm.game_slug = ?
                AND psm.stat_slug = ?
                AND a.displayname = ?
                ${config?.countrycode ? "AND a.countrycode = ?" : ""}
                ${
                    config?.season == -1
                        ? `AND psm.tsinsert BETWEEN '${startDate}' AND '${endDate}'`
                        : ``
                }
                GROUP BY a.displayname, a.portraitid, a.countrycode
                ORDER BY value DESC
        `,
                    [config?.game_slug, config?.stat_slug, config?.displayname, config?.countrycode]
                );

                if (playerResponse?.results?.length > 0) {
                    rankings = rankings.concat(playerResponse.results);
                }
            }
        } else {
            let values = [config?.game_slug, config?.stat_slug];

            if (config?.countrycode) {
                values.push(config.countrycode);
            }
            if (config?.season >= 0) values.push(config.season);
            let sql = `
            SELECT 
                a.displayname, 
                ${
                    config.aggregate
                        ? `psg.value${valueType} as value,`
                        : `psg.best${valueType} as value,`
                }
                a.portraitid, 
                a.countrycode
            FROM person a
            LEFT JOIN person_stat_global psg
                ON a.shortid = psg.shortid
            WHERE psg.game_slug = ?
            AND psg.stat_slug = ?
             ${config?.countrycode ? "AND a.countrycode = ?" : ""}
            ${config?.season >= 0 ? "AND psg.season = ?" : ""}
            ${
                config.aggregate
                    ? `ORDER BY psg.value${valueType} DESC`
                    : `ORDER BY psg.best${valueType} DESC`
            }
            LIMIT ${config.limit || "100"} 
        `;
            response = await db.sql(sql, values);

            rankings = response.results;

            let playerFound = rankings.find((p) => p.displayname == config?.displayname);
            if (!playerFound) {
                values = [config?.game_slug, config?.stat_slug, config?.displayname];
                if (config?.countrycode) {
                    values.push(config.countrycode);
                }
                if (config?.season >= 0) values.push(config.season);

                playerResponse = await db.sql(
                    `
                    SELECT 
                        a.displayname, 
                        ${
                            config.aggregate
                                ? `psg.value${valueType} as value,`
                                : `psg.best${valueType} as value,`
                        }
                        a.portraitid, 
                        a.countrycode
                    FROM person a
                    LEFT JOIN person_stat_global psg
                        ON a.shortid = psg.shortid
                    WHERE psg.game_slug = ?
                    AND psg.stat_slug = ?
                    AND a.displayname = ?
                     ${config?.countrycode ? "AND a.countrycode = ?" : ""}
                    ${typeof config?.season === "number" ? "AND psg.season = ?" : ""}
                    ${
                        config.aggregate
                            ? `ORDER BY psg.value${valueType} DESC`
                            : `ORDER BY psg.best${valueType} DESC`
                    }
                `,
                    values
                );

                if (playerResponse?.results?.length > 0) {
                    rankings = rankings.concat(playerResponse.results);
                }
            }
        }

        // if (!(await this.verifyRedisLeaderboard(config))) {
        //     return await this.getStatLeaderboard(config);
        // }

        for (var i = 0; i < rankings.length; i++) {
            rankings[i].rank = i + 1;
        }

        console.log("Stat Leaderboard: ", config);

        return { leaderboard: rankings, localboard: [], total: rankings.length };
    }

    async updateLeaderboard(config, players) {
        try {
            this.createRedisKey(config);

            let members = [];
            for (var id in players) {
                let player = players[id];

                let member = { value: player.displayname };
                switch (config.type) {
                    case "rank":
                        member.score = player.rating;
                        break;
                    case "score":
                        member.score = player.score;
                        break;
                }
                members.push(member);

                if (config.type == "rank") {
                    let playerConfig = structuredClone(config);
                    playerConfig.countrycode = player.countrycode;
                    this.createRedisKey(playerConfig);

                    redis.zadd(playerConfig.redisKey, [member]);
                }
            }

            let result = await redis.zadd(config.redisKey, members);
            console.log(result);

            //add to monthly
            if (config.type == "score") {
                config.monthly = true;
                this.createRedisKey(config);
                result = await redis.zadd(config.redisKey, members);
            }

            return result;
        } catch (e) {
            console.error(e);
        }
        return false;
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
        and b.played > 0
        `,
            [config.game_slug, config.season]
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
                AND b.played > 0
                LIMIT ?,?
            `,
                values
            );

            if (!response || !response.results || response.results.length == 0) break;
            let result = await redis.zadd(config.redisKey, response.results);
            offset += count;
        }

        return total;
    }

    async getAllHighScores(config) {
        let db = await mysql.db();
        var response;
        console.log("updateAllHighscores ", config?.game_slug);

        let total = 0;
        if (!config.aggregate && config?.monthly) {
            const { startDate, endDate } = this.getMySQLMonthRange();
            response = await db.sql(
                `
                SELECT count(*) as cnt FROM (
              SELECT a.displayname, max(psm.valueINT) as highscore, a.portraitid, a.countrycode
            FROM person_stat_match psm
            INNER JOIN person a ON a.shortid = psm.shortid
            WHERE psm.game_slug = ?
            AND psm.stat_slug = 'ACOS_SCORE'
            ${!config?.monthly && typeof config?.season === "number" ? "AND psm.season = ?" : ""}
            ${config?.monthly ? `AND psm.tsinsert BETWEEN '${startDate}' AND '${endDate}'` : ``}
            GROUP BY a.displayname, a.portraitid, a.countrycode
            ORDER BY max(psm.valueINT) DESC
            ) count
        `,
                [config?.game_slug, config?.season]
            );
        } else {
            response = await db.sql(
                `
                SELECT COUNT(*) as cnt FROM (
            SELECT 
            a.displayname, 
            ${config.aggregate ? "psg.valueINT as highscore," : "psg.bestINT as highscore,"}
             a.portraitid, 
             a.countrycode
            FROM person a
            LEFT JOIN person_stat_global psg
                ON a.shortid = psg.shortid
            WHERE psg.game_slug = ?
            ${typeof config?.season === "number" ? "AND psg.season = ?" : ""}
            AND psg.stat_slug = 'ACOS_SCORE'
            ${config.aggregate ? "ORDER BY psg.valueINT DESC" : "ORDER BY psg.bestINT DESC"}
            ) count
        `,
                [config?.game_slug, config?.season]
            );
        }

        if (response?.results?.length > 0) {
            total = Number(response.results[0]?.cnt) || 0;
        }

        if (total == 0) return 0;

        let offset = 0;

        while (offset < total) {
            let count = 1000;
            if (offset + count > total) {
                count = total - offset;
            }

            let values = [config.game_slug, config.season];

            values.push(offset);
            values.push(count);

            if (!config.aggregate && config?.monthly) {
                const { startDate, endDate } = this.getMySQLMonthRange();
                response = await db.sql(
                    `
                  SELECT a.displayname as value, max(psm.valueINT) as score
                FROM person_stat_match psm
                INNER JOIN person a ON a.shortid = psm.shortid
                WHERE psm.game_slug = ?
                AND psm.stat_slug = 'ACOS_SCORE'
                ${
                    !config?.monthly && typeof config?.season === "number"
                        ? "AND psm.season = ?"
                        : ""
                }
                ${config?.monthly ? `AND psm.tsinsert BETWEEN '${startDate}' AND '${endDate}'` : ``}
                GROUP BY a.displayname, a.portraitid, a.countrycode
                ORDER BY max(psm.valueINT) DESC
                LIMIT ${config.limit || "100"}  
            `,
                    [config?.game_slug, config?.season]
                );
            } else {
                response = await db.sql(
                    `
                SELECT 
                a.displayname as value, 
                ${config.aggregate ? "psg.valueINT as score" : "psg.bestINT as score"}
                FROM person a
                LEFT JOIN person_stat_global psg
                    ON a.shortid = psg.shortid
                WHERE psg.game_slug = ?
                ${typeof config?.season === "number" ? "AND psg.season = ?" : ""}
                AND psg.stat_slug = 'ACOS_SCORE'
                ${config.aggregate ? "ORDER BY psg.valueINT DESC" : "ORDER BY psg.bestINT DESC"}
                LIMIT ${config.limit || "100"} 
            `,
                    [config?.game_slug, config?.season]
                );
            }

            if (!response || !response.results || response.results.length == 0) break;

            let result = await redis.zadd(config.redisKey, response.results);
            offset += count;
        }

        return total;
    }

    // async getRatingLeaderboardRedis({ game_slug, countrycode, season }) {
    //     season = season || 0;

    //     let redisKey = game_slug + "/rankings";

    //     // redisKey += '/' + season;
    //     if (countrycode) redisKey += "/" + countrycode;

    //     let redisRankings = await redis.zrevrange(redisKey, 0, 100);

    //     let displaynames = redisRankings.map((r) => r.value);

    //     let db = await mysql.db();
    //     let sqlTop10 = await db.sql(
    //         `
    //         SELECT
    //             a.displayname,
    //             b.win,
    //             b.tie,
    //             b.loss,
    //             b.rating,
    //             a.portraitid,
    //             a.countrycode
    //         FROM person_rank b
    //         INNER JOIN game_info gi
    //             ON gi.game_slug = ?
    //         INNER JOIN person a
    //             ON a.shortid = b.shortid
    //         WHERE b.game_slug = gi.game_slug
    //         ${countrycode ? "AND a.countrycode = ?" : ""}
    //         AND b.season = ?
    //         AND b.played > 0
    //         AND a.displayname IN (?)
    //     `,
    //         [game_slug, countrycode, season, displaynames]
    //     );

    //     let playerMapping = {};
    //     sqlTop10.results.map((p) => (playerMapping[p.displayname] = p));

    //     let leaderboard = [];
    //     redisRankings.map((r, index) => {
    //         playerMapping[r.value].rank = index + 1;
    //         leaderboard.push(playerMapping[r.value]);
    //     });

    //     return leaderboard;
    // }

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

    async getPlayerGameLeaderboard(config) {
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
            game.leaderboard = (await this.getRankLeaderboard(game_slug, config)) || [];
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
            game.leaderboard = (await this.getRankLeaderboard(game_slug, countrycode)) || [];
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
            game.leaderboard = (await this.getRankLeaderboard(game_slug)) || [];
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
