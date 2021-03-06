const MySQL = require('./mysql');
const mysql = new MySQL();
const credutil = require('../util/credentials')
const { genUnique64string } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError, CodeError, SQLError } = require('../util/errorhandler');
const { validateSimple } = require('../util/validation');

const simpleGit = require('simple-git');



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
            console.log("Searching for games by user: ", userid);
            response = await db.sql('select * from game_info where ownerid = ?', [userid]);

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }



    async findGame(game, db) {
        try {
            if (game.id == 'undefined')
                return null;
            db = db || await mysql.db();
            var response;
            console.log("Searching for game: ", game);
            if (game.id) {
                response = await db.sql('select * from game_info where gameid = ?', [{ toSqlString: () => game.id }]);
            }
            else if (game.gameid) {
                response = await db.sql('select * from game_info where gameid = ?', [{ toSqlString: () => game.gameid }]);
            }
            else if (game.shortid) {
                response = await db.sql('select * from game_info where shortid = ?', [game.shortid]);
            }

            var foundGame = null;
            if (response && response.results.length > 0) {
                foundGame = response.results[0];
                foundGame.clients = await this.findClient({ gameid: foundGame.gameid }, db);
                foundGame.servers = await this.findServer({ gameid: foundGame.gameid }, db);
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

            game.shortid = game.shortid.toLowerCase();

            game.status = this.statusId('Draft');

            let { results } = await db.insert('game_info', game);
            console.log(results);

            let errors = validateSimple('game_info', game);
            if (errors.length > 0) {
                throw new GeneralError("E_GAME_INVALID");
            }


            await this.createGameBuilds(game, user, db);

            if (results.affectedRows > 0) {
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
                if (e.payload.sqlMessage.indexOf("game_info.shortid_UNIQUE") > -1) {
                    throw new GeneralError("E_GAME_DUPESHORTNAME", game.shortid);
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
            let org = 'fivesecondgames';

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

    async createGitHubRepos(game, user, db) {
        let shortid = game.shortid;
        let username = user.displayname;

        let org = 'fivesecondgames';
        let name = shortid + '-client';
        let description = game.shortdesc;
        let visibility = 'public';
        let has_issues = true;
        let has_wiki = true;

        let parent_team_id = user.github_teamid;

        try {
            let clientImport = await gh.repos.createInOrg({ org, name, description, 'private': false, visibility, has_issues });
            console.log(clientImport);
        }
        catch (e) {
            console.error(e);
        }

        // try {
        //     let maintainers = [];
        //     let privacy = 'closed';
        //     let repo_names = [org + '/' + name];

        //     //attempt to create the team using fsg username as the team name
        //     let teamResult = await gh.teams.create({ org, name, maintainers, repo_names, privacy, parent_team_id })
        //     console.log(teamResult);
        // }
        // catch (e) {
        //     console.error(e);
        // }


        name = shortid + '-server';

        try {
            let serverImport = await gh.repos.createInOrg({ org, name, description, 'private': false, visibility, has_issues });
            console.log(serverImport);
        }
        catch (e) {
            console.error(e);
        }

        // try {
        //     let maintainers = [];
        //     let privacy = 'closed';
        //     let repo_names = [org + '/' + name];
        //     let team_id = user.github_teamid;
        //     //attempt to create the team using fsg username as the team name
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