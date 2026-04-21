import MySQL from "./mysql.js";
const mysql = new MySQL();
import credutil from "../util/credentials.js";
import { genShortId } from "../util/idgen.js";
import { GeneralError, CodeError } from "../util/errorhandler.js";
import { isObject } from "../util/utils.js";
import game from "./game.js"; // const game = new GameService();
import webpush from "web-push";
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
import cache from "./cache.js";
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
        webpush.setVapidDetails(this.credentials.webpush.contact, this.credentials.webpush.publickey, this.credentials.webpush.privatekey);
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
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
            }
        }
        catch (e) {
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
        }
        catch (e) {
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
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
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
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
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
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
    async findPlayerRoom(shortid, game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting player room:", shortid, game_slug);
            response = await db.sql(`SELECT 
                    a.shortid, 
                    b.room_slug, 
                    b.game_slug, 
                    b.season, 
                    b.version, 
                    b.mode, 
                    b.rating, 
                    b.owner, 
                    b.status, 
                    b.private_key, 
                    b.tsupdate, 
                    b.tsinsert 
                FROM person_room a 
                LEFT JOIN game_room b 
                    ON a.room_slug = b.room_slug 
                LEFT JOIN game_version gv
                    ON gv.game_slug = b.game_slug AND gv.version = b.version
                WHERE a.shortid = ? 
                AND b.game_slug = ?
                AND b.status <= 1
                `, [shortid, game_slug]);
            if (response.results && response.results.length > 0) {
                return response.results;
            }
            return [];
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
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
        }
        catch (e) {
            //console.log("Game Error already exists, updating: ", row.gameid, row.version, row.body);
            try {
                var response = await db.sql(`
                    UPDATE game_error
                    SET count = IFNULL(count, 0) + 1
                    WHERE game_slug = ? AND version = ? AND body = ?
                `, [row.game_slug, row.version, row.body]);
                //console.log(response);
            }
            catch (e) {
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
            response = await db.sql(`SELECT 
                    a.shortid, 
                    b.room_slug, 
                    b.game_slug, 
                    b.version, 
                    b.mode, 
                    b.status, 
                    v.css,
                    v.protocol,
                    v.settings,
                    v.scaled,
                    v.screentype,
                    v.resow,
                    v.resoh,
                    v.screenwidth,
                    c.minplayers,
                    c.maxplayers,
                    c.maxteams,
                    c.minteams,
                    c.lbscore
                FROM person_room a 
                INNER JOIN game_room b 
                    ON a.room_slug = b.room_slug 
                INNER JOIN game_info c
                    ON b.game_slug = c.game_slug
                INNER JOIN game_version v
                    ON c.gameid = v.gameid AND b.version = v.version
                WHERE a.shortid = ?
                AND b.room_slug IS NOT NULL
                AND b.status <= 1`, [shortid]);
            if (response.results && response.results.length > 0) {
                let filtered = response.results.filter((room) => room.room_slug);
                return filtered;
            }
            return [];
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
    async findRoom(room_slug) {
        try {
            let key = room_slug + "/meta";
            let room = await cache.get(key);
            if (room)
                return room;
            // room = await redis.get(key);
            // if( room ) return room;
            let db = await mysql.db();
            var response;
            console.log("Getting room info for: ", room_slug);
            //response = await db.sql('SELECT r.db, i.gameid, i.version as published_version, i.maxplayers, r.* from game_room r, game_info i LEFT JOIN (SELECT gameid, MAX(version) as latest_version FROM game_version GROUP BY gameid) b ON b.gameid = i.gameid WHERE r.game_slug = i.game_slug AND r.room_slug = ?', [room_slug]);
            response = await db.sql(`SELECT 
                    r.room_slug,
                    r.game_slug,
                    r.season,
                    v.version,
                    r.owner,
                    r.rating,
                    r.mode,
                    v.db,
                    v.css,
                    v.protocol,
                    v.settings,
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
                FROM game_room r, 
                game_version v, 
                game_info i 
                WHERE r.room_slug = ? 
                AND r.game_slug = i.game_slug
                AND i.gameid = v.gameid AND r.version = v.version
                `, [room_slug]);
            if (response.results && response.results.length > 0) {
                let room = response.results[0];
                //convert from id to name
                // if (room.maxteams > 0) {
                //     let teamResponse = await db.sql("SELECT * from game_team WHERE game_slug = ?", [
                //         room.game_slug,
                //     ]);
                //     if (teamResponse.results && teamResponse.results.length > 0) {
                //         room.teams = teamResponse.results;
                //     }
                // }
                room.mode = this.getGameModeName(room.mode);
                delete room["tsupdate"];
                delete room["tsinsert"];
                cache.set(key, room);
                return room;
            }
            return null;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
    async findRooms(game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of rooms");
            response = await db.sql(`SELECT 
                    r.room_slug, 
                    r.game_slug, 
                    r.season, 
                    r.version, 
                    r.mode, 
                    r.rating, 
                    r.owner, 
                    r.status, 
                    r.private_key, 
                    r.tsupdate, 
                    r.tsinsert 
                FROM game_room r 
                WHERE r.game_slug = ? 
                AND r.status = 0 
                ORDER BY r.version desc, r.rating desc`, [game_slug]);
            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }
    async checkRoomFull(room) {
        // cache.del(room.room_slug);
        // cache.del(room.room_slug+'/meta');
        let plist = Object.keys(roomState.players);
        if (plist.length >= room.max_players)
            return true;
        return false;
    }
    async findAnyRoom(user, game_slug, mode, rooms, attempt) {
        try {
            attempt = attempt || 1;
            rooms = rooms || [];
            //sleep if if we are checking too much
            if (attempt % 5 == 0)
                await sleep(1000);
            //refresh the list if we failed after rooms X amount times
            if (attempt > rooms.length) {
                rooms = await this.findRooms(game_slug);
                attempt = 0;
            }
            else {
                rooms = rooms || (await this.findRooms(game_slug));
            }
            if (mode == "experimental") {
                let betaRooms = [];
                for (let i = 0; i < rooms.length; i++) {
                    let room = rooms[i];
                    if (room.istest)
                        betaRooms.push(room);
                }
                rooms = betaRooms;
            }
            if (rooms.length == 0) {
                return await this.createRoom(user.shortid, user.ratings[game_slug], game_slug, mode);
            }
            let index = Math.floor(Math.random() * rooms.length);
            let room = rooms[index];
            return room;
        }
        catch (e) {
            console.error(e);
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }
    async getModes() {
        try {
            let modes = await cache.get("modes");
            if (modes) {
                let now = new Date().getTime();
                let expires = await cache.get("modes/expire");
                if (expires && expires > now)
                    return modes;
            }
            let db = await mysql.db();
            var response;
            console.log("Getting list of modes");
            response = await db.sql(`SELECT * FROM game_modes`);
            modes = response.results;
            if (!modes)
                throw new GeneralError("E_MODENOTEXIST");
            for (let i = 0; i < modes.length; i++) {
                try {
                    let json = JSON.parse(modes[i].data);
                    modes[i].data = json;
                }
                catch (e) {
                    console.error(e);
                }
            }
            let now = new Date().getTime();
            let expires = now + 3600 * 1000;
            cache.set("modes/expire", expires, 3600);
            cache.set("modes", response.results, 3600);
            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
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
            response = await db.sql(`SELECT * 
                FROM game_info a 
                WHERE a.game_slug = ?`, [game_slug]);
            if (!response.results || response.results.length == 0)
                throw new GeneralError("E_GAMENOTEXIST");
            gameinfo = response.results[0];
            if (gameinfo.maxteams > 0) {
                let response2 = await db.sql(`SELECT 
                        a.game_slug, 
                        a.team_slug, 
                        a.team_name, 
                        a.team_order, 
                        a.minplayers, 
                        a.maxplayers, 
                        a.color, 
                        a.icon 
                    FROM game_team a 
                    WHERE a.game_slug = ?`, [game_slug]);
                if (response2.results && response2.results.length > 0) {
                    gameinfo.teamlist = response2.results;
                }
            }
            let now = new Date().getTime();
            gameinfo.expires = now + 120 * 1000;
            cache.set("gameinfo/" + game_slug, gameinfo, 120);
            return gameinfo;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
    async findRoomUserSubscriptions(room_slug) {
        try {
            let db = await mysql.db();
            let response = await db.sql(`
                SELECT a.shortid, a.webpush
                FROM person a, person_room b
                WHERE a.shortid = b.shortid
                AND b.room_slug = ?
                AND a.webpush IS NOT NULL
            `, [room_slug]);
            console.log("findRoomUserSubscriptions:", room_slug, response);
            if (response.results && response.results.length == 0) {
                return null;
            }
            let subscriptions = response.results;
            return subscriptions;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
    async createRoom(shortid, rating, game_slug, mode, private_key) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Creating room: ", game_slug, mode);
            let published = await game.findGame(game_slug, true);
            // response = await db.sql(`SELECT * FROM game_info WHERE game_slug = ?`, [game_slug]);
            if (!published || !published.gameid)
                throw new GeneralError("E_GAMENOTEXIST");
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
                settings: published.settings,
                protocol: published.protocol,
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
            }
            catch (e) {
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
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
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
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }
    async updatePlayerRoom(room_slug, gamestate, ratings) {
        try {
            let db = await mysql.db();
            if (ratings) {
                for (let rating of ratings) {
                    let { shortid, winloss, rank, score } = rating;
                    // let player = gamestate?.players.find((p) => p.shortid == shortid);
                    // let { rank, score } = player;
                    console.log("Player Room completed: ", shortid, room_slug);
                    let response2 = await db.update("person_room", { place: rank, score, winloss }, "shortid=? AND room_slug=?", [shortid, room_slug]);
                    // let stats = player?.stats;
                    // if (!stats) continue;
                }
            }
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
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
            response = await db.update("game_room", { status: 2 }, "room_slug=?", [room_slug]);
            // response = await db.delete("person_room", "WHERE room_slug = ?", [
            //     room_slug,
            // ]);
            // response = await db.delete('game_room_meta', 'WHERE room_slug = ?', [room_meta]);
            // return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return true;
    }
}
export default new RoomService();
//# sourceMappingURL=room.js.map