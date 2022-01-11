const mysql = require('mysql2');
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');
const { SQLError } = require('../util/errorhandler');

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
                supportBigNumbers: true,
                bigNumberStrings: true,
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
            // console.error(e);
            throw new SQLError('E_SQL_ERROR', e);
        }

    }

    disconnect() {
        try {
            this.pool.end((err) => {
                if (err) {
                    throw new SQLError('E_SQL_ERROR', err);
                }
            })
        }
        catch (e) {
            //console.error(e);
            throw e;
        }
    }

    getConnection() {
        var self = this;
        return new Promise(async (resolve, reject) => {
            try {
                self.pool.getConnection((err, conn) => {
                    if (err) {
                        reject(new SQLError('E_SQL_ERROR', err));
                        return;
                    }
                    resolve(conn);
                });
            }
            catch (e) {
                //console.error(e);
                reject(e);
            }
        });
    }

    begin(jobname) {
        var self = this;
        return new Promise(async (resolve, reject) => {
            try {
                if (self.connections[jobname]) {
                    reject(new SQLError('E_SQL_ERROR', `Connection ${jobname} already exists.  Check your code!`));
                    return;
                }

                self.pool.getConnection((err, conn) => {
                    if (err) {
                        reject(new SQLError('E_SQL_ERROR', err));
                        return;
                    }
                    self.connections[jobname] = conn;

                    conn.beginTransaction(async (err) => {
                        if (err) {
                            reject(new SQLError('E_SQL_ERROR', err));
                            return;
                        }
                        resolve(self.db(conn));
                    });
                });
            }
            catch (e) {
                //console.error(e);
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
                if (err) {
                    reject(new SQLError('E_SQL_ERROR', err));
                    return;
                }
                this.connections[jobname].release();
                delete this.connections[jobname];
            });

        }
        catch (e) {
            //console.error(e);
            this.connections[jobname].release();
            delete this.connections[jobname];
            throw e;
        }
    }

    async db(conn) {
        try {
            const type = !conn ? 2 : 0; //single use VS transaction query
            if (!conn) {
                conn = await this.getConnection();
                // type = 2; //single use query
            }

            conn = conn || await this.getConnection();
            return {
                commit: () => {
                    conn.commit((err) => {
                        if (err) throw new SQLError('E_SQL_ERROR', err);

                    })
                },
                rollback: () => {
                    conn.rollback((err) => {
                        if (err) throw new SQLError('E_SQL_ERROR', err);
                    })
                },
                insert: (table, row) => {

                    return new Promise((resolve, reject) => {
                        try {
                            if (!conn) {
                                reject(new SQLError('E_SQL_ERROR', "No defined connection"));
                                return;
                            }

                            // var post = { id: 1, title: 'Hello MySQL' };
                            if (!row) {
                                reject(new SQLError('E_SQL_ERROR', "Row does not exist.  Check your code!"));
                                return;
                            }

                            if (!table) {
                                reject(new SQLError('E_SQL_ERROR', "Missing 'table' column. Check your code!"));
                                return;
                            }

                            row.tsupdate = utcDATETIME();
                            row.tsinsert = row.tsupdate;
                            var query = conn.query('INSERT INTO ' + table + ' SET ?', row, function (error, results, fields) {
                                if (error) {
                                    conn.rollback();
                                    // console.error(error);
                                    reject(new SQLError('E_SQL_ERROR', error));
                                    if (type == 2)
                                        conn.release();
                                    return;
                                };
                                // Neat!

                                resolve({ results, fields });
                                if (type == 2)
                                    conn.release();
                            });
                            // console.log(query.sql);
                        }
                        catch (e) {
                            reject(new SQLError('E_SQL_ERROR', e));
                            conn.release();
                        }
                    });
                },

                increment: (table, row, where, whereValues) => {
                    var self = this;
                    return new Promise((resolve, reject) => {
                        try {
                            if (!row) {
                                throw new SQLError('E_SQL_ERROR', "Row does not exist.  Check your code!");
                            }

                            let keys = [];
                            let values = [];
                            for (var key in row) {
                                keys.push(key + '= `' + key + '` + 1 ');
                            }

                            keys.push('tsupdate = ?');
                            values.push(utcDATETIME());

                            if (whereValues && Array.isArray(whereValues)) {
                                values = values.concat(whereValues);
                            }
                            if (where && where.indexOf("WHERE") == -1) {
                                where = 'WHERE ' + where;
                            }
                            var query = conn.query('UPDATE ' + table + ' SET ' + keys.join(',') + ' ' + where, values, function (error, results, fields) {

                                if (error) {
                                    reject(new SQLError('E_SQL_ERROR', error));
                                    return;
                                }

                                resolve({ results, fields });

                                if (type == 2)
                                    conn.release();
                            });
                            console.log(query.sql);
                        }
                        catch (e) {
                            conn.rollback();
                            //console.error(e);
                            reject(new SQLError('E_SQL_ERROR', e));
                            if (type == 2)
                                conn.release();
                        }
                    });
                },

                decrement: (table, row, where, whereValues) => {
                    var self = this;
                    return new Promise((resolve, reject) => {
                        try {
                            if (!row) {
                                throw new SQLError('E_SQL_ERROR', "Row does not exist.  Check your code!");
                            }

                            let keys = [];
                            let values = [];
                            for (var key in row) {
                                keys.push(key + ' = `' + key + '` - 1');
                            }

                            keys.push('tsupdate = ?');
                            values.push(utcDATETIME());

                            if (whereValues && Array.isArray(whereValues)) {
                                values = values.concat(whereValues);
                            }
                            if (where && where.indexOf("WHERE") == -1) {
                                where = 'WHERE ' + where;
                            }
                            var query = conn.query('UPDATE ' + table + ' SET ' + keys.join(',') + ' ' + where, values,
                                function (error, results, fields) {

                                    if (error) {
                                        reject(new SQLError('E_SQL_ERROR', error));
                                        return;
                                    }

                                    resolve({ results, fields });

                                    if (type == 2)
                                        conn.release();
                                });
                            console.log(query.sql);
                        }
                        catch (e) {
                            conn.rollback();
                            //console.error(e);
                            reject(new SQLError('E_SQL_ERROR', e));
                            if (type == 2)
                                conn.release();
                        }
                    });
                },

                insertBatch: (table, rows, primarykeys, incrementKeys) => {

                    // if( rows.length > 1000 ) {
                    //     let subset = rows.slice(0,1000);
                    //     let remaining = rows.slice(1000, rows.length);
                    //     let results = [];
                    //     let result1 = await this.insertBatch(table, subset, primarykeys);
                    //     let result2 = await this.insertBatch(table, remaining, primarykeys);
                    //     return;
                    // }

                    return new Promise((resolve, reject) => {
                        try {
                            if (!conn) {
                                reject(new SQLError('E_SQL_ERROR', "No defined connection"));
                                return;
                            }

                            // var post = { id: 1, title: 'Hello MySQL' };
                            if (!rows || rows.length == 0) {
                                reject(new SQLError('E_SQL_ERROR', "Row does not exist.  Check your code!"));
                                return;
                            }

                            if (!primarykeys) {
                                reject(new SQLError('E_SQL_ERROR', "Missing 'primarykeys'.  Check your code!"));
                                return;
                            }

                            if (!table) {
                                reject(new SQLError('E_SQL_ERROR', "Missing 'table' name. Check your code!"));
                                return;
                            }


                            // row.tsinsert = row.tsupdate;
                            let keyList = [];
                            let valuesList = [];
                            let valuesProtect = [];
                            let qmarks = [];
                            let qmarksStr = "";
                            let updateDateTime = utcDATETIME();
                            for (var i = 0; i < rows.length; i++) {
                                let row = rows[i];
                                row.tsupdate = updateDateTime;
                                row.tsinsert = updateDateTime;
                                for (var key in row) {
                                    let value = row[key];

                                    valuesList.push(value);
                                    if (i == 0) {
                                        keyList.push(key);
                                        qmarks.push('?');
                                    }

                                }

                                if (i == 0)
                                    qmarksStr = '(' + qmarks.join(',') + ')';

                                valuesProtect.push(qmarksStr);
                            }

                            let updateColumns = [];

                            if (incrementKeys)
                                for (var key of incrementKeys) {
                                    updateColumns.push(key + '= ' + key + ' + 1');
                                }
                            for (var key in rows[0]) {
                                if (primarykeys.includes(key) || key == 'tsinsert')
                                    continue;
                                updateColumns.push(key + '=VALUES(' + key + ')');
                            }

                            var query = conn.query(
                                'INSERT INTO ' + table + ' (' + keyList.join(',') + ') VALUES ' + valuesProtect.join(',') + ' ON DUPLICATE KEY UPDATE ' + updateColumns.join(','),
                                valuesList,
                                function (error, results, fields) {
                                    if (error) {
                                        conn.rollback();
                                        console.error(error);
                                        reject(new SQLError('E_SQL_ERROR', error));
                                        if (type == 2)
                                            conn.release();
                                        return;
                                    };
                                    // Neat!

                                    resolve({ results, fields });
                                    if (type == 2)
                                        conn.release();
                                });
                            // console.log(query.sql);
                        }
                        catch (e) {
                            reject(new SQLError('E_SQL_ERROR', e));
                            conn.release();
                        }
                    });
                },

                update: (table, row, where, whereValues) => {
                    var self = this;
                    return new Promise((resolve, reject) => {
                        try {
                            if (!row) {
                                throw new SQLError('E_SQL_ERROR', "Row does not exist.  Check your code!");
                            }

                            if (row.tsinsert) {
                                delete row['tsinsert'];
                            }
                            row.tsupdate = utcDATETIME();

                            let { keys, values } = self.objToString(row);

                            if (whereValues && Array.isArray(whereValues)) {
                                values = values.concat(whereValues);
                            }
                            if (where && where.indexOf("WHERE") == -1) {
                                where = 'WHERE ' + where;
                            }
                            var query = conn.query('UPDATE ' + table + ' SET ' + keys.join(',') + ' ' + where, values, function (error, results, fields) {

                                if (error) {
                                    reject(new SQLError('E_SQL_ERROR', error));
                                    return;
                                }
                                // Neat!

                                resolve({ results, fields });

                                if (type == 2)
                                    conn.release();
                            });
                            console.log(query.sql);
                        }
                        catch (e) {
                            conn.rollback();
                            //console.error(e);
                            reject(new SQLError('E_SQL_ERROR', e));
                            if (type == 2)
                                conn.release();
                        }
                    });
                },

                sql: (sql, values) => {

                    return new Promise((resolve, reject) => {
                        try {
                            values = values || [];
                            let query = conn.query(sql, values, function (error, results, fields) {
                                if (error) {
                                    console.error(error);
                                    reject(new SQLError('E_SQL_ERROR', error));
                                    return;
                                }
                                resolve({ results, fields });

                                if (type == 2)
                                    conn.release();
                            });
                            // console.log(query.sql);
                        }
                        catch (e) {
                            conn.rollback();
                            console.error(e);
                            if (type == 2)
                                conn.release();
                            reject(new SQLError('E_SQL_ERROR', e));
                        }
                    });
                },

                delete: (table, where, values) => {

                    return new Promise((resolve, reject) => {
                        try {
                            if (!table) {
                                reject(new SQLError('E_SQL_ERROR', "table not defined.  Check your code!"));
                                return;
                            }
                            if (where.indexOf("WHERE") == -1) {
                                where = 'WHERE ' + where;
                            }
                            var query = conn.query('DELETE FROM ' + table + ' ' + where, values, function (error, results, fields) {
                                if (error) {
                                    reject(new SQLError('E_SQL_ERROR', error));
                                    return;
                                }
                                // Neat!
                                resolve({ results, fields });

                                if (type == 2)
                                    conn.release();
                            });
                        }
                        catch (e) {
                            console.error(e);
                            conn.release();
                            reject(new SQLError('E_SQL_ERROR', e));

                        }
                    });
                }
            }
        }
        catch (e) {
            throw e;
        }
    }



    objToString(obj) {
        let keys = [];
        let values = [];
        for (var key in obj) {
            keys.push(key + '=?')
            values.push(obj[key]);
        }
        return { keys, values };
    }
}