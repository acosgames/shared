const MySQL = require('./mysql');
const mysql = new MySQL();

const credutil = require('../util/credentials')
const { genUnique64string, genShortId } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError, CodeError, SQLError } = require('../util/errorhandler');

const redis = require('./redis');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const cache = require('./cache');

class RoomService {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }



    async assignPlayerRoom(shortid, room_slug) {
        try {
            let db = await mysql.db();

            console.log("Assigning player [" + shortid + "] to: ", room_slug);

            // let key = shortid + '/' + room_slug;
            // cache.set(key, true);

            let personRoom = {
                shortid,
                room_slug
            }
            let response = await db.insert('person_rooms', personRoom);

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

            let response = await db.delete('person_rooms', 'WHERE shortid = ? AND room_slug = ?', [shortid, room_slug]);

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
            let db = await mysql.db();

            let update = {
                player_count
            }
            let response = await db.update('game_room', update, 'WHERE room_slug = ?', [room_slug]);

            return response;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
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
    //         response = await db.sql('SELECT a.shortid, a.room_slug FROM person_rooms a WHERE a.shortid = ? AND a.room_slug = ?', [shortid, room_slug]);

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
            console.log("Getting list of player rooms");
            response = await db.sql('SELECT a.shortid, b.* FROM person_rooms a LEFT JOIN game_room b ON a.room_slug = b.room_slug WHERE a.shortid = ? AND b.game_slug = ?', [shortid, game_slug]);

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


    async findPlayerRooms(shortid) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of player rooms");
            response = await db.sql('SELECT a.shortid, b.* FROM person_rooms a LEFT JOIN game_room b ON a.room_slug = b.room_slug WHERE a.shortid = ?', [shortid]);

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

    async findRoom(room_slug) {
        try {

            let room = await cache.get(room_slug);
            if (room)
                return room;

            let db = await mysql.db();
            var response;
            console.log("Getting list of rooms");
            response = await db.sql('SELECT r.db, i.gameid, i.version as published_version, i.maxplayers, r.* from game_room r, game_info i LEFT JOIN (SELECT gameid, MAX(version) as latest_version FROM game_version GROUP BY gameid) b ON b.gameid = i.gameid WHERE r.game_slug = i.game_slug AND r.room_slug = ?', [room_slug]);

            if (response.results && response.results.length > 0) {
                return response.results[0];
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
            response = await db.sql('SELECT i.db, i.gameid, i.version as published_version, b.latest_version, i.maxplayers, r.* FROM game_room r, game_info i LEFT JOIN (SELECT gameid, MAX(version) as latest_version FROM game_version GROUP BY gameid) b ON b.gameid = i.gameid WHERE r.game_slug = i.game_slug AND r.game_slug = ? AND isprivate = 0 AND isfull = 0 AND r.player_count < i.maxplayers ORDER BY version desc, rating desc', [game_slug]);

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

    async findAnyRoom(game_slug, isBeta, rooms, attempt) {
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
            } else {
                rooms = rooms || await this.findRooms(game_slug);
            }

            if (isBeta) {
                let betaRooms = [];
                for (let i = 0; i < rooms.length; i++) {
                    let room = rooms[i];
                    if (room.latest_version > room.published_version)
                        betaRooms.push(room);
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
                return await this.createRoom(game_slug, isBeta);
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

        // let room = await this.createRoom(gameid);
        return [];
    }

    async joinRoom(user, room_slug) {

        let room = await redis.get(room_slug);

        room.player_count += 1;

        await redis.set(room_slug, room);

        return true;
    }

    async createRoom(game_slug, isBeta, private_key) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of rooms");

            response = await db.sql('SELECT a.db, a.gameid, a.version, b.latest_version FROM game_info a LEFT JOIN (SELECT gameid, MAX(version) as latest_version FROM game_version GROUP BY gameid) b ON b.gameid = a.gameid WHERE game_slug = ?', [game_slug]);
            if (!response.results | response.results.length == 0)
                throw new GeneralError("E_GAMENOTEXIST");

            let published = response.results[0];
            let latest_version = published.latest_version;
            let version = published.version;
            let gameid = published.gameid;
            let database = published.db || false;
            if (isBeta)
                version = latest_version;

            let room = {
                room_slug: genShortId(5),
                db: database,
                game_slug,
                version,
                player_count: 0,
                isprivate: 0
            }
            if (private_key) {
                room.isprivate = 1;
                room.private_key = private_key;
            }
            try {
                response = await db.insert('game_room', room);
            }
            catch (e) {
                console.error(e);
            }

            room.gameid = gameid;
            room.latest_version = latest_version;
            // let room_meta = {
            //     room_slug: room.room_slug,
            //     player_count: 0
            // }
            // response = await db.insert('game_room_meta', room_meta);

            cache.set(room.room_slug + '/meta', room);

            return room;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async getRoomMeta(room_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting room meta for:", room_slug);
            response = await db.sql('select * from game_room WHERE room_slug = ?', [room_slug]);

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async updateRoomMeta(room_meta) {
        try {
            let db = await mysql.db();
            var response;

            let room_slug = room_meta.room_slug;
            console.log("Getting room meta for:", room_meta);
            delete room_meta['room_slug'];

            response = await db.update('game_room', room_meta, 'WHERE room_slug = ?', room_slug)

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async deleteRoom(room_slug) {
        try {
            cache.del(room_slug);
            cache.del(room_slug + '/meta');

            let db = await mysql.db();
            var response;
            console.log("Deleting room: " + room_slug);

            response = await db.delete('game_room', 'WHERE room_slug = ?', [room_slug]);
            response = await db.delete('person_rooms', 'WHERE room_slug = ?', [room_slug]);
            // response = await db.delete('game_room_meta', 'WHERE room_slug = ?', [room_meta]);

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

module.exports = new RoomService();