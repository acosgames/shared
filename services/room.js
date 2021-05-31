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

module.exports = class RoomService {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    async findRoom(room_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of rooms");
            response = await db.sql('SELECT i.gameid, i.version as published_version, i.maxplayers, r.* from game_room r, game_info i LEFT JOIN (SELECT gameid, MAX(version) as latest_version FROM game_version GROUP BY gameid) b ON b.gameid = i.gameid WHERE r.game_slug = i.game_slug AND r.room_slug = ?', [room_slug]);

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
            response = await db.sql('SELECT i.gameid, i.version as published_version, b.latest_version, i.maxplayers, r.* FROM game_room r, game_info i LEFT JOIN (SELECT gameid, MAX(version) as latest_version FROM game_version GROUP BY gameid) b ON b.gameid = i.gameid WHERE r.game_slug = i.game_slug AND r.game_slug = ? AND isprivate = 0 AND isfull = 0 ORDER BY version desc, rating desc', [game_slug]);

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
        let meta = await redis.get(room.room_slug + '/meta');
        if (!meta)
            return false;
        if (meta.player_count >= meta.max_players)
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

            if (!rooms || rooms.length == 0) {
                return await this.createRoom(game_slug, isBeta);
            }

            let index = Math.floor(Math.random() * rooms.length);
            let room = rooms[index];

            if (await this.checkRoomFull(room)) {
                return this.findAnyRoom(game_slug, isBeta, rooms, attempt + 1);
            }

            redis.set(room.room_slug + '/meta', room);
            // room = await this.joinRoom(room);
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

            response = await db.sql('SELECT a.version, b.latest_version FROM game_info a LEFT JOIN (SELECT gameid, MAX(version) as latest_version FROM game_version GROUP BY gameid) b ON b.gameid = a.gameid WHERE game_slug = ?', [game_slug]);
            if (!response.results | response.results.length == 0)
                throw new GeneralError("E_GAMENOTEXIST");

            let published = response.results[0];
            let version = published.version;
            if (isBeta)
                version = published.latest_version;

            let room = {
                room_slug: genShortId(5),
                game_slug,
                version,
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

            }

            // let room_meta = {
            //     room_slug: room.room_slug,
            //     player_count: 0
            // }
            // response = await db.insert('game_room_meta', room_meta);

            redis.set(room.room_slug + '/meta', room);

            return response.results;
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
            response = await db.sql('select * from game_room_meta WHERE room_slug = ?', [room_slug]);

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
            let db = await mysql.db();
            var response;
            console.log("Deleting room: " + room_slug);

            response = await db.delete('game_room', 'WHERE room_slug = ?', [room_slug]);
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