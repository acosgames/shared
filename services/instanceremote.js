
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

const { GeneralError, SQLError } = require('../util/errorhandler');
const { genUnique64string } = require('../util/idgen');

const MySQL = require('./mysql');
const mysql = new MySQL();


const InstanceDefinition = {
    public_addr: '',
    private_addr: '',
    connect_addr: '',
    hostname: '',
    zone: 0,
    instance_type: 0,
    player_count: 0,
    game_count: 0,

}

module.exports = class InstanceRemote {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    async register(params) {
        try {
            let db = await mysql.db();

            let server = await this.findServer(params, db);
            let foundServer = server != null;



            if (!foundServer) {
                server = await this.createServer(params, db);
            }
            else {
                delete params['id'];
                let merged = Object.assign({}, server, params);
                server = await this.updateServer(merged, db);
            }

            server = await this.processCloudConnections(params);

            return server;
        }
        catch (e) {
            console.error(e);
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return {};
    }

    async findServersByType(zone, instance_type, db) {
        try {
            db = db || await mysql.db();
            var response;
            response = await db.sql('select * from server where zone = ? AND instance_type = ?', [zone, instance_type]);

            if (!response || !response.results || response.results.length == 0) {
                return null;
            }

            return response.results;
        }
        catch (e) {
            console.error("Server not found: ", e);
        }

        return null;
    }


    async processCloudConnections(server) {

        if (process.env.NODE_ENV == 'production') {

        } else {

        }



        switch (server.instance_type) {
            //websocket Node
            case 1: {
                //get cloud information
                //get websocket cluster connection

                let clusters = await this.findServersByType(server.zone, 2);
                server.clusters = clusters;
                break;
            }
            //websocket Cluster
            case 2: {
                //get cloud information
                break;
            }
            //Game Server
            case 3: {
                //get cloud information
                //get websocket cluster connection

                let clusters = await this.findServersByType(server.zone, 2);
                server.clusters = clusters;
                break;
            }
            //API
            case 4: {
                //get cloud information
                break;
            }
        }

        return server;
    }

    async findServer(params, db) {
        try {
            db = db || await mysql.db();
            var response;
            response = await db.sql('select * from server where public_addr = ?', [params.public_addr]);

            if (!response || !response.results || response.results.length == 0) {
                return null;
            }

            return response.results[0];
        }
        catch (e) {
            console.error("Server not found: ", e);
        }

        return null;
    }

    async createServer(params, db) {
        try {
            db = db || await mysql.db();
            let newid = genUnique64string({
                datacenter: this.credentials.datacenter.index || 0,
                worker: this.credentials.datacenter.worker || 0
            });

            params.id = { toSqlString: () => newid }

            let { results } = await db.insert('server', params);
            console.log(results);

            if (results.affectedRows > 0) {
                params.id = params.id.toSqlString();
                return params;
            }
        }
        catch (e) {
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("server.hostname_UNIQUE") > -1) {
                    throw new GeneralError("E_SERVER_DUPENAME", params.hostname);
                }
            }
            console.error(e);
            throw new GeneralError("E_SERVER_INVALID");
        }
        return null;
    }

    async updateServer(params, db) {
        console.log(params);
        try {
            db = db || await mysql.db();
            let public_addr = params.public_addr;
            delete params['public_addr'];

            let { results } = await db.update('server', params, 'public_addr=?', [public_addr]);
            console.log(results);

            if (results.affectedRows > 0) {
                params.public_addr = public_addr;
                return params;
            }
        }
        catch (e) {
            console.error(e);
            //revert back to normal
            if (e instanceof SQLError && e.payload.errno == 1062) {
                if (e.payload.sqlMessage.indexOf("server.hostname_UNIQUE") > -1) {
                    throw new GeneralError("E_SERVER_DUPEHOSTNAME", params.hostname);
                }
            }
            //console.error(e);
            throw new GeneralError("E_SERVER_INVALID");
        }
        return null;
    }

    unregister() {

    }


    update() {

    }


}