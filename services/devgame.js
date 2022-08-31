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

    async findGamesByStatus(userid) {
        let games = await this.findGames(userid);

        let gamesByStatus = {};

        for (var i = 0; i < games.length; i++) {
            let game = games[i];
            let status = StatusById[game.status] || 'Draft';

            if (!gamesByStatus[status])
                gamesByStatus[status] = [];

            gamesByStatus[status].push(game);
        }

        return gamesByStatus;
    }

    async findGames(userid) {
        try {
            if (!userid || userid == 'undefined')
                return [];

            let db = await mysql.db();
            var response;
            console.log("Searching for devgames with player count: ", userid);
            response = await db.sql(`
            SELECT 
                votes.totalVotes,
                ranks.totalPlays,
                a.*,
                cur.db AS db,
                cur.screentype AS screentype,
                cur.resow AS resow,
                cur.resoh AS resoh,
                cur.screenwidth AS screenwidth,
                latest.screentype AS latest_screentype,
                latest.resow AS latest_resow,
                latest.resoh AS latest_resoh,
                latest.screenwidth AS latest_screenwidth,
                latest.db AS latest_db,
                latest.tsupdate AS latest_tsupdate,
                b.role,
                b.apikey
            FROM
                game_info a
                LEFT JOIN game_dev b 
                    ON b.gameid = a.gameid
                LEFT JOIN game_version cur 
                    ON cur.gameid = a.gameid AND cur.version = a.version
                LEFT JOIN game_version latest 
                    ON latest.gameid = a.gameid AND latest.version = a.latest_version
                LEFT JOIN (
                    SELECT 
                        r.game_slug, SUM(r.vote) AS totalVotes
                    FROM
                        game_review r, game_info info, game_dev dev
                    WHERE
                        info.gameid = dev.gameid
                            AND r.game_slug = info.game_slug
                            AND dev.ownerid = ?
                    GROUP BY r.game_slug
                ) votes 
                    ON a.game_slug = votes.game_slug
                LEFT JOIN (
                    SELECT 
                        r.game_slug, SUM(r.played) AS totalPlays
                    FROM
                        person_rank r, game_info info, game_dev dev
                    WHERE
                        info.gameid = dev.gameid
                            AND r.game_slug = info.game_slug
                            AND dev.ownerid = ?
                    GROUP BY r.game_slug
                ) ranks 
                    ON a.game_slug = ranks.game_slug
            WHERE b.ownerid = ?
            `, [userid, userid, userid]);

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async findGameTemplates() {
        try {
            let db = await mysql.db();
            var response;
            // console.log("Searching for game templates");
            response = await db.sql(`
                select 
                    a.game_slug,
                    a.name,
                    a.preview_images
                from game_info a
                WHERE a.opensource = 1
            `, []);

            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }


    async findDevByGame(gameid, ownerid) {
        try {
            if (gameid == 'undefined')
                return null;
            let db = await mysql.db();

            console.log("Searching for specific game developer: ", gameid, ownerid);

            var response = await db.sql('select * from game_dev where (gameid = ?) AND ownerid = ?', [{ toSqlString: () => gameid }, { toSqlString: () => ownerid }]);

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
                        cur.db as db,
                        cur.screentype as screentype,
                        cur.resow as resow,
                        cur.resoh as resoh,
                        cur.screenwidth as screenwidth,
                        latest.screentype as latest_screentype,
                        latest.resow as latest_resow,
                        latest.resoh as latest_resoh,
                        latest.screenwidth as latest_screenwidth,
                        latest.db as latest_db,
                        latest.tsupdate as latest_tsupdate,
                        b.role,
                        b.apikey
                    from game_info a
                    LEFT JOIN game_dev b ON b.gameid = a.gameid
                    LEFT JOIN game_version cur ON cur.gameid = a.gameid AND cur.version = a.version
                    LEFT JOIN game_version latest ON latest.gameid = a.gameid AND latest.version = a.latest_version
                    where a.gameid = ? 
                    AND b.ownerid = ?
                `, [game.gameid, user.id]);
            }
            else if (game.game_slug) {
                console.log("Searching for dev game by gameid/ownerid: ", game.game_slug, user.id);
                response = await db.sql(`
                    select 
                        a.*, 
                        cur.db as db,
                        cur.screentype as screentype,
                        cur.resow as resow,
                        cur.resoh as resoh,
                        cur.screenwidth as screenwidth,
                        latest.screentype as latest_screentype,
                        latest.resow as latest_resow,
                        latest.resoh as latest_resoh,
                        latest.screenwidth as latest_screenwidth,
                        latest.db as latest_db,
                        latest.tsupdate as latest_tsupdate,
                        b.role,
                        b.apikey
                    from game_info a
                    LEFT JOIN game_dev b ON b.gameid = a.gameid
                    LEFT JOIN game_version cur ON cur.gameid = a.gameid AND cur.version = a.version
                    LEFT JOIN game_version latest ON latest.gameid = a.gameid AND latest.version = a.latest_version
                    where a.game_slug = ? 
                    AND b.ownerid = ?
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
                        cur.db as db,
                        cur.screentype as screentype,
                        cur.resow as resow,
                        cur.resoh as resoh,
                        cur.screenwidth as screenwidth,
                        latest.screentype as latest_screentype,
                        latest.resow as latest_resow,
                        latest.resoh as latest_resoh,
                        latest.screenwidth as latest_screenwidth,
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

                let teams = await this.findGameTeams(foundGame.game_slug);

                if (teams) {
                    foundGame.teams = teams;
                }
            }

            return foundGame;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async findGameTeams(game_slug) {
        try {

            let db = await mysql.db();
            var response;

            console.log("Searching for dev game teams by game_slug: ", game_slug);
            response = await db.sql(`
                    SELECT * FROM game_team a
                    WHERE a.game_slug = ?
                    ORDER BY a.team_order ASC
                `, [game_slug]);



            return response.results;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }

    async updateGameTeams(game_slug, teams) {
        try {
            let db = await mysql.db();

            let existingTeams = await this.findGameTeams(game_slug);
            let existingMap = {};
            if (existingTeams) {
                for (const team of existingTeams) {
                    existingMap[team.team_slug] = team;
                }
            }

            let updatedMap = {};
            for (const team of teams) {
                updatedMap[team.team_slug] = team;
            }

            let removedTeams = [];
            for (const team_slug in existingMap) {
                if (!(team_slug in updatedMap)) {
                    removedTeams.push(team_slug);
                }
            }

            if (removedTeams.length > 0) {
                console.log("Removing teams: ", removedTeams);
                const { results2, fields2 } = await db.delete('game_team', 'game_slug = ? AND team_slug in (?)', [game_slug, removedTeams]);
            }

            console.log("Adding/Updating teams: ", teams);
            const { results, fields } = await db.insertBatch('game_team', teams, ['game_slug', 'team_slug']);
            return results;

        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
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


    async createGameVersion(game, hasDB, screentype, resow, resoh, screenwidth) {

        try {
            let db = await mysql.db();

            let gameVersion = {
                gameid: {
                    toSqlString: () => game.gameid
                },
                version: game.latest_version + 1,
                status: 2,
                screentype, resow, resoh, screenwidth,
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
                latest_version: gameVersion.version,
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



    async updatePreviewImages(gameid, game_slug, user, images) {

        try {


            let ownerid = user.id;

            let game = {};
            game.preview_images = images.join(',');

            let dev = await this.findDevByGame(gameid, ownerid);
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
            if (e.ecode)
                throw e;
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }


    async updateGame(game, user, db) {
        console.log(game);
        try {
            db = db || await mysql.db();

            let gameFull = await this.findGame(game, user);
            if (!gameFull) {
                throw new GeneralError("E_NOTAUTHORIZED");
            }

            if (gameFull.status == 5) {
                throw new GeneralError("E_SUSPENDED");
            }

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

            let version = game.version;
            if (!Number.isInteger(version) || version < 0 || version > gameFull.latest_version) {
                version = gameFull.version;
            }
            if (game.visible < 0 || game.visible > 2)
                game.visible = 1;

            let newGame = {
                name: game.name,
                shortdesc: game.shortdesc,
                longdesc: game.longdesc,
                minplayers: game.minplayers,
                maxplayers: game.maxplayers,
                lbscore: game.lbscore,
                maxteams: game.maxteams,
                minteams: game.minteams,
                visible: game.visible,
                version,
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

                let teams = [];
                if (game.teams) {
                    teams = game.teams;
                    delete game.teams;

                    let teamResult = await this.updateGameTeams(gameFull.game_slug, teams);

                    game.teams = teams;
                }


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

                    let teams = [];
                    if (game.teams) {
                        teams = game.teams;
                        delete game.teams;

                        let teamResult = await this.updateGameTeams(gameFull.game_slug, teams);

                        game.teams = teams;
                    }

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
            if (e.ecode)
                throw e;
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }

    async updateGameAPIKey(game, user, db) {
        console.log(game);
        try {
            db = db || await mysql.db();

            let gameFull = await this.findGame(game, user);
            if (!gameFull) {
                throw new GeneralError("E_NOTAUTHORIZED");
            }

            if (gameFull.status == 5) {
                throw new GeneralError("E_SUSPENDED");
            }

            let dev = await this.findDevByGame(game.gameid, user.id);
            if (!dev)
                throw new GeneralError("E_NOTAUTHORIZED");


            let newGameDev = {
                apikey: generateAPIKEY()
            }

            let { results } = await db.update('game_dev', newGameDev, 'gameid=? AND ownerid = ?', [game.gameid, user.id]);
            console.log(results);

            dev.apikey = newGameDev.apikey;

            if (results.affectedRows > 0)
                return dev;

        }
        catch (e) {
            console.log(e);


            //revert back to normal
            if (e.ecode)
                throw e;
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }

    async deployGame(game, user, db) {
        console.log(game);
        try {
            db = db || await mysql.db();

            let gameFull = await this.findGame(game, user);
            if (!gameFull) {
                throw new GeneralError("E_NOTAUTHORIZED");
            }

            if (gameFull.status == 5) {
                throw new GeneralError("E_SUSPENDED");
            }

            let dev = await this.findDevByGame(game.gameid, user.id);
            if (!dev)
                throw new GeneralError("E_NOTAUTHORIZED");


            let deployedGame = {
                version: game.version,
                status: 3 //production
            }

            let { results } = await db.update('game_info', deployedGame, 'gameid=?', [game.gameid]);
            console.log(results);

            if (results.affectedRows > 0)
                return deployedGame;

        }
        catch (e) {
            console.log(e);


            //revert back to normal
            if (e.ecode)
                throw e;
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }


    async deleteGame(game, user) {
        console.log(game);
        try {
            let db = await mysql.db();

            let gameFull = await this.findGame(game, user);

            if (!gameFull) {
                throw new GeneralError("E_GAME_INVALID");
            }

            if (gameFull.status != 1) {
                throw new GeneralError("E_GAME_NOT_DRAFT");
            }

            let dev = await this.findDevByGame(gameFull.gameid, user.id);
            if (!dev || Number(dev.role) != 0)
                throw new GeneralError("E_NOTAUTHORIZED");

            let response = await db.delete('game_info', 'gameid = ? AND ownerid = ?', [game.gameid, user.id]);
            console.log(response.results);

            let response2 = await db.delete('game_dev', 'gameid = ?', [game.gameid]);
            console.log(response2.results);

            await this.deleteGithubRepo(gameFull);

            return { 'status': 'success' };
        }
        catch (e) {
            //revert back to normal
            console.error(e);
            if (e.ecode)
                throw e;
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }

    async archiveGame(game, user) {
        console.log(game);
        try {
            db = db || await mysql.db();

            let gameFull = await this.findGame(game, user);

            if (!gameFull) {
                throw new GeneralError("E_GAME_INVALID");
            }

            if (gameFull.status != 1) {
                throw new GeneralError("E_GAME_NOT_DRAFT");
            }

            let dev = await this.findDevByGame(gameFull.gameid, user.id);
            if (!dev || Number(dev.role) != 0)
                throw new GeneralError("E_NOTAUTHORIZED");


            let deployedGame = {
                status: 4 //archived
            }

            let { results } = await db.update('game_info', deployedGame, 'gameid=? and ownerid = ?', [gameFull.gameid, user.id]);
            console.log(results);

        }
        catch (e) {
            //revert back to normal
            console.error(e);
            if (e.ecode)
                throw e;
            throw new GeneralError("E_GAME_INVALID");
        }
        return null;
    }

    async createGame(game, user, db) {
        console.log(game);
        try {
            db = db || await mysql.db();

            let gamesByStatus = await this.findGamesByStatus(user.id);
            let draftGames = gamesByStatus['Draft'] || [];

            if (draftGames.length >= 2) {
                throw new GeneralError('E_TOO_MANY_DRAFT_GAMES');
            }

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
            if (e.ecode)
                throw e;
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
            if (e.ecode)
                throw e;
            throw new GeneralError("E_GAME_INVALID");
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

        //game template was defined, try to create repo with that template
        if (game.template.length > 2) {

            try {
                let repo = await gh.repos.createUsingTemplate({
                    template_owner: org,
                    template_repo: game.template,
                    owner: org,
                    name,
                    description,
                    include_all_branches: true,
                    private: false
                })

                return;
            }
            catch (e) {
                console.error(e);
            }

        }

        //if it fails, just create an empty repo
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

    }


    async deleteGithubRepo(game) {

        let owner = 'acosgames';
        let repo = game.game_slug;

        try {
            let deletedResult = await gh.repos.delete({
                owner,
                repo
            });
            console.log(deletedResult);
        }
        catch (e) {
            console.error(e);
        }

    }

}