import MySQL from "./mysql.js";
const mysql = new MySQL();

import credutil from "../util/credentials.js";
import { genUnique64string, genShortId  } from "../util/idgen.js";
import { utcDATETIME  } from "../util/datefns.js";
import { GeneralError, CodeError, SQLError  } from "../util/errorhandler.js";
import { uniqueName, isObject  } from "../util/utils.js";
import redis from "./redis.js";
import game from "./game.js";// const game = new GameService();

import webpush from "web-push";
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

import cache from "./cache.js";
import ratingConfig from "../util/ratingconfig.js";
import { Player } from "aws-sdk/clients/gamelift.js";
const ModeFromID = ["experimental", "rank", "public", "private"];
const ModeFromName = {
    experimental: 0,
    rank: 1,
    public: 2,
    private: 3,
};

class RatingService {
    constructor(credentials?:any) {
        this.credentials = credentials || credutil();
        webpush.setVapidDetails(
            this.credentials.webpush.contact,
            this.credentials.webpush.publickey,
            this.credentials.webpush.privatekey
        );
    }

        async createPersonRank(player: any, game_slug: string): Promise<PlayerGameRating> {
            try {
                let db = await mysql.db();
    
                if (!player) throw new Error("Player does not exist: " + JSON.stringify(player));
                let shortid = player?.shortid || "SPECTATOR";
                //create new rating and cache it
                let mu = ratingConfig.muDefault();
                let sigma = ratingConfig.sigmaDefault();
                let division = await this.findAvailableDivision(db, game_slug);
                let personRank = {
                    shortid: shortid,
                    game_slug: game_slug,
                    rating: ratingConfig.muRating(mu),
                    mu,
                    sigma,
                    win: 0,
                    loss: 0,
                    tie: 0,
                    played: 0,
                    division: division.division_id,
                    season: division.season,
                    highscore: 0,
                    playtime: 0
                };
    
                let response = await db.insert("person_rank", personRank);
    
                let incrementResponse = await db.increment(
                    "division",
                    { player_count: 0 },
                    "game_slug = ? AND season = ? AND division_id = ?",
                    [game_slug, division.season, division.division_id]
                );
    
                let key = shortid + "/" + game_slug;
                console.log("Saving player rating: ", key, personRank.rating);
    
                // player.displayname = player.displayname;
                player.rating = personRank.rating;
                // delete rating.shortid;
                // delete personRank.game_slug;
                cache.set(key, personRank, 600);
    
                let redisResult = this.updateLeaderboard(game_slug, {
                    [shortid]: player,
                });
                console.error(redisResult);
                return personRank;
            } catch (e) {
                console.error(e);
            }
            return null;
        }
    
        async findGroupRatings(shortids: string[], game_slugs: string[]): Promise<{ playerRatings: Record<string, Record<string, PlayerGameRating>>, invalidPlayers: string[] }> {
            try {
                let db = await mysql.db();
                var response;
    
                response = await db.sql(
                    `SELECT 
                        b.shortid, 
                        b.displayname,  
                        a.game_slug, 
                        a.rating
                    FROM person b
                    INNER JOIN game_info gi
                        ON gi.game_slug in (?)
                    LEFT JOIN person_rank a
                        ON a.game_slug = gi.game_slug 
                        AND a.season = gi.season
                        AND a.shortid = b.shortid
                    WHERE b.shortid in (?)`,
                    [game_slugs, shortids]
                );
    
                //build players list first
                let playerNames = {};
                let playerRatings = {};
                let playerInfo = {};
                for (const result of response.results) {
                    if (!(result.shortid in playerRatings)) 
                        playerRatings[result.shortid] = {};
    
                    playerNames[result.shortid] = result.displayname;
    
                    if (result.game_slug) 
                        playerRatings[result.shortid][result.game_slug] = result;
    
                    playerInfo[result.shortid] = result;
                }
    
                let invalidPlayers = [];
                for (const shortid of shortids) {
                    let player = playerRatings[shortid];
                    if (!player) {
                        invalidPlayers.push(shortid);
                        continue;
                    }
                    for (const game_slug of game_slugs) {
                        let key = shortid + "/" + game_slug;
                        if (game_slug in player) {
                            cache.set(key, playerRatings[shortid][game_slug], 600);
                            continue;
                        }
    
                        let newRating = await this.createPersonRank(playerInfo[shortid], game_slug);
    
                        //make sure we add displayname into the rating object stored in cache/redis
                        newRating.displayname = playerNames[shortid].displayname;
    
                        playerRatings[shortid][game_slug] = newRating;
                    }
                }
    
                return { playerRatings, invalidPlayers };
            } catch (e) {
                console.error(e);
                return null;
            }
        }
    
