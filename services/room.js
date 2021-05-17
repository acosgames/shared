const MySQL = require('./mysql');
const mysql = new MySQL();

const credutil = require('../util/credentials')
const { genUnique64string, genShortId } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError, CodeError, SQLError } = require('../util/errorhandler');

const redis = require('./redis');

module.exports = class RoomService {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    async findRooms(game_slug) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of rooms");
            response = await db.sql('select r.room_slug as room_slug, m.player_count as player_count from game_room r, game_room_meta m WHERE (r.game_slug = ?) AND r.isprivate = 0', [game_slug, game_slug]);

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async findAnyRoom(game_slug) {
        try {
            let rooms = await this.findRooms(game_slug);
            if (!rooms || rooms.length == 0) {
                return await this.createRoom(game_slug);
            }

            let index = Math.floor(Math.random() * rooms.length);
            let room = rooms[index];

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

    async createRoom(game_slug, private_key) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting list of rooms");
            let room = {
                room_slug: genShortId(5),
                game_slug: game_slug,
                isprivate: 0
            }
            if (private_key) {
                room.isprivate = 1;
                room.private_key = private_key;
            }
            response = await db.insert('game_room', room);

            let room_meta = {
                room_slug: room.room_slug,
                player_count: 0
            }
            response = await db.insert('game_room_meta', room_meta);

            redis.set(room.room_slug, {
                state: {},
                game_slug
            })

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

            response = await db.delete('game_room', 'WHERE room_slug = ?', [room_meta]);
            response = await db.delete('game_room_meta', 'WHERE room_slug = ?', [room_meta]);

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