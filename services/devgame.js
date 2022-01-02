const MySQL = require('./mysql');
const mysql = new MySQL();
const credutil = require('../util/credentials')
const { genUnique64string, generateAPIKEY } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError, CodeError, SQLError } = require('../util/errorhandler');
const { validateSimple } = require('../util/validation');

const simpleGit = require('simple-git');



/**
 * You first need to create a formatting function to pad numbers to two digits…
 **/
function twoDigits(d) {
    if (0 <= d && d < 10) return "0" + d.toString();
    if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
    return d.toString();
}

/**
 * …and then create the method to output the date string as desired.
 * Some people hate using prototypes this way, but if you are going
 * to apply this to more than one Date object, having it as a prototype
 * makes sense.
 **/
function toMysqlFormat(date) {
    return date.getUTCFullYear() + "-" + twoDigits(1 + date.getUTCMonth()) + "-" + twoDigits(date.getUTCDate()) + " " + twoDigits(date.getUTCHours()) + ":" + twoDigits(date.getUTCMinutes()) + ":" + twoDigits(date.getUTCSeconds());
};

const gh = require('./github');

const StatusByName = {
    'Draft': 1,
    'Test': 2,
    'Production': 3,
    'Archive': 4,
    'Suspended': 5
}

const StatusById = [
    'None',
    'Draft',
    'Test',
    'Production',
    'Archive',
    'Suspended'
]