        async findPlayerRating(shortid: string, meta: any, game_slug: string): Promise<PlayerGameRating> {
            try {
                let key = shortid + "/" + game_slug;
                let rating = await cache.get(key);
                if (rating) {
                    console.log("[Cached] Getting player rating for: ", key, rating.rating);
                    return rating;
                }
    
                let db = await mysql.db();
                var response;
    
                response = await db.sql(
                    `SELECT 
                        b.shortid, 
                        b.displayname, 
                        b.countrycode, 
                        a.game_slug, 
                        a.rating, 
                        a.mu, 
                        a.sigma, 
                        a.win, 
                        a.loss, 
                        a.tie, 
                        a.played, 
                        a.division, 
                        a.season, 
                        a.highscore, 
                        a.playtime 
                    from person b
                    LEFT JOIN person_rank a
                        ON b.shortid = a.shortid AND a.game_slug = ? AND a.season = ?
                    WHERE b.shortid = ?`,
                    [game_slug, meta?.season || 0, shortid]
                );
    
                //use the first result
                if (response.results && response.results.length > 0) {
                    rating = response.results[0];
                }
    
                //player has a rating, we are good to go
                if (rating.rating != null && rating.played != null) {
                    cache.set(key, rating, 600);
                    console.log("[MySQL] Getting player rating for: ", key, rating.rating);
                    return rating;
                }
    
                let newRating = await this.createPersonRank(shortid, game_slug);
    
                //make sure we add displayname into the rating object stored in cache/redis
                newRating.displayname = rating.displayname;
    
                // delete newRating.shortid;
                // delete newRating.game_slug;
    
                return rating;
            } catch (e) {
                console.error(e);
                return null;
            }
        }

            async updateLeaderboard(game_slug: string, players: Record<string, PlayerGameRating>): number | null {
                try {
                    let members = [];
                    for (var id in players) {
                        let player = players[id];
                        members.push({
                            value: player.displayname,
                            score: player.rating,
                        });
                        redis.zadd(game_slug + "/rankings/" + player.countrycode, [
                            { value: player.displayname, score: player.rating },
                        ]);
                    }
        
                    let result = await redis.zadd(game_slug + "/rankings", members);
                    console.log(result);
                    return result;
                } catch (e) {
                    console.error(e);
                }
                return null;
            }
        
            async updateLeaderboardHighscore(game_slug: string, players: Record<string, PlayerGameRating>): number | null {
                try {
                    let members = [];
                    for (var id in players) {
                        let player = players[id];
                        if (!player?.displayname || typeof player?.highscore === "undefined") continue;
                        members.push({
                            value: player.displayname,
                            score: player.highscore || 0,
                        });
                    }
        
                    console.log("updating leaderboard redis", members);
                    let result = await redis.zadd(game_slug + "/lbhs", members);
                    return result;
                } catch (e) {
                    console.error(e);
                }
                return null;
            }
        
            async updateAllPlayerHighscores(ratings: PlayerGameRating[], isSinglePlayer: boolean): boolean {
                try {
                    let db = await mysql.db();
        
                    let incrementList = null;
                    if (isSinglePlayer) incrementList = ["played"];
        
                    console.log("Updating highscores to person_rank: ", incrementList, ratings);
                    var response = await db.insertBatch(
                        "person_rank",
                        ratings,
                        ["shortid", "game_slug"],
                        incrementList
                    );
                    if (response && response.results.affectedRows > 0) {
                        return true;
                    }
                    return true;
                } catch (e) {
                    console.error(e);
                }
                return false;
            }
        
            async updateAllPlayerRatings(ratings:PlayerGameRating[]): boolean {
                try {
                    let db = await mysql.db();
        
                    let incrementList = ["played"];
        
                    console.log("Updating ratings to person_rank: ", incrementList, ratings);
                    var response = await db.insertBatch(
                        "person_rank",
                        ratings,
                        ["shortid", "game_slug"],
                        ["played"],
                        ["winloss"]
                    );
                    if (response && response.results.affectedRows > 0) {
                        return true;
                    }
                    return true;
                } catch (e) {
                    console.error(e);
                }
                return false;
            }
            async updatePlayerDivision(shortid: string, game_slug: string, season: number, divison_id: number): boolean {
                try {
                    let update = {
                        divison_id,
                    };
        
                    let db = await mysql.db();
                    var response = await db.update(
                        "person_rank",
                        update,
                        "shortid = ? AND game_slug = ? AND season = ?",
                        [shortid, game_slug, season]
                    );
                    if (response && response.results.affectedRows > 0) {
                        return true;
                    }
                } catch (e) {
                    console.error(e);
                }
                return false;
            }
        
            async updatePlayerRating(shortid: string, game_slug: string, ratingData: PlayerGameRating): Promise<boolean> {
                try {
                    let update = {
                        rating: ratingData.rating,
                        mu: ratingData.mu,
                        sigma: ratingData.sigma,
                        highscore: ratingData.highscore,
                    };
        
                    let db = await mysql.db();
                    var response = await db.update("person_rank", update, "shortid = ? AND game_slug = ?", [
                        shortid,
                        game_slug,
                    ]);
                    if (response && response.results.affectedRows > 0) {
                        return true;
                    }
                } catch (e) {
                    console.error(e);
                }
                return false;
            }
        
