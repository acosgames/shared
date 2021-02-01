const mysql = require('mysql2');
const credutil = require('../util/credentials')

pools = {};

module.exports = class MySQL {

    constructor(credentials) {
        this.credentials = credentials || credutil();
        this.connections = {};
        this.pool = null;

        this.initPool();
    }

    initPool() {
        try {
            let loginCreds = {
                connectionLimit: this.credentials.mysql.connectionLimit || 10,
                host: this.credentials.mysql.host,
                port: this.credentials.mysql.port || 3306,
                user: this.credentials.mysql.user,
                password: this.credentials.mysql.pass,
                database: this.credentials.mysql.db,
                typeCast: function (field, next) {
                    if (field.type == 'VAR_STRING') {
                        return field.string();
                    }
                    return next();
                }
            };
            let id = loginCreds.host + loginCreds.port + loginCreds.user + loginCreds.password + loginCreds.database;
            if (!(id in pools)) {
                this.pool = mysql.createPool(loginCreds);
                pools[id] = this.pool;
            }
            else {
                this.pool = pools[id];
            }

        }
        catch (e) {
            console.error(e);
        }

    }

    disconnect() {
        try {
            this.pool.end((err) => {
                throw err;
            })
        }
        catch (e) {
            console.error(e);
        }
    }

    getConnection() {
        var self = this;
        return new Promise(async (resolve, reject) => {
            try {
                self.pool.getConnection((err, conn) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(conn);
                });
            }
            catch (e) {
                console.error(e);
                reject(e);
            }
        });
    }

    begin(jobname) {
        var self = this;
        return new Promise(async (resolve, reject) => {
            try {
                if (self.connections[jobname])
                    throw `Connection ${jobname} already exists.  Check your code!`;

                self.pool.getConnection((err, conn) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    self.connections[jobname] = conn;

                    conn.beginTransaction(async (err) => {
                        if (err) throw err;
                        resolve(self.db(conn));
                    });
                });
            }
            catch (e) {
                console.error(e);
                if (jobname in self.connections) {
                    delete self.connections[jobname];
                }
                reject(e);
            }
        });
    }

    end(jobname) {
        if (!(jobname in this.connections))
            return;

        try {
            this.connections[jobname].commit((err) => {
                if (err) throw err;
                this.connections[jobname].release();
                delete this.connections[jobname];
            });

        }
        catch (e) {
            console.error(e);
            this.connections[jobname].release();
            delete this.connections[jobname];
        }
    }

    async db(conn) {
        let type = 0; //transaction query
        if (!conn) {
            conn = await this.getConnection();
            type = 2; //single use query
        }

        conn = conn || await this.getConnection();
        return {
            commit: () => {
                conn.commit((err) => {
                    if (err) throw err;

                })
            },
            rollback: () => {
                conn.rollback((err) => {
                    if (err) throw err;
                })
            },
            insert: (table, row) => {

                return new Promise((resolve, reject) => {
                    try {
                        if (!conn)
                            throw "No defined connection";

                        // var post = { id: 1, title: 'Hello MySQL' };
                        if (!row) {
                            throw "Row does not exist.  Check your code!"
                        }

                        if (!table) {
                            throw "Missing 'table' column. Check your code!"
                        }

                        row.tsupdate = Date.now();
                        row.tsinsert = Date.now();
                        var query = conn.query('INSERT INTO ' + table + ' SET ?', row, function (error, results, fields) {
                            if (error) throw error;
                            // Neat!

                            resolve({ results, fields });
                            if (type == 2)
                                conn.release();
                        });
                        console.log(query.sql);
                    }
                    catch (e) {
                        conn.rollback();
                        console.error(e);
                        reject(e);
                        if (type == 2)
                            conn.release();
                    }
                });
            },


            update: (table, row, where, whereValues) => {

                return new Promise((resolve, reject) => {
                    try {
                        if (!row) {
                            throw "Row does not exist.  Check your code!"
                        }
                        row.tsupdate = Date.now();

                        let { keys, values } = self.objToString(row);

                        if (whereValues && Array.isArray(whereValues)) {
                            values = values.concat(whereValues);
                        }
                        if (where.indexOf("WHERE") == - 1) {
                            where = 'WHERE ' + where;
                        }
                        var query = conn.query('UPDATE ' + table + ' SET ' + keys.join(',') + ' ' + where, values, function (error, results, fields) {

                            if (error) throw error;
                            // Neat!

                            resolve({ results, fields });

                            if (type == 2)
                                conn.release();
                        });
                    }
                    catch (e) {
                        conn.rollback();
                        console.error(e);
                        reject(e);
                        if (type == 2)
                            conn.release();
                    }
                });
            },

            sql: (sql, values) => {

                return new Promise((resolve, reject) => {
                    try {
                        values = values || [];
                        conn.query(sql, values, function (error, results, fields) {
                            if (error) throw error;
                            resolve({ results, fields });

                            if (type == 2)
                                conn.release();
                        });
                    }
                    catch (e) {
                        conn.rollback();
                        console.error(e);
                        if (type == 2)
                            conn.release();
                        reject(e);
                    }
                });
            },

            delete: (table, where, values) => {

                return new Promise((resolve, reject) => {
                    try {
                        if (!row) {
                            throw "Row does not exist.  Check your code!"
                        }
                        if (where.indexOf("WHERE") == - 1) {
                            where = 'WHERE ' + where;
                        }
                        var query = conn.query('DELETE FROM ' + table + ' ' + where, values, function (error, results, fields) {
                            if (error) throw error;
                            // Neat!
                            resolve({ results, fields });
                        });
                    }
                    catch (e) {
                        console.error(e);
                        reject(e);
                    }
                });
            }
        }
    }



    objToString(obj) {
        let keys = [];
        let values = [];
        for (key in obj) {
            keys.push(key + '=?')
            values.push(obj[key]);
        }
        return { keys, values };
    }
}