module.exports = class DevGameService {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    async findGames(userid) {
        try {
            if (!userid || userid == 'undefined')
                return [];

            let db = await mysql.db();
            var response;
            console.log("Searching for devgames with player count: ", userid);
            response = await db.sql(`
                select 
                    a.*, 
                    cur.scaled as scaled,
                    cur.db as db,
                    latest.scaled as latest_scaled,
                    latest.db as latest_db,
                    latest.tsupdate as latest_tsupdate,
                    b.role,
                    b.apikey
                from game_info a
                LEFT JOIN game_dev b ON b.gameid = a.gameid
                LEFT JOIN game_version cur ON cur.gameid = a.gameid AND cur.version = a.version
                LEFT JOIN game_version latest ON latest.gameid = a.gameid AND latest.version = a.latest_version
                where b.ownerid = ?
            `, [userid]);

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async findGameVersions(game, db) {
        try {
            if (game.id == 'undefined')
                return null;
            db = db || await mysql.db();
            var response;
            console.log("Searching for game: ", game);
            if (game.apikey) {
                let comment = game.apikey.indexOf('.');
                if (comment > -1) {
                    game.apikey = game.apikey.substr(comment + 1);
                }

                response = await db.sql(`
                    SELECT 
                        i.gameid, 
                        i.status as published_status, 
                        i.version as published_version, 
                        v.version as version, 
                        i.game_slug, 
                        i.ownerid, 
                        v.tsupdate as latest_tsupdate 
                    FROM game_info i, game_version v 
                    WHERE i.apikey = ? 
                    AND i.gameid = v.gameid 
                    ORDER by v.version desc 
                    LIMIT 3
                `, [game.apikey]);
            }
            else if (game.gameid) {
                response = await db.sql(`
                    SELECT 
                        i.gameid, 
                        i.status as published_status, 
                        i.version as published_version, 
                        v.version as version, 
                        i.game_slug, 
                        i.ownerid, 
                        v.tsupdate as latest_tsupdate 
                    FROM game_info i, game_version v 
                    WHERE i.gameid = ? 
                    AND i.gameid = v.gameid 
                    ORDER by v.version desc 
                    LIMIT 3
                `, [{ toSqlString: () => game.gameid }]);
            }

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async findDevByGame(gameid, ownerid) {
        try {
            if (gameid == 'undefined')
                return null;
            let db = await mysql.db();

            console.log("Searching for specific game developer: ", gameid, ownerid);

            var response = await db.sql('select * from game_dev where (gameid = ? OR game_slug = ?) AND ownerid = ?', [{ toSqlString: () => gameid }, gameid, { toSqlString: () => ownerid }]);

            var dev = null;
            if (response && response.results.length > 0) {
                dev = response.results[0];
            }
            return dev;
        }
        catch (e) {
            if (e instanceof GeneralError)
                return e;
            throw new CodeError(e);
        }
    }

    async findDevByAPIKey(apikey) {
        try {
            if (typeof apikey === 'undefined')
                return [];
            let db = await mysql.db();

            console.log("Searching for specific developer using apikey: ", apikey);

            var response = await db.sql('select * from game_dev where apikey = ?', [apikey]);

            var dev = null;
            if (response && response.results.length > 0) {
                dev = response.results[0];
            }
            return dev;
        }
        catch (e) {
            if (e instanceof GeneralError)
                return e;
            throw new CodeError(e);
        }
    }

    async findGame(game, user, db) {
        try {
            // if (game.gameid == 'undefined')
            //     return null;
            db = db || await mysql.db();
            var response;


            if (game.gameid) {

                console.log("Searching for dev game by gameid/ownerid: ", game.gameid, user.id);
                response = await db.sql(`
                    select 
                        a.*, 
                        cur.scaled as scaled,
                        cur.db as db,
                        latest.scaled as latest_scaled,
                        latest.db as latest_db,
                        latest.tsupdate as latest_tsupdate,
                        b.role,
                        b.apikey
                    from game_info a
                    LEFT JOIN game_dev b ON b.gameid = a.gameid
                    LEFT JOIN game_version cur ON cur.gameid = a.gameid AND cur.version = a.version
                    LEFT JOIN game_version latest ON latest.gameid = a.gameid AND latest.version = a.latest_version
                    where a.gameid = ? 
                `, [game.gameid, user.id]);
            }
            else if (game.game_slug) {
                console.log("Searching for dev game by gameid/ownerid: ", game.game_slug, user.id);
                response = await db.sql(`
                    select 
                        a.*, 
                        cur.scaled as scaled,
                        cur.db as db,
                        latest.scaled as latest_scaled,
                        latest.db as latest_db,
                        latest.tsupdate as latest_tsupdate,
                        b.role,
                        b.apikey
                    from game_info a
                    LEFT JOIN game_dev b ON b.gameid = a.gameid
                    LEFT JOIN game_version cur ON cur.gameid = a.gameid AND cur.version = a.version
                    LEFT JOIN game_version latest ON latest.gameid = a.gameid AND latest.version = a.latest_version
                    where a.game_slug = ? 
                `, [game.game_slug, user.id]);
            }
            // else if (game.shortid) {
            //     response = await db.sql('select * from game_info where shortid = ? AND ownerid = ?', [game.shortid, { toSqlString: () => user.id }]);
            // }
            else if (game.apikey) {
                let comment = game.apikey.indexOf('.');
                if (comment > -1) {
                    game.apikey = game.apikey.substr(comment + 1);
                }

                console.log("Searching for dev game by apikey: ", game.apikey);
                response = await db.sql(`
                    select 
                        a.*, 
                        cur.scaled as scaled,
                        cur.db as db,
                        latest.scaled as latest_scaled,
                        latest.db as latest_db,
                        latest.tsupdate as latest_tsupdate,
                        b.role,
                        b.apikey
                    from game_info a
                    LEFT JOIN game_dev b ON b.gameid = a.gameid
                    LEFT JOIN game_version cur ON cur.gameid = a.gameid AND cur.version = a.version
                    LEFT JOIN game_version latest ON latest.gameid = a.gameid AND latest.version = a.latest_version
                    where b.apikey = ? 
                `, [game.apikey]);
            }

            var foundGame = null;
            if (response && response.results.length > 0) {
                foundGame = response.results[0];
                //     foundGame.clients = await this.findClient({ gameid: foundGame.gameid }, db);
                //     foundGame.servers = await this.findServer({ gameid: foundGame.gameid }, db);
            }

            return foundGame;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async findClient(client, db) {
        try {
            if (client.id == 'undefined')
                return [];
            db = db || await mysql.db();
            var response;
            console.log("Searching for client: ", client);
            if (client.id) {
                response = await db.sql('select * from game_client where id = ?', [{ toSqlString: () => client.id }]);
            }
            else if (client.gameid) {
                response = await db.sql('select * from game_client where gameid = ?', [{ toSqlString: () => client.gameid }]);
            }

            var clients = [];
            if (response && response.results.length > 0)
                clients = response.results;

            return clients;
        }
        catch (e) {
            if (e instanceof GeneralError)
                return e;
            throw new CodeError(e);
        }
    }

    async findServer(server, db) {
        try {
            if (server.id == 'undefined')
                return [];
            db = db || await mysql.db();
            var response;
            console.log("Searching for server: ", server);
            if (server.id) {
                response = await db.sql('select * from game_server where gameid = ?', [{ toSqlString: () => server.id }]);
            }
            else if (server.gameid) {
                response = await db.sql('select * from game_server where gameid = ?', [{ toSqlString: () => server.gameid }]);
            }

            var servers = [];
            if (response && response.results.length > 0) {
                servers = response.results;
            }
            return servers;
        }
        catch (e) {
            if (e instanceof GeneralError)
                return e;
            throw new CodeError(e);
        }
    }

    async updateClientPreviewImages(clientid, user, images) {

        try {
            let db = await mysql.db();
            let newClient = { preview_images: client.preview_images };
            let { results } = await db.update('game_client', newClient, 'id=? AND ownerid=?', [client.id, user.id]);
            console.log(results);

            if (results.affectedRows > 0)
                return client;
        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_client.name_UNIQUE") > -1) {
                    throw new GeneralError("E_CLIENT_DUPENAME", client.name);
                }
                if (e.payload.sqlMessage.indexOf("game_client.shortid_UNIQUE") > -1) {
                    throw new GeneralError("E_CLIENT_DUPESHORTNAME", client.shortid);
                }
            }
            console.error(e);
            throw new GeneralError("E_CLIENT_INVALID");
        }
        return null;
    }

    statusId(name) {
        if (name in StatusByName)
            return StatusByName[name];
        return 1;
    }

    statusName(id) {
        if (id > 0 && id < StatusById.length)
            return StatusById[id];
        return 'Draft';
    }

    async addDBtoGameVersion(game) {

        try {
            let db = await mysql.db();
            let gameVersion = {
                db: true,
            }

            let { results } = await db.update('game_version', gameVersion, 'WHERE gameid = ? AND version = ?', [game.gameid, game.version]);
            console.log(results);

            //save the latest db in game_info
            let { results2 } = await db.update('game_info', { latest_db: true }, 'WHERE gameid = ?', [game.gameid])
            console.log(results2);

            return gameVersion;
        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                // if (e.payload.sqlMessage.indexOf("game_client.name_UNIQUE") > -1) {
                //     throw new GeneralError("E_CLIENT_DUPENAME", client.name);
                // }
            }
            console.error(e);
            throw new GeneralError("E_GAMEVERSION_INVALID");
        }
        return null;
    }

    async updateGameInfoAboutVersion(game) {
        try {
            let db = await mysql.db();

            // let gameVersion = {
            //     gameid: {
            //         toSqlString: () => game.gameid
            //     },
            //     version: game.version,
            //     status: 2,
            //     gamesplayed: 0,
            //     db: 0
            // }

            // let { results } = await db.update('game_version', { status: 2 }, 'gameid = ? AND version = ?', [game.gameid, game.version]);
            // console.log(results);

            let published_status = game.published_status;
            if (published_status == 1) {
                published_status = 2;
            }
            //save the latest version in game_info
            let { results2 } = await db.update('game_info', { status: published_status, latest_version: game.version, latest_tsupdate: toMysqlFormat(new Date()) }, 'gameid = ?', [game.gameid])
            console.log(results2);

            if (results.affectedRows > 0) {
                gameVersion.gameid = game.gameid;
                return gameVersion;
            }
        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                // if (e.payload.sqlMessage.indexOf("game_client.name_UNIQUE") > -1) {
                //     throw new GeneralError("E_CLIENT_DUPENAME", client.name);
                // }
            }
            console.error(e);
            throw new GeneralError("E_GAMEVERSION_INVALID");
        }
        return null;
    }

    async createGameVersion(game, hasDB, scaled) {

        try {
            let db = await mysql.db();

            let gameVersion = {
                gameid: {
                    toSqlString: () => game.gameid
                },
                version: game.latest_version + 1,
                status: 2,
                scaled: scaled ? 1 : 0,
                db: hasDB ? 1 : 0
            }
            let { results } = await db.insert('game_version', gameVersion);
            console.log(results);

            //if we are draft status, change to experimental status
            let published_status = game.status;
            if (published_status == 1) {
                published_status = 2;
            }
            let { results2 } = await db.update('game_info', {
                status: published_status,
                latest_version: gameVersion.version
            }, 'gameid = ?', [game.gameid])

            console.log(results2);

            if (results.affectedRows > 0) {
                gameVersion.gameid = game.gameid;
                return gameVersion;
            }
        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                // if (e.payload.sqlMessage.indexOf("game_client.name_UNIQUE") > -1) {
                //     throw new GeneralError("E_CLIENT_DUPENAME", client.name);
                // }
            }
            console.error(e);
            throw new GeneralError("E_GAMEVERSION_INVALID");
        }
        return null;
    }

    async updateClientBundle(client, user, build_client) {

        try {
            let db = await mysql.db();
            let insertClient = { build_client: client.build_client, clientversion: client.clientversion };

            let updateClient = { status: this.statusId('Archive') }
            let { results } = await db.update('game_client', updateClient, 'id=? AND ownerid=? AND status=?', [client.id, user.id, this.statusId('Test')]);


            console.log(results);

            if (results.affectedRows > 0) {
                return client;
            }
        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_client.name_UNIQUE") > -1) {
                    throw new GeneralError("E_CLIENT_DUPENAME", client.name);
                }
            }
            console.error(e);
            throw new GeneralError("E_CLIENT_INVALID");
        }
        return null;
    }

    async updatePreviewImages(game_slug, user, images) {

        try {


            let ownerid = user.id;

            let game = {};
            game.preview_images = images.join(',');

            let dev = await this.findDevByGame(game_slug, ownerid);
            if (!dev)
                throw new GeneralError("E_NOTAUTHORIZED");
            let db = await mysql.db();
            let { results } = await db.update('game_info', game, 'game_slug=?', [game_slug,]);
            console.log(results);

            if (results.affectedRows > 0) {
                game.game_slug = game_slug;
                game.ownerid = ownerid;
                return game;
            }
        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE") > -1) {
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
                if (e.payload.sqlMessage.indexOf("game_client.gameidname_UNIQUE") > -1) {
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

            let clients = game.clients;
            let servers = game.servers;
            delete game['clients'];
            delete game['servers'];

            if (game.game_slug)
                delete game['game_slug'];
            let apikey = game.apikey;
            delete game['apikey'];
            //game.ownerid = user.id;
            // game.apikey = generateAPIKEY();

            let newGame = {
                name: game.name,
                shortdesc: game.shortdesc,
                longdesc: game.longdesc,
                minplayers: game.minplayers,
                maxplayers: game.maxplayers,
                teams: game.teams,
                opensource: game.opensource ? 1 : 0
            }

            let dbresult;
            if (apikey) {
                let comment = apikey.indexOf('.');
                if (comment > -1) {
                    apikey = apikey.substr(comment + 1);
                }

                let dev = await this.findDevByAPIKey(apikey);
                if (!dev) {
                    throw new GeneralError("E_NOTAUTHORIZED");
                }

                let { results } = await db.update('game_info', newGame, 'gameid=?', [gameid]);
                dbresult = results;
                console.log(dbresult);
                game.gameid = gameid;
                game.ownerid = ownerid;
                return game;

            }
            else {

                let dev = await this.findDevByGame(gameid, user.id);
                if (!dev) {
                    throw new GeneralError("E_NOTAUTHORIZED");
                }

                let { results } = await db.update('game_info', newGame, 'gameid=?', [gameid]);
                dbresult = results;
                console.log(dbresult);
                if (dbresult.affectedRows > 0) {
                    game.gameid = gameid;
                    game.ownerid = ownerid;
                    return game;
                }

            }



        }
        catch (e) {
            console.error(e);
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE") > -1) {
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

            client.id = {
                toSqlString: () => newid
            }

            client.ownerid = {
                toSqlString: () => user.id
            }

            client.status = this.statusId('Draft');

            let { results } = await db.insert('game_client', client);
            console.log(results);

            if (results.affectedRows > 0) {
                client.id = client.id.toSqlString();
                return client;
            }

        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE") > -1) {
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

            server.id = {
                toSqlString: () => newid
            }

            server.ownerid = {
                toSqlString: () => user.id
            }

            server.status = 'draft';

            let { results } = await db.insert('game_server', server);
            console.log(results);

            if (results.affectedRows > 0) {
                server.id = server.id.toSqlString();
                return server;
            }

        }
        catch (e) {
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE") > -1) {
                    throw new GeneralError("E_SERVER_DUPENAME", server.name);
                }
            }
            console.error(e);
            throw new GeneralError("E_SERVER_INVALID");
        }
        return null;
    }

    async deployGame(game, user, db) {
        console.log(game);
        try {
            db = db || await mysql.db();

            let dev = await this.findDevByGame(game.gameid, user.id);
            if (!dev)
                throw new GeneralError("E_NOTAUTHORIZED");


            let deployedGame = {
                version: game.version
            }

            let { results } = await db.update('game_info', deployedGame, 'gameid=?', [game.gameid]);
            console.log(results);

            if (results.affectedRows > 0)
                return deployedGame;

        }
        catch (e) {
            console.log(e);
            if (e instanceof GeneralError)
                return e;

            //revert back to normal
            throw new GeneralError("E_GAME_INVALID");
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

            game.gameid = { toSqlString: () => newid }
            game.ownerid = { toSqlString: () => user.id }
            game.game_slug = game.game_slug.toLowerCase();
            game.status = this.statusId('Draft');
            game.version = 0;
            game.latest_version = 0;

            let errors = validateSimple('game_info', game);
            if (errors.length > 0) {
                throw new GeneralError("E_GAME_INVALID");
            }

            let response = await db.insert('game_info', game);
            console.log(response.results);
            // await this.createGameBuilds(game, user, db);

            let dev = {
                gameid: game.gameid,
                ownerid: game.ownerid,
                role: 0,
                apikey: generateAPIKEY()
            }
            let response2 = await db.insert('game_dev', dev);
            console.log(response2.results);


            await this.createGitHubRepos(game, user, db);
            await this.assignUserToRepo(game, user, db);

            if (response.results.affectedRows > 0 && response2.results.affectedRows > 0) {
                game.gameid = game.gameid.toSqlString();
                return game;
            }

        }
        catch (e) {
            //revert back to normal


            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("game_info.name_UNIQUE") > -1) {
                    throw new GeneralError("E_GAME_DUPENAME", game.name);
                }
                if (e.payload.sqlMessage.indexOf("game_info.game_slug_UNIQUE") > -1) {
                    throw new GeneralError("E_GAME_DUPESHORTNAME", game.game_slug);
                }
            }
            console.error(e);
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }

    async createGameBuilds(game, user, db) {

        try {
            db = db || await mysql.db();

            game.clients = [null, null];
            let testClient = {
                gameid: game.gameid,
                ownerid: user.id,
                clientversion: 1,
                serverversion: 1,
                env: 0,
                status: this.statusId('Draft')
            };
            testClient = await this.createClient(testClient, user, db);

            await this.createGitHubRepos(game, user, db);

            let repoName = game.shortid;
            let templateName = 'tictactoe';
            await this.pushGitGameTemplates(repoName, templateName, 'client');
            await this.pushGitGameTemplates(repoName, templateName, 'server');

            game.clients[testClient.env] = testClient;
        }
        catch (e) {
            console.error(e);
        }

    }

    async pushGitGameTemplates(repoName, templateName, type) {
        try {
            let org = 'acosgames';

            let url = `git@github.com:${org}/${repoName}-${type}.git`;
            let dir = `${process.cwd()}/../templates/${templateName}-${type}`;

            //await git.raw('remote', 'set-url', 'origin', url)
            console.log("Current Working Directory: " + dir);
            const git = simpleGit(dir);
            await git.raw('push', '--mirror', url);
        }
        catch (e) {
            console.error(e);
        }
    }

    async inviteToGithub(user) {
        if (!('github' in user) || !user.github) {
            return false;
        }

        if (user.isdev)
            return true;

        try {
            let orgInviteResult = await gh.orgs.createInvitation({ org: 'acosgames', email: user.email, role: 'direct_member' })
            console.log(orgInviteResult);
            return true;
        }
        catch (e3) {
            console.error(e3);
        }
    }

    async assignUserToRepo(game, user, db) {


        try {

            let result = await gh.repos.addCollaborator({
                owner: 'acosgames',
                repo: game.game_slug,
                username: user.github,
                permission: 'admin'
            })
            console.log(result);
            return result;
        }
        catch (e) {
            console.error(e);
        }
    }

    async createGitHubRepos(game, user, db) {

        let org = 'acosgames';
        let name = game.game_slug;
        let description = game.shortdesc;
        let visibility = 'public';
        let has_issues = true;
        let has_wiki = true;

        let parent_team_id = user.github_teamid;

        try {
            let clientImport = await gh.repos.createInOrg({
                org,
                name,
                description,
                'private': false,
                visibility,
                has_issues
            });
            console.log(clientImport);
        }
        catch (e) {
            console.error(e);
        }

        // try {
        //     let maintainers = [];
        //     let privacy = 'closed';
        //     let repo_names = [org + '/' + name];

        //     //attempt to create the team using acosgames username as the team name
        //     let teamResult = await gh.teams.create({ org, name, maintainers, repo_names, privacy, parent_team_id })
        //     console.log(teamResult);
        // }
        // catch (e) {
        //     console.error(e);
        // }


        // name = shortid + '-server';

        // try {
        //     let serverImport = await gh.repos.createInOrg({ org, name, description, 'private': false, visibility, has_issues });
        //     console.log(serverImport);
        // }
        // catch (e) {
        //     console.error(e);
        // }

        // try {
        //     let maintainers = [];
        //     let privacy = 'closed';
        //     let repo_names = [org + '/' + name];
        //     let team_id = user.github_teamid;
        //     //attempt to create the team using acosgames username as the team name
        //     let teamResult = await gh.teams.create({ org, name, maintainers, repo_names, privacy, parent_team_id })
        //     console.log(teamResult);
        // }
        // catch (e) {
        //     console.error(e);
        // }

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

            let existing = await this.findGame(game, db);

            if (!existing) {
                game = await this.createGame(game, user, db);


                // let prodClient = {
                //     gameid: game.gameid,
                //     ownerid: user.id,
                //     clientversion: 1,
                //     serverversion: 1,
                //     env: 1,
                //     status: this.statusId('Draft')
                // };
                // prodClient = await this.createClient(prodClient, user, db);
                // game.clients[prodClient.env] = testClient;
            }
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