const MySQL = require("./mysql");
const mysql = new MySQL();

const credutil = require("../util/credentials");
const { genUnique64string } = require("../util/idgen");
const { utcDATETIME } = require("../util/datefns");
const { GeneralError, CodeError, SQLError } = require("../util/errorhandler");

const cache = require("./cache");
const redis = require("./redis");

module.exports = class GameService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
    }

    async reportGame(game_slug, shortid, report) {
        try {
            let db = await mysql.db();
            if (report == 0) report = null;
            const { results, fields } = await db.insertBatch(
                "game_review",
                [{ game_slug, shortid, report }],
                ["game_slug", "shortid"]
            );
            return results;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async rateGame(game_slug, shortid, vote, previousVote) {
        try {
            let db = await mysql.db();
            const { results, fields } = await db.insertBatch(
                "game_review",
                [{ game_slug, shortid, vote: vote ? 1 : -1 }],
                ["game_slug", "shortid"]
            );

            let key = game_slug + "/votes";
            let votes = (await cache.get(key)) || 0;

            if (previousVote != null && typeof previousVote !== "undefined") {
                let likeToDislike = previousVote && !vote;
                let dislikeToLike = !previousVote && vote;

                if (likeToDislike) {
                    votes -= 2;
                } else if (dislikeToLike) {
                    votes += 2;
                }
            } else {
                if (vote) votes += 1;
                else votes -= 1;
            }

            cache.set(key, votes);

            return votes;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    ratingToRank(rating) {
        let ranks = [
            "Wood I",
            "Wood II",
            "Wood III",
            "Wood IV",
            "Bronze I",
            "Bronze II",
            "Bronze III",
            "Bronze IV",
            "Silver I",
            "Silver II",
            "Silver III",
            "Silver IV",
            "Gold I",
            "Gold II",
            "Gold III",
            "Gold IV",
            "Platinum I",
            "Platinum II",
            "Platinum III",
            "Platinum IV",
            "Champion I",
            "Champion II",
            "Champion III",
            "Champion IV",
            "Grand Champion I",
            "Grand Champion II",
            "Grand Champion III",
            "Grand Champion IV",
        ];

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
        } catch (e) {
            if (e instanceof GeneralError) throw e;
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
                    cur.css AS css,
                    cur.screentype as screentype,
                    cur.resow as resow,
                    cur.resoh as resoh,
                    cur.screenwidth as screenwidth,
                    latest.screentype as latest_screentype,
                    latest.resow as latest_resow,
                    latest.resoh as latest_resoh,
                    latest.screenwidth as latest_screenwidth,
                    latest.db as latest_db,
                    latest.css AS latest_css,
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
                if (typeof queueCounts[game.game_slug] !== "undefined")
                    game.queueCount = queueCounts[game.game_slug];
                else game.queueCount = 0;
            }

            return games;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async findGameReplays(game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting game replay: ", game_slug);
            response = await db.sql(
                `
                SELECT a.version, a.mode, a.filename, c.screentype, c.resow, c.resoh, c.screenwidth, c.css
                FROM game_match a, game_info b, game_version c
                WHERE a.game_slug = ?
                AND a.game_slug = b.game_slug 
                AND b.gameid = c.gameid
                AND b.version = c.version
                ORDER BY a.tsupdate DESC
                LIMIT 100
            `,
                [game_slug]
            );

            if (!response.results) {
                return [];
            }

            return response.results;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findGame(game_slug, ignoreExtra) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting game: ", game_slug);
            response = await db.sql(
                `
                SELECT 
                    b.shortid, b.displayname, b.github,
                    a.*,
                    current.screentype as screentype,
                    current.resow as resow,
                    current.resoh as resoh,
                    current.screenwidth as screenwidth,
                    current.db as db,
                    current.css AS css,
                    latest.screentype as latest_screentype,
                    latest.resow as latest_resow,
                    latest.resoh as latest_resoh,
                    latest.screenwidth as latest_screenwidth,
                    latest.db as latest_db,
                    latest.css AS latest_css
                FROM game_info a, person b, game_version current, game_version latest
                WHERE a.game_slug = ?
                AND a.ownerid = b.id
                AND (a.gameid = current.gameid AND a.version = current.version)
                AND (a.gameid = latest.gameid AND a.latest_version = latest.version)
                AND a.visible != 2
            `,
                [game_slug]
            );

            if (response.results && response.results.length == 0) {
                return null;
            }
            let game = response.results[0];
            console.log("Game Found: ", game.game_slug); //JSON.stringify(game, null, 2));

            if (ignoreExtra) return { game };

            game.votes = await this.findGameVotes(game_slug);

            return game;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findGameVotes(game_slug) {
        try {
            let votes = await cache.get(game_slug + "/votes");
            if (votes != null && typeof votes !== "undefined") {
                return votes;
            }

            let db = await mysql.db();
            var response;
            console.log("Getting game votes: ", game_slug);
            response = await db.sql(
                `
                SELECT 
                    coalesce(b.likes,0) as likes, 
                    coalesce(c.dislikes,0) as dislikes
                FROM game_info a
                LEFT JOIN (SELECT count(*) as likes, game_slug FROM game_review WHERE game_slug = ? AND vote = 1 GROUP BY game_slug) b
                    ON a.game_slug = b.game_slug
                LEFT JOIN (SELECT count(*) as dislikes, game_slug FROM game_review WHERE game_slug = ? and vote = -1 GROUP BY game_slug) c
                    ON a.game_slug = c.game_slug
                WHERE a.game_slug = ?
                `,
                [game_slug, game_slug, game_slug]
            );

            if (response.results && response.results.length == 0) {
                return 0;
            }
            let result = response.results[0];
            if (result) {
                let votes = Number(result.likes) - Number(result.dislikes);
                cache.set(game_slug + "/votes", votes, 60);
                return votes;
            }

            return 0;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findGameTeams(game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting game teams: ", game_slug);
            response = await db.sql(
                `
                SELECT * FROM game_team a
                WHERE a.game_slug = ?
                `,
                [game_slug]
            );

            if (response.results && response.results.length == 0) {
                return [];
            }

            return response.results;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async updateVotes(game_slug, votes) {}

    async getAllGamesQueueCount() {
        try {
            let queues = await cache.getLocal("queueCount");
            if (!queues) {
                queues = await redis.hgetall("queueCount");
                cache.setLocal("queueCount", queues, 5);
            }
            console.log("queues=", queues);
            return queues;
        } catch (e) {
            console.error(e);
            return {};
        }
    }
    async getGameQueueCount(game_slug) {
        try {
            let queueCount = await redis.hget("queueCount", game_slug);
            console.log(game_slug, "queueCount=", queueCount);
            return Number.parseInt(queueCount);
        } catch (e) {
            console.error(e);
            return 0;
        }
    }

    async findGamePerson(game_slug, shortid, displayname) {
        try {
            let db = await mysql.db();
            var response;
            console.log(
                "Getting game with person stats: ",
                game_slug,
                shortid,
                displayname
            );
            response = await db.sql(
                `
                SELECT 
                cur.db as db,
                cur.css AS css,
                cur.screentype as screentype,
                cur.resow as resow,
                cur.resoh as resoh,
                cur.screenwidth as screenwidth,
                latest.screentype as latest_screentype,
                latest.resow as latest_resow,
                latest.resoh as latest_resoh,
                latest.screenwidth as latest_screenwidth,
                latest.db as latest_db,
                latest.css AS latest_css,
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
                a.*,
                dv.division_id,
                dv.season as division_season,
                dv.division_name,
                dv.player_count as division_playercount
                FROM game_info a
                LEFT JOIN person d ON (d.id = a.ownerid)
                LEFT JOIN game_version cur ON (cur.gameid = a.gameid AND cur.version = a.version)
                LEFT JOIN game_version latest ON (latest.gameid = a.gameid AND latest.version = a.latest_version)
                LEFT JOIN person_rank c ON (c.shortid = ? AND c.game_slug = a.game_slug  AND c.season = a.season)
                LEFT JOIN game_review b ON (b.game_slug = a.game_slug AND b.shortid = c.shortid)
                LEFT JOIN division dv ON (dv.game_slug = c.game_slug AND dv.division_id = c.division)
                WHERE a.game_slug = ?
                AND a.ownerid = d.id
                AND (a.gameid = latest.gameid AND a.latest_version = latest.version)
                AND a.visible != 2
            `,
                [shortid, game_slug]
            );

            if (response.results && response.results.length == 0) {
                return new GeneralError("E_NOTFOUND");
            }

            let game = response.results[0];
            game.votes = await this.findGameVotes(game_slug);
            game.queueCount = (await this.getGameQueueCount(game_slug)) || 0;

            let cleaned = {
                game: {
                    gameid: game.gameid,
                    game_slug: game.game_slug,
                    name: game.name,
                    season: game.season,
                    division_id: game.division_id,
                    division_name: game.division_name,
                    division_season: game.division_season,
                    division_playercount: game.division_playercount,
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
                    vote: game.vote,
                    report: game.report,
                    win: game.win,
                    loss: game.loss,
                    tie: game.tie,
                    played: game.played,
                },
            };

            return cleaned;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }
};
