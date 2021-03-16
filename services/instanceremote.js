
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

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

    register(params) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Searching for existing server by user: ", userid);
            response = await db.sql('select * from server where public_addr = ?', [params.public_addr]);

            let server = null;
            if (!response || !response.results || response.results.length == 0) {
                server = await this.createServer(params, db);
            }
            else {
                let existing = response.results[0];
                delete params['id'];
                let merged = Object.assign({}, existing, params);
                server = await this.updateServer(merged, db);
            }

            processCloudConnections();
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return [];
    }

    async processCloudConnections(server) {



        switch (server.instance_type) {
            //websocket Node
            case 1: {
                //get cloud information
                //get websocket cluster connection
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
                break;
            }
            //API
            case 4: {
                //get cloud information
                break;
            }
        }
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
            let id = params.id;
            delete params['id'];

            let { results } = await db.update('server', params, 'id=?', [id]);
            console.log(results);

            if (results.affectedRows > 0) {
                params.id = id;
                return params;
            }
        }
        catch (e) {
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