            setPlayerRating(shortid: string, game_slug: string, rating: number) {
                let key = shortid + "/" + game_slug;
                cache.set(key, rating, 600);
            }
        
            setPlayerHighScore(shortid: string, game_slug: string, highscore: number) {
                let key = shortid + "/" + game_slug + "/highscore";
                cache.set(key, highscore, 600);
            }
        
            async findPlayerRatings(playerShortids: string[], meta: any, game_slug: string): Promise<PlayerGameRating[]> {
                try {
                    let db = await mysql.db();
                    var response;
        
                    response = await db.sql(
                        `
                        SELECT 
                            a.shortid,
                            a.displayname,
                            b.rating, 
                            b.mu, 
                            b.sigma, 
                            b.win, 
                            b.loss, 
                            b.tie, 
                            b.played,
                            b.division,
                            b.season,
                            b.highscore,
                            b.playtime
                        FROM person a
                        LEFT JOIN person_rank b
                            ON a.shortid = b.shortid AND b.game_slug = ? AND b.season = ?
                        WHERE a.shortid in (?)
                    `,
                        [game_slug, meta?.season || 0, playerShortids]
                    );
        
                    let results = response.results;
                    if (results && results.length > 0) {
                        for (var i = 0; i < results.length; i++) {
                            let personRank = results[i];
                            let key = personRank.shortid + "/" + game_slug;
        
                            //rating exists, cache it
                            if (personRank.rating == null) {
                                let newRating = await this.createPersonRank(personRank, game_slug);
                                results[i] = newRating;
                                continue;
                            }
        
                            cache.set(key, personRank, 600);
                        }
                        // console.log("Getting player rating for: ", key, rating.rating);
                        return results;
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        
            async findAvailableDivision(db: any, game_slug: string): Promise<{ division_id: number, season: number }> {
                try {
                    // let db = await mysql.db();
        
                    let response = await db.sql(
                        `SELECT d.division_id, d.season, d.player_count
                    FROM division d 
                    LEFT JOIN game_info gi 
                        ON gi.game_slug = d.game_slug
                    WHERE d.game_slug = ? 
                    AND d.season = gi.season
                    ORDER BY d.player_count ASC 
                    LIMIT 10`,
                        [game_slug]
                    );
        
                    let division_id = 0;
                    if (
                        !response.results ||
                        response.results.length == 0 ||
                        response.results[0].player_count >= 100
                    ) {
                        let division = await this.createDivision(db, game_slug);
                        return division;
                    }
        
                    return response.results[0];
                } catch (e) {
                    console.error(e);
                }
            }
        
            async createDivision(db: any, game_slug: string): Promise<{ division_id: number, season: number }> {
                try {
                    // let db = await mysql.db();
        
                    let response2 = await db.sql(
                        `SELECT gi.season FROM game_info gi WHERE gi.game_slug = ?`,
                        [game_slug]
                    );
                    let season =
                        response2.results && response2.results.length > 0 ? response2.results[0].season : 0;
        
                    let response = await db.sql(
                        `SELECT MAX(d.division_id) as max_division_id
                    FROM division d
                    WHERE d.game_slug = ?
                    AND d.season = ?`,
                        [game_slug, season]
                    );
        
                    let max_division_id = 0;
                    if (response.results && response.results.length > 0) {
                        max_division_id = response.results[0].max_division_id;
                    }
        
                    //create 2 divisions, to spread users around
                    // INCREASE this when game is more popular
                    let division = {
                        game_slug,
                        season,
                        division_id: max_division_id + 1,
                        division_name: await this.findUniqueDivisionName(db, game_slug, season),
                    };
        
                    let division2 = {
                        game_slug,
                        season,
                        division_id: max_division_id + 2,
                        division_name: await this.findUniqueDivisionName(db, game_slug, season),
                    };
        
                    await db.insert("division", division);
                    await db.insert("division", division2);
        
                    let division_id = max_division_id + 1;
                    return { division_id, season };
                } catch (e) {
                    console.error(e);
                }
                return { division_id: 0, season: 0 };
            }
        
            async findUniqueDivisionName(db: any, game_slug: string, season: number): Promise<string> {
                try {
                    // let db = await mysql.db();
        
                    let division_name = uniqueName();
        
                    let response = await db.sql(
                        `SELECT d.division_name FROM division d WHERE d.game_slug = ? AND d.season = ? AND d.division_name = ?`,
                        [game_slug, season, division_name]
                    );
                    while (response.results && response.results.length > 0) {
                        division_name = uniqueName();
                        if (!division_name) return "Invalid " + Math.random() * 100000;
                        response = await db.sql(
                            `SELECT d.division_name FROM division d WHERE d.game_slug = ? AND d.season = ? AND d.division_name = ?`,
                            [game_slug, season, division_name]
                        );
                    }
        
                    return division_name;
                } catch (e) {
                    console.error(e);
                }
                return "Invalid " + Math.random() * 100000;
            }
}

export default new RatingService();