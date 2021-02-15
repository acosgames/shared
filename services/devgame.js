const MySQL = require('./mysql');
const mysql = new MySQL();
const credutil = require('../util/credentials')
const { genUnique64string } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError, CodeError, SQLError } = require('../util/errorhandler');

module.exports = class DevGameService {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    async findGame(game, user, db) {
        try {
            if (game.id == 'undefined')
                return null;
            db = db || await mysql.db();
            var response;
            console.log("Searching for game: ", game);
            if (game.id) {
                response = await db.sql('select * from game_info where gameid = ? AND ownerid = ?', [{ toSqlString: () => game.id }, { toSqlString: () => user.id }]);
            }
            else if (game.gameid) {
                response = await db.sql('select * from game_info where gameid = ? AND ownerid = ?', [{ toSqlString: () => game.gameid }, { toSqlString: () => user.id }]);
            }
            else if (game.shortid) {
                response = await db.sql('select * from game_info where shortid = ? AND ownerid = ?', [game.shortid, { toSqlString: () => user.id }]);
            }

            if (response && response.results.length > 0)
                game = response.results[0];
            else
                return null;
            return game;
        }
        catch (e) {
            if (e instanceof GeneralError)
                return e;
            throw new CodeError(e);
        }
    }

    async findClient(client, user, db) {
        try {
            if (client.id == 'undefined')
                return null;
            db = db || await mysql.db();
            var response;
            console.log("Searching for client: ", client);
            if (client.id) {
                response = await db.sql('select * from game_client where gameid = ? AND ownerid = ? order by clientversion desc limit 1', [{ toSqlString: () => client.id }, { toSqlString: () => user.id }]);
            }
            else if (client.gameid) {
                response = await db.sql('select * from game_client where gameid = ? AND ownerid = ? order by clientversion desc limit 1', [{ toSqlString: () => client.gameid }, { toSqlString: () => user.id }]);
            }

            if (response && response.results.length > 0)
                client = response.results[0];
            else
                return null;
            return client;
        }
        catch (e) {
            if (e instanceof GeneralError)
                return e;
            throw new CodeError(e);
        }
    }

    async findServer(server, user, db) {
        try {
            if (server.id == 'undefined')
                return null;
            db = db || await mysql.db();
            var response;
            console.log("Searching for server: ", server);
            if (server.id) {
                response = await db.sql('select * from game_server where gameid = ? AND ownerid = ? order by serverversion desc limit 1', [{ toSqlString: () => server.id }, { toSqlString: () => user.id }]);
            }
            else if (server.gameid) {
                response = await db.sql('select * from game_server where gameid = ? AND ownerid = ? order by serverversion desc limit 1', [{ toSqlString: () => server.gameid }, { toSqlString: () => user.id }]);
            }

            if (response && response.results.length > 0)
                server = response.results[0];
            else
                return null;
            return server;
        }
        catch (e) {
            if (e instanceof GeneralError)
                return e;
            throw new CodeError(e);
        }
    }

    async updatePreviewImages(gameid, user, images) {

        try {
            let db = await mysql.db();

            let ownerid = user.id;

            let game = {};
            game.preview_images = images.join(',');

            let { results } = await db.update('game_info', game, 'gameid=? AND ownerid=?', [gameid, ownerid]);
            console.log(results);

            if (results.affectedRows > 0) {
                game.gameid = gameid;
                game.ownerid = ownerid;
                return game;
            }
        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE")) {
                    throw new GeneralError("E_GAME_DUPENAME", game.name);
                }
            }
            console.error(e);
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }

    async updateClient(client, user, db) {
        console.log(client);
        try {
            db = db || await mysql.db();
            let gameid = client.gameid;
            delete client['gameid'];

            let ownerid = client.ownerid;
            delete client['ownerid'];

            client.ownerid = user.id;

            let { results } = await db.update('game_client', client, 'gameid=? AND ownerid=? and clientversion = ?', [gameid, ownerid, client.clientversion]);
            console.log(results);

            if (results.affectedRows > 0) {
                client.gameid = gameid;
                client.ownerid = ownerid;
                return client;
            }
        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_client.gameidname_UNIQUE")) {
                    throw new GeneralError("E_CLIENT_DUPENAME", client.name);
                }
            }
            //console.error(e);
            throw new GeneralError("E_CLIENT_INVALID");
        }
        return null;
    }

    async updateServer(server, user, db) {
        console.log(server);
        try {
            db = db || await mysql.db();
            let gameid = server.gameid;
            delete server['gameid'];

            let ownerid = server.ownerid;
            delete server['ownerid'];

            server.ownerid = user.id;

            let { results } = await db.update('game_server', server, 'gameid=? AND ownerid=? and serverversion = ?', [gameid, ownerid, server.serverversion]);
            console.log(results);

            if (results.affectedRows > 0) {
                server.gameid = gameid;
                server.ownerid = ownerid;
                return server;
            }
        }
        catch (e) {

            //console.error(e);
            throw new GeneralError("E_SERVER_INVALID");
        }
        return null;
    }

    async updateGame(game, user, db) {
        console.log(game);
        try {
            db = db || await mysql.db();
            let gameid = game.gameid;
            delete game['gameid'];

            let ownerid = game.ownerid;
            delete game['ownerid'];

            game.ownerid = user.id;

            let { results } = await db.update('game_info', game, 'gameid=? AND ownerid=?', [gameid, ownerid]);
            console.log(results);

            if (results.affectedRows > 0) {
                game.gameid = gameid;
                game.ownerid = ownerid;
                return game;
            }
        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE")) {
                    throw new GeneralError("E_GAME_DUPENAME", game.name);
                }
            }
            //console.error(e);
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }

    async createClient(client, user, db) {
        console.log(client);
        try {
            db = db || await mysql.db();
            let newid = genUnique64string({
                datacenter: this.credentials.datacenter.index || 0,
                worker: this.credentials.datacenter.worker || 0
            });

            client.gameid = {
                toSqlString: () => newid
            }

            client.ownerid = {
                toSqlString: () => user.id
            }

            client.status = 'draft';

            let { results } = await db.insert('game_client', client);
            console.log(results);

            if (results.affectedRows > 0) {
                client.gameid = client.gameid.toSqlString();
                return client;
            }

        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE")) {
                    throw new GeneralError("E_CLIENT_DUPENAME", client.name);
                }
            }
            console.error(e);
            throw new GeneralError("E_CLIENT_INVALID");
        }
        return null;
    }

    async createServer(server, user, db) {
        console.log(server);
        try {
            db = db || await mysql.db();
            let newid = genUnique64string({
                datacenter: this.credentials.datacenter.index || 0,
                worker: this.credentials.datacenter.worker || 0
            });

            server.gameid = {
                toSqlString: () => newid
            }

            server.ownerid = {
                toSqlString: () => user.id
            }

            server.status = 'draft';

            let { results } = await db.insert('game_server', server);
            console.log(results);

            if (results.affectedRows > 0) {
                server.gameid = server.gameid.toSqlString();
                return server;
            }

        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE")) {
                    throw new GeneralError("E_SERVER_DUPENAME", server.name);
                }
            }
            console.error(e);
            throw new GeneralError("E_SERVER_INVALID");
        }
        return null;
    }

    async createGame(game, user, db) {
        console.log(game);
        try {
            db = db || await mysql.db();
            let newid = genUnique64string({
                datacenter: this.credentials.datacenter.index || 0,
                worker: this.credentials.datacenter.worker || 0
            });

            game.gameid = {
                toSqlString: () => newid
            }

            game.ownerid = {
                toSqlString: () => user.id
            }

            game.status = 'draft';

            let { results } = await db.insert('game_info', game);
            console.log(results);

            if (results.affectedRows > 0) {
                game.gameid = game.gameid.toSqlString();
                return game;
            }

        }
        catch (e) {
            //revert back to normal


            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE")) {
                    throw new GeneralError("E_GAME_DUPENAME", game.name);
                }
            }
            console.error(e);
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }

    async createOrUpdateClient(client, user) {

        try {
            let db = await mysql.begin('findOrCreateClient');

            let existing = await this.findClient(client, user, db);

            if (!existing)
                client = await this.createClient(client, user, db);
            else {
                client = await this.updateClient(client, user, db);
                client = Object.assign({}, existing, client)
            }

            await mysql.end('findOrCreateClient');
            return client;
        }
        catch (e) {
            await mysql.end('findOrCreateClient');
            throw e;
        }
    }

    async createOrUpdateServer(server, user) {

        try {
            let db = await mysql.begin('findOrCreateServer');

            let existing = await this.findServer(server, user, db);

            if (!existing)
                server = await this.createServer(server, user, db);
            else {
                server = await this.updateServer(server, user, db);
                server = Object.assign({}, existing, server)
            }

            await mysql.end('findOrCreateServer');
            return server;
        }
        catch (e) {
            await mysql.end('findOrCreateServer');
            throw e;
        }
    }

    async createOrUpdateGame(game, user) {

        try {
            let db = await mysql.begin('findOrCreateGame');

            let existing = await this.findGame(game, user, db);

            if (!existing)
                game = await this.createGame(game, user, db);
            else {
                game = await this.updateGame(game, user, db);
                game = Object.assign({}, existing, game)
            }

            await mysql.end('findOrCreateGame');
            return game;
        }
        catch (e) {
            await mysql.end('findOrCreateGame');
            throw e;
        }
    }
}