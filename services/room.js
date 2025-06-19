const MySQL = require("./mysql");
const mysql = new MySQL();

const credutil = require("../util/credentials");
const { genUnique64string, genShortId } = require("../util/idgen");
const { utcDATETIME } = require("../util/datefns");
const { GeneralError, CodeError, SQLError } = require("../util/errorhandler");

const { uniqueName, isObject } = require("../util/utils");

const redis = require("./redis");

const game = require("./game");
// const game = new GameService();

const webpush = require("web-push");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const cache = require("./cache");
const { muRating, muDefault, sigmaDefault } = require("../util/ratingconfig");

const ModeFromID = ["experimental", "rank", "public", "private"];
const ModeFromName = {
    experimental: 0,
    rank: 1,
    public: 2,
    private: 3,
};

class RoomService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
        webpush.setVapidDetails(
            this.credentials.webpush.contact,
            this.credentials.webpush.publickey,
            this.credentials.webpush.privatekey
        );
    }

    getGameModeID(name) {
        return ModeFromName[name];
    }

    getGameModeName(id) {
        return ModeFromID[id];
    }

    async notifyPlayerRoom(room_slug, gameinfo) {
        try {
            //{"body":"Tic Tac Toe", "title":"You joined a game!", "icon": "https://assets.acos.games/g/test-game-1/preview/QCH6JB.png"}
            let subscriptions = await this.findRoomUserSubscriptions(room_slug);
            console.log("Room Notif Subscriptions: ", room_slug, subscriptions);
            if (subscriptions) {
                let urlprefix = this.credentials.platform.website.url;

                const payload = JSON.stringify({
                    title: "You joined a game!",
                    body: `${gameinfo.name}, click to join.`,
                    icon: `https://assets.acos.games/g/${gameinfo.game_slug}/preview/${gameinfo.preview_images}`,
                    data: {
                        url: `${urlprefix}/g/${gameinfo.game_slug}/${room_slug}`,
                    },
                });

                for (var i = 0; i < subscriptions.length; i++) {
                    let sub = subscriptions[i];
                    let subscription = JSON.parse(sub.webpush);
                    try {
                        if (isObject(subscription) && Object.keys(subscription).length == 0)
                            continue;
                        console.log("Sending Notification: ", sub.shortid, payload);
                        webpush
                            .sendNotification(subscription, payload)
                            .then((result) => console.log(result))
                            .catch((e) => console.error(e));
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    async assignPlayersToRoom(shortids, room_slug, game_slug) {
        try {
            let db = await mysql.db();

            let meta = await this.findRoom(room_slug);
            if (!meta) {
                console.error("[assignPlayersToRoom] Room ID does not exist: " + room_slug);
                return null;
            }

            let roomPlayers = [];

            let mode = meta.mode;
            let version = meta.mode == "experimental" ? meta.latest_version : meta.version;

            for (const shortid of shortids) {
                let roomPlayer = {
                    shortid,
                    room_slug,
                    // room_slug: meta.room_slug,
                    // game_slug,
                    // mode,
                    // version,
                };
                roomPlayers.push(roomPlayer);
            }

            // console.log("Updating highscores to person_rank: ", incrementList, ratings);
            var response = await db.insertBatch("person_room", roomPlayers, [
                "shortid",
                "room_slug",
            ]);
            if (response && response.results.affectedRows > 0) {
                return true;
            }
            return true;
        } catch (e) {
            if (e instanceof GeneralError) {
                throw e;
            }
        }
    }

    async assignPlayerRoom(shortid, room_slug, game_slug) {
        try {
            let db = await mysql.db();

            console.log("Assigning player [" + shortid + "] to: ", room_slug);

            // let key = shortid + '/' + room_slug;
            // cache.set(key, true);

            let meta = await this.findRoom(room_slug);
            if (!meta) {
                console.error("[assignPlayerRoom] Room ID does not exist: " + room_slug);
                return null;
            }

            // if (meta.maxplayers == 1) {
            //     return null;
            // }

            game_slug = meta.game_slug;

            let mode = meta.mode; // this.getGameModeName(meta.mode);
            let version = meta.mode == "experimental" ? meta.latest_version : meta.version;
            let personRoom = {
                shortid,
                // room_slug,
                room_slug: meta.room_slug,
                // game_slug,
                // mode,
                // version,
            };
            let response = await db.insert("person_room", personRoom);

            return response;
        } catch (e) {
            if (e instanceof GeneralError) throw e;

            //throw new CodeError(e);
        }
    }

    async removePlayerRoom(shortid, room_slug) {
        try {
            let db = await mysql.db();

            console.log("Removing player [" + shortid + "] from: ", room_slug);

            // let key = shortid + '/' + room_slug;
            // cache.del(key);

            let response = await db.delete("person_room", "WHERE shortid = ? AND room_slug = ?", [
                shortid,
                room_slug,
            ]);

            return response;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async updateRoomPlayerCount(room_slug, player_count) {
        try {
            // let db = await mysql.db();
            // let update = {
            //     player_count
            // }
            //let response = await db.update('game_room', update, 'WHERE room_slug = ?', [room_slug]);
            // cache.set(room_slug + "/p", player_count);
            // return response;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    // async checkPlayerRoom(shortid, room_slug) {
    //     try {

    //         let key = shortid + '/' + room_slug;
    //         let isInRoom = cache.get(key);

    //         if (!isInRoom)
    //             return false;

    //         let db = await mysql.db();
    //         var response;
    //         console.log("Getting list of rooms");
    //         response = await db.sql('SELECT a.shortid, a.room_slug FROM person_room a WHERE a.shortid = ? AND a.room_slug = ?', [shortid, room_slug]);

    //         if (response.results && response.results.length > 0) {
    //             return true;
    //         }
    //         return false;
    //     }
    //     catch (e) {
    //         console.error(e);
    //         return false;
    //     }
    // }

    async findPlayerRoom(shortid, game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting player room:", shortid, game_slug);
            response = await db.sql(
                `SELECT 
                a.shortid, 
                b.* 
                FROM person_room a 
                LEFT JOIN game_room b 
                    ON a.room_slug = b.room_slug 
                LEFT JOIN game_version gv
                    ON gv.game_slug = b.game_slug AND gv.version = b.version
                WHERE a.shortid = ? 
                AND b.game_slug = ?
                AND b.status = 0
                `,
                [shortid, game_slug]
            );

            if (response.results && response.results.length > 0) {
                return response.results;
            }
            return [];
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async addError(game_slug, version, error) {
        let row = {
            game_slug,
            version,
            type: error.type,
            title: error.title,
            body: error.body,
        };

        let db;
        try {
            db = await mysql.db();
            var response = await db.insert("game_error", row);
            return response;
        } catch (e) {
            //console.log("Game Error already exists, updating: ", row.gameid, row.version, row.body);

            try {
                var response = await db.sql(
                    `
                    UPDATE game_error
                    SET count = IFNULL(count, 0) + 1
                    WHERE game_slug = ? AND version = ? AND body = ?
                `,
                    [row.game_slug, row.version, row.body]
                );
                //console.log(response);
            } catch (e) {
                console.error(e);
                console.log("Failed to find record.", row.game_slug, row.version, row.body);
            }
        }
    }

    async findPlayerRooms(shortid) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of player rooms", shortid);
            response = await db.sql(
                `SELECT a.shortid, b.*, 
                v.db,
                    v.css,
                    v.scaled,
                    v.screentype,
                    v.resow,
                    v.resoh,
                    v.screenwidth,
                    c.name,
                    c.minplayers,
                    c.maxplayers,
                    c.maxteams,
                    c.minteams,
                    c.lbscore
                FROM person_room a 
                LEFT JOIN game_room b 
                    ON a.room_slug = b.room_slug 
                LEFT JOIN game_info c
                    ON b.game_slug = c.game_slug
                LEFT JOIN game_version v
                    ON c.gameid = v.gameid AND b.version = v.version
                WHERE a.shortid = ?
                AND b.status = 0`,
                [shortid]
            );

            if (response.results && response.results.length > 0) {
                let filtered = response.results.filter((room) => room.room_slug);
                return filtered;
            }
            return [];
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async updateLeaderboard(game_slug, players) {
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
        return false;
    }

    async updateLeaderboardHighscore(game_slug, players) {
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
        return false;
    }

    async updateAllPlayerHighscores(ratings, isSinglePlayer) {
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

    async updateAllPlayerRatings(ratings) {
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
    async updatePlayerDivision(shortid, game_slug, season, divison_id) {
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

    async updatePlayerRating(shortid, game_slug, ratingData) {
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

    setPlayerRating(shortid, game_slug, rating) {
        let key = shortid + "/" + game_slug;
        cache.set(key, rating, 600);
    }

    setPlayerHighScore(shortid, game_slug, highscore) {
        let key = shortid + "/" + game_slug + "/highscore";
        cache.set(key, highscore, 600);
    }

    async findPlayerRatings(playerShortids, meta, game_slug) {
        try {
            let db = await mysql.db();
            var response;

            response = await db.sql(
                `
                SELECT 
                    a.displayname,
                    a.shortid,
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

    async findAvailableDivision(db, game_slug) {
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

    async createDivision(db, game_slug) {
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

    async findUniqueDivisionName(db, game_slug, season) {
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
    }

    async createPersonRank(player, game_slug) {
        try {
            let db = await mysql.db();

            if (!player) throw new Error("Player does not exist: " + JSON.stringify(player));
            let shortid = player?.shortid || "SPECTATOR";
            //create new rating and cache it
            let mu = muDefault();
            let sigma = sigmaDefault();
            let division = await this.findAvailableDivision(db, game_slug);
            let personRank = {
                shortid: shortid,
                game_slug: game_slug,
                rating: muRating(mu),
                mu,
                sigma,
                win: 0,
                loss: 0,
                tie: 0,
                played: 0,
                highscore: 0,
                division: division.division_id,
                season: division.season,
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

            player.displayname = player.displayname;
            player.rating = personRank.rating;
            // delete rating.shortid;
            delete personRank.game_slug;
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

    async findGroupRatings(shortids, game_slugs) {
        try {
            let db = await mysql.db();
            var response;

            response = await db.sql(
                `SELECT b.shortid, b.displayname, b.countrycode, a.game_slug, a.rating, a.mu, a.sigma, a.win, a.loss, a.tie, a.division, a.played, a.season, a.highscore 
                FROM person b
                LEFT JOIN game_info gi
                    ON gi.game_slug in (?)
                LEFT JOIN person_rank a
                    ON a.game_slug = gi.game_slug 
                    AND a.season = gi.season
                    AND a.shortid = b.shortid
                WHERE gi.game_slug in (?)
                AND b.shortid in (?)`,
                [game_slugs, game_slugs, shortids]
            );

            //build players list first
            let playerNames = {};
            let playerRatings = {};
            let playerInfo = {};
            for (const result of response.results) {
                if (!(result.shortid in playerRatings)) playerRatings[result.shortid] = {};

                playerNames[result.shortid] = result.displayname;

                if (result.game_slug) playerRatings[result.shortid][result.game_slug] = result;

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

    async findPlayerRating(shortid, meta, game_slug) {
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
                `SELECT b.shortid, b.displayname, a.rating, a.mu, a.sigma, a.win, a.loss, a.tie, a.played, a.division, a.season, a.highscore, a.playtime 
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

            delete newRating.shortid;
            delete newRating.game_slug;

            return rating;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    async findRoomById(room_slug) {
        try {
            // let key = room_slug + '/meta';
            // let room = await cache.get(key);
            // if (room) return room;

            // room = await redis.get(key);
            // if( room ) return room;

            let db = await mysql.db();
            var response;
            console.log("Getting room info by id: ", room_slug);
            //response = await db.sql('SELECT r.db, i.gameid, i.version as published_version, i.maxplayers, r.* from game_room r, game_info i LEFT JOIN (SELECT gameid, MAX(version) as latest_version FROM game_version GROUP BY gameid) b ON b.gameid = i.gameid WHERE r.game_slug = i.game_slug AND r.room_slug = ?', [room_slug]);
            response = await db.sql(
                "SELECT r.*, i.name from game_room r, game_info i WHERE r.room_slug = ? AND r.game_slug = i.game_slug",
                [room_slug]
            );

            if (response.results && response.results.length > 0) {
                let room = response.results[0];
                //convert from id to name

                if (room.maxteams > 0) {
                    let teamResponse = await db.sql("SELECT * from game_team WHERE game_slug = ?", [
                        room.game_slug,
                    ]);
                    if (teamResponse.results && teamResponse.results.length > 0) {
                        room.teams = teamResponse.results;
                    }
                }

                room.mode = this.getGameModeName(room.mode);
                delete room["tsupdate"];
                delete room["tsinsert"];
                let key = room.room_slug + "/meta";
                cache.set(key, room);
                return room;
            }
            return null;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findRoom(room_slug) {
        try {
            let key = room_slug + "/meta";
            let room = await cache.get(key);
            if (room) return room;

            // room = await redis.get(key);
            // if( room ) return room;

            let db = await mysql.db();
            var response;
            console.log("Getting room info for: ", room_slug);
            //response = await db.sql('SELECT r.db, i.gameid, i.version as published_version, i.maxplayers, r.* from game_room r, game_info i LEFT JOIN (SELECT gameid, MAX(version) as latest_version FROM game_version GROUP BY gameid) b ON b.gameid = i.gameid WHERE r.game_slug = i.game_slug AND r.room_slug = ?', [room_slug]);
            response = await db.sql(
                `SELECT 
                    r.room_slug,
                    r.game_slug,
                    r.season,
                    v.version,
                    r.owner,
                    r.rating,
                    r.mode,
                    v.db,
                    v.css,
                    v.scaled,
                    v.screentype,
                    v.resow,
                    v.resoh,
                    v.screenwidth,
                    i.name,
                    i.minplayers,
                    i.maxplayers,
                    i.maxteams,
                    i.minteams,
                    i.lbscore
                from game_room r, 
                game_version v, 
                game_info i 
                WHERE r.room_slug = ? 
                AND r.game_slug = i.game_slug
                AND i.gameid = v.gameid AND r.version = v.version
                `,
                [room_slug]
            );

            if (response.results && response.results.length > 0) {
                let room = response.results[0];
                //convert from id to name

                if (room.maxteams > 0) {
                    let teamResponse = await db.sql("SELECT * from game_team WHERE game_slug = ?", [
                        room.game_slug,
                    ]);
                    if (teamResponse.results && teamResponse.results.length > 0) {
                        room.teams = teamResponse.results;
                    }
                }

                room.mode = this.getGameModeName(room.mode);
                delete room["tsupdate"];
                delete room["tsinsert"];
                cache.set(key, room);
                return room;
            }
            return null;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findRooms(game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of rooms");

            response = await db.sql(
                "SELECT * from game_room r WHERE r.game_slug = ? AND status = 0 ORDER BY version desc, rating desc",
                [game_slug]
            );
            return response.results;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async checkRoomFull(room) {
        // cache.del(room.room_slug);
        // cache.del(room.room_slug+'/meta');

        let plist = Object.keys(roomState.players);
        if (plist.length >= room.max_players) return true;

        return false;
    }

    async findAnyRoom(user, game_slug, mode, rooms, attempt) {
        try {
            attempt = attempt || 1;
            rooms = rooms || [];
            //sleep if if we are checking too much
            if (attempt % 5 == 0) await sleep(1000);

            //refresh the list if we failed after rooms X amount times
            if (attempt > rooms.length) {
                rooms = await this.findRooms(game_slug);
                attempt = 0;
            } else {
                rooms = rooms || (await this.findRooms(game_slug));
            }

            if (mode == "experimental") {
                let betaRooms = [];
                for (let i = 0; i < rooms.length; i++) {
                    let room = rooms[i];
                    if (room.istest) betaRooms.push(room);
                }
                rooms = betaRooms;
            }

            // let roomState = await cache.get(room.room_slug);
            // if (!roomState)
            //     return false;

            // let plist = Object.keys(roomState.players);
            // rooms = rooms || [];
            // rooms = rooms.filter(room => room.player_count >= room.max_players)

            if (rooms.length == 0) {
                return await this.createRoom(
                    user.shortid,
                    user.ratings[game_slug],
                    game_slug,
                    mode
                );
            }

            let index = Math.floor(Math.random() * rooms.length);
            let room = rooms[index];

            return room;
        } catch (e) {
            console.error(e);
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }

        // let room = await this.createRoom(gameid);
        return [];
    }

    async getModes() {
        try {
            let modes = await cache.get("modes");
            if (modes) {
                let now = new Date().getTime();
                let expires = await cache.get("modes/expire");
                if (expires && expires > now) return modes;
            }

            let db = await mysql.db();
            var response;
            console.log("Getting list of modes");

            response = await db.sql(`SELECT * FROM game_modes`);

            modes = response.results;
            if (!modes) throw new GeneralError("E_MODENOTEXIST");

            for (let i = 0; i < modes.length; i++) {
                try {
                    let json = JSON.parse(modes[i].data);
                    modes[i].data = json;
                } catch (e) {
                    console.error(e);
                }
            }

            let now = new Date().getTime();
            let expires = now + 3600 * 1000;
            cache.set("modes/expire", expires, 3600);
            cache.set("modes", response.results, 3600);

            return response.results;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    // async getGameInfoByRoom(room_slug) {
    //     try {
    //         let room = await this.findRoom(room_slug);

    //         let gameinfo = await cache.get(room.game_slug);
    //         if (gameinfo) {
    //             let now = (new Date()).getTime()
    //             if (typeof gameinfo.expires !== 'undefined' && gameinfo.expires > now)
    //                 return gameinfo;
    //         }

    //         let db = await mysql.db();
    //         var response;
    //         console.log("Getting game info: ", game_slug);

    //         response = await db.sql(`SELECT * FROM game_info a WHERE game_slug = ?`, [game_slug]);

    //         if (!response.results || response.results.length == 0)
    //             throw new GeneralError("E_GAMENOTEXIST");

    //         gameinfo = response.results[0];

    //         let now = (new Date()).getTime()
    //         gameinfo.expires = now + 120 * 1000;

    //         cache.set(game_slug, gameinfo, 120);
    //         return gameinfo;
    //     }
    //     catch (e) {
    //         if (e instanceof GeneralError)
    //             throw e;
    //         throw new CodeError(e);
    //     }
    // }

    async getGameInfo(game_slug) {
        try {
            let gameinfo = await cache.get("gameinfo/" + game_slug);
            if (gameinfo) {
                let now = new Date().getTime();
                if (typeof gameinfo.expires !== "undefined" && gameinfo.expires > now)
                    return gameinfo;
            }

            let db = await mysql.db();
            var response;
            console.log("Getting game info: ", game_slug);

            response = await db.sql(`SELECT * FROM game_info a WHERE a.game_slug = ?`, [game_slug]);

            if (!response.results || response.results.length == 0)
                throw new GeneralError("E_GAMENOTEXIST");

            gameinfo = response.results[0];

            if (gameinfo.maxteams > 0) {
                let response2 = await db.sql(
                    `SELECT a.game_slug, a.team_slug, a.team_name, a.minplayers, a.maxplayers, a.color, a.icon FROM game_team a WHERE a.game_slug = ?`,
                    [game_slug]
                );
                if (response2.results && response2.results.length > 0) {
                    gameinfo.teamlist = response2.results;
                }
            }

            let now = new Date().getTime();
            gameinfo.expires = now + 120 * 1000;

            cache.set("gameinfo/" + game_slug, gameinfo, 120);
            return gameinfo;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async findRoomUserSubscriptions(room_slug) {
        try {
            let db = await mysql.db();

            let response = await db.sql(
                `
                SELECT a.shortid, a.webpush
                FROM person a, person_room b
                WHERE a.shortid = b.shortid
                AND b.room_slug = ?
                AND a.webpush IS NOT NULL
            `,
                [room_slug]
            );

            console.log("findRoomUserSubscriptions:", room_slug, response);
            if (response.results && response.results.length == 0) {
                return null;
            }
            let subscriptions = response.results;
            return subscriptions;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    // async createRoomReplay(game_slug, version, mode, filename) {
    //     try {
    //         let replay = {
    //             game_slug,
    //             version,
    //             mode,
    //             filename,
    //         };

    //         try {
    //             let db = await mysql.db();

    //             console.log("Creating Replay: ", replay);
    //             let response = await db.insert("game_match", replay);
    //         } catch (e) {
    //             console.error(e);
    //         }

    //         return replay;
    //     } catch (e) {
    //         console.error(e);
    //     }
    // }

    async createRoom(shortid, rating, game_slug, mode, private_key) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Creating room: ", game_slug, mode);

            let published = await game.findGame(game_slug, true);

            // response = await db.sql(`SELECT * FROM game_info WHERE game_slug = ?`, [game_slug]);

            if (!published || !published.gameid) throw new GeneralError("E_GAMENOTEXIST");
            // if (!response.results || response.results.length == 0)
            // throw new GeneralError("E_GAMENOTEXIST");
            //published = published.game;
            // let published = response.results[0];
            let version = published.version;
            let gameid = published.gameid;
            let database = published.db || false;
            let css = published.css || false;
            let latest_tsupdate = published.tsupdate;

            // let scaled = published.scaled;
            let screentype = published.screentype;
            let resow = published.resow;
            let resoh = published.resoh;
            let screenwidth = published.screenwidth;

            let preview_images = published.preview_images;

            //experimental uses the latest version that is not in production
            if (mode == "experimental") {
                version = published.latest_version;
                database = published.latest_db || false;
                latest_tsupdate = published.latest_tsupdate;

                // scaled = published.latest_scaled;
                screentype = published.latest_screentype;
                resow = published.latest_resow;
                resoh = published.latest_resoh;
                screenwidth = published.latest_screenwidth;
            }

            let minplayers = published.minplayers;
            let maxplayers = published.maxplayers;
            let maxteams = published.maxteams;
            let minteams = published.minteams;
            let lbscore = published.lbscore;
            // let rating = user.ratings[game_slug];
            // let owner = user.id;

            //use ID instead of name for database
            mode = this.getGameModeID(mode);

            let room_slug = genShortId(8);
            let checkRoom = await this.findRoom(room_slug);
            while (checkRoom) {
                room_slug = genShortId(8);
                checkRoom = await this.findRoom(room_slug);
            }
            let room = {
                room_slug,
                game_slug,
                season: published.season,
                // gameid,
                version,
                // css,
                // db: database,
                // latest_tsupdate,
                // minplayers,
                // maxplayers,
                // maxteams,
                // minteams,
                mode,
                rating,
                // lbscore,
                owner: shortid,
                status: 0,
                // preview_images,
                // scaled,
                // screentype,
                // resow,
                // resoh,
                // screenwidth,
            };

            if (private_key) {
                room.private_key = private_key;
            }

            let meta = {
                room_slug,
                game_slug,
                season: published.season,
                gameid,
                version,
                css,
                db: database,
                latest_tsupdate,
                minplayers,
                maxplayers,
                maxteams,
                minteams,
                mode,
                rating,
                lbscore,
                owner: shortid,
                status: 0,
                preview_images,
                private_key,
                screentype,
                resow,
                resoh,
                screenwidth,
            };

            try {
                console.log("Creating room: ", room);
                response = await db.insert("game_room", room);

                if (maxteams > 0) {
                    let teamResponse = await db.sql("SELECT * from game_team WHERE game_slug = ?", [
                        room.game_slug,
                    ]);
                    if (teamResponse.results && teamResponse.results.length > 0) {
                        meta.teams = teamResponse.results;
                    }
                }

                meta.name = published.name;
            } catch (e) {
                console.error(e);
            }

            //extend to add attributes
            // room.screentype = screentype;
            // room.resow = resow;
            // room.resoh = resoh;
            // room.screenwidth = screenwidth;

            meta.mode = this.getGameModeName(meta.mode);
            cache.set(room.room_slug + "/meta", meta);

            return meta;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async getGameRoom(room_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting room meta for:", room_slug);
            response = await db.sql("select * from game_room WHERE room_slug = ?", [room_slug]);

            return response.results[0];
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
        return [];
    }

    // async updateRoomMeta(room_meta) {
    //     try {
    //         let db = await mysql.db();
    //         var response;

    //         let room_slug = room_meta.room_slug;
    //         console.log("Getting room meta for:", room_meta);
    //         delete room_meta['room_slug'];

    //         response = await db.update('game_room', room_meta, 'WHERE room_slug = ?', room_slug)

    //         return response.results;
    //     }
    //     catch (e) {
    //         if (e instanceof GeneralError)
    //             throw e;
    //         throw new CodeError(e);
    //     }
    //     return [];
    // }

    async updatePlayerRoom(room_slug, gamestate, ratings) {
        try {
            let db = await mysql.db();
            if (ratings) {
                for (let rating of ratings) {
                    let { shortid, winloss } = rating;
                    let player = gamestate?.players[shortid];
                    let { rank, score } = player;

                    console.log("Player Room completed: ", shortid, room_slug);

                    let response2 = await db.update(
                        "person_room",
                        { place: rank, score, winloss },
                        "shortid=? AND room_slug=?",
                        [shortid, room_slug]
                    );

                    let stats = player?.stats;
                    if (!stats) continue;
                }
            }
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
        return true;
    }

    async deleteRoom(meta, roomState) {
        try {
            let room_slug = meta.room_slug;
            // cache.del(room_slug);
            // cache.del(room_slug + '/meta');
            // cache.del(room_slug + '/timer');
            // cache.del(room_slug + '/p');
            let db = await mysql.db();
            var response;
            console.log("Room completed: " + room_slug);

            response = await db.update("game_room", { status: 1 }, "room_slug=?", [room_slug]);

            // response = await db.delete("person_room", "WHERE room_slug = ?", [
            //     room_slug,
            // ]);
            // response = await db.delete('game_room_meta', 'WHERE room_slug = ?', [room_meta]);
            // return response.results;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
        return true;
    }
}

module.exports = new RoomService();
