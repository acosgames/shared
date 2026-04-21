import MySQL from "./mysql.js";
const mysql = new MySQL();

import credutil from "../util/credentials.js";
import { genUnique64string  } from "../util/idgen.js";
import { utcDATETIME  } from "../util/datefns.js";
import { GeneralError, CodeError, SQLError  } from "../util/errorhandler.js";
import person from "./person.js";// const person = new PersonService();

import cache from "./cache.js";
import redis from "./redis.js";
import achievements from "./achievements.js";
import stats from "./stats.js";

import { Game, GameVersion, GameReplay, GameTeam, PlayerGameRank, DeveloperGameSimple } from "../types/game.js";
import { MySQLConfig, MySQL_DB } from "../types/mysql.js";
import { GameRoom, PlayerGameRoom, PlayerGameRoomExtended, GameRoomMeta, RoomMeta } from "../types/room.js";
import { PlayerGameRating } from "../types/rating.js";

class GameService {
    constructor(credentials?:any) {
        this.credentials = credentials || credutil();
    }

    async reportGame(game_slug: string, shortid: string, report: number | null): Promise<any> {
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

    async rateGame(game_slug: string, shortid: string, vote: boolean, previousVote: boolean | null): Promise<number> {
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

    ratingToRank(rating: number): string {
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

    async getGameSiteMap(): Promise<{ game_slug: string }[]> {
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

    async findGames(): Promise<Game[]> {
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

            let games: Game[] = response.results;

            let queueCounts: Record<string, number> = await this.getAllGamesQueueCount();
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

    async findGameReplays(game_slug: string): Promise<GameReplay[]> {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting game replay: ", game_slug);
            response = await db.sql(
                `
                SELECT a.version, a.mode, a.room_slug, c.screentype, c.resow, c.resoh, c.screenwidth, c.css
                FROM game_room a, game_info b, game_version c
                WHERE a.game_slug = ?
                AND b.game_slug = a.game_slug
                AND b.gameid = c.gameid 
                AND c.version = a.version
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

    async findGame(game_slug: string, ignoreExtra: boolean = false): Promise<Game | null> {
        try {
            let cachedGame = await cache.get("game/" + game_slug);
            if (cachedGame) {
                return cachedGame;
            }

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
                    current.settings as settings,
                    current.protocol as protocol,
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

            if (ignoreExtra) return game;

            game.votes = await this.findGameVotes(game_slug);

            game.stats = await stats.getGameStats(game_slug, game.maxplayers == 1);
            game.achievements = await achievements.getAchievementDefinitions(game_slug, game.stats);

            cache.set("game/" + game_slug, game);

            return game;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findGameVotes(game_slug: string): Promise<number> {
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

    async findGameTeams(game_slug: string): Promise<GameTeam[]> {
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

            return response.results as GameTeam[];
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async updateVotes(game_slug: string, votes: number): Promise<void> {}

    async getAllGamesQueueCount(): Promise<Record<string, number>> {
        try {
            let queues: Record<string, number> = await cache.getLocal("queueCount");
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
    async getGameQueueCount(game_slug: string): Promise<number> {
        try {
            let queueCount = await redis.hget("queueCount", game_slug);
            console.log(game_slug, "queueCount=", queueCount);
            return Number.parseInt(queueCount);
        } catch (e) {
            console.error(e);
            return 0;
        }
    }

    async findGamePerson(game_slug: string, shortid: string, displayname: string): Promise<{ game: Game; player: PlayerGameRank } | GeneralError> {
        try {
            let db = await mysql.db();
            // var response;
            console.log("Getting game with person stats: ", game_slug, shortid, displayname);
        
            let game: Game = await this.findGame(game_slug);

            let response = await db.sql(
                `SELECT 
                coalesce(pr.rating,0) as rating, 
                coalesce(pr.win,0) as win, 
                coalesce(pr.loss,0) as loss, 
                coalesce(pr.tie,0) as tie, 
                coalesce(pr.played,0) as played, 
                coalesce(pr.highscore,0) as highscore,
                d.division_id,
                d.season as division_season,
                d.division_name,
                d.player_count as division_playercount,
                gr.vote, 
                gr.report
            FROM person_rank pr 
            LEFT JOIN division d
                ON (d.game_slug = pr.game_slug AND d.division_id = pr.division)
            LEFT JOIN game_review gr
                ON (gr.game_slug = pr.game_slug AND gr.shortid = pr.shortid)
            WHERE pr.shortid = ? AND pr.game_slug = ? and pr.season = ?`,
                [shortid, game_slug, game.season]
            );

            if (response.results && response.results.length == 0) {
                return new GeneralError("E_NOTFOUND");
            }

            let player: PlayerGameRank = response.results[0];

            // game.votes = await this.findGameVotes(game_slug);
            game.queueCount = (await this.getGameQueueCount(game_slug)) || 0;

            game.stats = await stats.getGameStats(game_slug, game.maxplayers == 1);
            game.achievements = await achievements.getAchievementProgress(
                game_slug,
                shortid,
                game.stats
            );

            let cleaned: { game: Game; player: PlayerGameRank } = {
                game: {
                    achievements: game.achievements,
                    stats: game.stats,
                    gameid: game.gameid,
                    game_slug: game.game_slug,
                    name: game.name,
                    season: game.season,
                    division_id: player.division_id,
                    division_name: player.division_name,
                    division_season: player.division_season,
                    division_playercount: player.division_playercount,
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
                    rating: player.rating,
                    vote: player.vote,
                    report: player.report,
                    win: player.win,
                    loss: player.loss,
                    tie: player.tie,
                    played: player.played,
                },
            };

            return cleaned;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }
}

export default new GameService();