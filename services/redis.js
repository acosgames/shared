const redis = require("redis");
const { promisify } = require("util");
const { GeneralError } = require("../util/errorhandler");

const credutil = require('../util/credentials')

const ServerRemoteService = require('./instanceremote');
const remote = new ServerRemoteService();


class RedisService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
        this.redisCredentials = this.credentials.platform.redisCluster;

        this.callbacks = {};
        this.active = false;

        this.retry();
    }

    retry(options) {
        setTimeout(() => { this.getRedisServers(options) }, this.credentials.platform.retryTime);
    }

    isActive() {
        return this.active;
    }

    getRedisServers = async (options) => {

        try {
            if (options) {
                await this.connect(options);
                return;
            }

            let servers = await remote.findServersByType(0, 2);
            if (!servers) {
                retry(options);
                return;
            }
            // let clusters = this.server.clusters;
            //choose a random Redis server within our zone
            // let redises = servers.filter(v => v.instance_type == 2);
            let server = servers[Math.floor(Math.random() * servers.length)];
            let pubAddr = server.public_addr;
            let privAddr = server.private_addr;
            let parts = pubAddr.split(":");
            let host = parts[0];
            let port = parts[1];
            options = {
                host, port
            }

            await this.connect(options);
        }
        catch (e) {
            this.retry(options);
        }

    }

    connect = (credentials) => {
        if (credentials) {
            this.redisCredentials = credentials;
        }
        const self = this;
        return new Promise(async (rs, rj) => {
            if (self.client) {
                rs(self.client);
                return;
            }

            self.client = await redis.createClient(self.redisCredentials);


            // self.client.publish = self.client.publish;
            // self.client.setex = self.client.setex;
            // self.client.hset = self.client.hset;
            // self.client.hget = self.client.hget;
            // self.client.hgetall = self.client.hgetall;
            // self.client.set = self.client.set;
            // self.client.get = self.client.get;
            // self.client.del = self.client.del;
            self.client.on("connect", self.onConnect.bind(self));
            self.client.on("end", self.onEnd.bind(self));
            self.client.on("ready", (data) => {
                self.onReady(data);
                rs(data);
            });
            self.client.on("error", (err) => {
                self.onError(err);
                rj(err);
            });

            await self.client.connect();
        })
    }

    async subscribe(channel, callback) {
        const self = this;
        this.callbacks[channel] = callback || null;
        return new Promise(async (rs, rj) => {
            if (!channel) {
                rj("Missing channel");
            }

            if (!self.subscriber) {
                self.subscriber = await redis.createClient(self.redisCredentials);
                self.subscriber.on('message', self.onMessage.bind(self));
                self.subscriber.on("connect", self.onConnect.bind(self));
                self.subscriber.on("end", self.onEnd.bind(self));
                self.subscriber.on("ready", (data) => {
                    self.onReady(data);
                    rs(data);
                });
                self.subscriber.on("error", (err) => {
                    self.onError(err);
                    rj(err);
                });
                await self.subscriber.connect();
            }

            self.subscriber.subscribe(channel);

        });
    }

    async watch(key, callback) {
        const self = this;
        this.callbacks[key] = callback || null;
        return new Promise((rs, rj) => {
            if (!key) {
                rj("Missing key");
            }
            if (!self.watcher) {
                self.watcher = redis.createClient(self.redisCredentials);
                self.watcher.config('set', 'notify-keyspace-events', 'KEA');
                self.watcher.on('message', self.onMessage.bind(self));
                self.watcher.on("connect", self.onConnect.bind(self));
                self.watcher.on("end", self.onEnd.bind(self));
                self.watcher.on("ready", (data) => {
                    self.onReady(data);
                    rs(data);
                });
                self.watcher.on("error", (err) => {
                    self.onError(err);
                    rj(data);
                });
            }


            self.watcher.subscribe('__keyevent@0__:set', key);
        });
    }

    async onMessage(channel, value, extra) {
        console.log(channel, value, extra);

        if (this.callbacks[channel]) {
            this.callbacks[channel](channel, value, extra);
        }
    }
    async onError(error) {
        this.active = false;
        console.error("redis error: ", error);
        this.retry();
    }
    async onConnect(data) {
        console.log("redis connected");
    }
    async onReady(data) {
        this.active = true;
        console.log("redis ready");
    }
    async onEnd(data) {
        this.active = false;
        console.log("redis disconnected", data);
        this.retry();
    }

    async publish(key, value) {
        try {

            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }

            let result = await this.client.publish(key, value);
            return result;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDISclient.publish', { key, value });
        }
    }

    async set(key, value, ttl) {
        try {
            ttl = ttl || this.credentials.defaultExpireTime || 300
            //if (typeof value === 'object') {
            value = JSON.stringify(value);
            //}

            let result = await this.client.set(key, value, { EX: ttl });
            return result;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDISclient.set', { key, value });
        }

    }

    async hset(key, field, value) {
        try {
            // ttl = ttl || this.credentials.defaultExpireTime || 300
            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }

            let result = await this.client.HSET(key, field, value);
            return result;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDISclient.hset', { key, field, value });
        }
    }

    async del(key) {
        try {
            await this.client.del(key);
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDISclient.get', { key });
        }
    }

    async hget(key, field) {
        try {
            let data = await this.client.HGET(key, field);
            if (!data)
                return null;
            let firstChar = data.trim()[0];
            if (firstChar == '{' || firstChar == '[')
                data = JSON.parse(data);
            return data;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDISclient.hget', { key, field });
        }
    }

    async hgetall(key) {
        try {
            let data = await this.client.HGETALL(key);
            if (!data)
                return null;
            for (var key in data) {
                let firstChar = data[key].trim()[0];
                if (firstChar == '{' || firstChar == '[')
                    data[key] = JSON.parse(data[key]);
            }

            return data;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDISclient.hgetall', { key });
        }
    }

    async get(key) {
        try {
            let data = await this.client.get(key);
            if (!data)
                return null;
            //let firstChar = data.trim()[0];
            //if (firstChar == '{' || firstChar == '[')
            data = JSON.parse(data);
            return data;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDISclient.get', { key });
        }
    }

    async zadd(name, members) {
        try {
            // ttl = ttl || this.credentials.defaultExpireTime || 300
            if (!Array.isArray(members)) {
                return false;
            }

            if (typeof name !== 'string')
                return false;

            let result = await this.client.ZADD(name, members);
            return result;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDISclient.ZADD', { name, members });
        }
    }

    async zrange(name, start, end) {
        try {
            // ttl = ttl || this.credentials.defaultExpireTime || 300

            if (typeof name !== 'string')
                return false;

            let result = await this.client.ZRANGE_WITHSCORES(name, start, end, {});
            return result;
        }
        catch (e) {
            console.error(e);
            rj(new GeneralError('ERROR_REDISClient.ZRANGE', { name, start, end }));
        }
    }

    async zrevrange(name, start, end) {
        try {
            // ttl = ttl || this.credentials.defaultExpireTime || 300

            if (typeof name !== 'string')
                return false;

            let result = await this.client.ZRANGE_WITHSCORES(name, start, end, { REV: true });
            return result;
        }
        catch (e) {
            console.error(e);
            rj(new GeneralError('ERROR_REDISClient.ZREVRANGE', { name, start, end, }));
        }
    }

    async zcount(name, start, end) {
        try {
            // ttl = ttl || this.credentials.defaultExpireTime || 300

            if (typeof name !== 'string')
                return false;

            let result = await this.client.ZCOUNT(name, start, end);
            return result;
        }
        catch (e) {
            console.error(e);
            rj(new GeneralError('ERROR_REDISClient.ZCOUNT', { name, start, end }));
        }
    }

    async zrank(name, key) {
        try {
            // ttl = ttl || this.credentials.defaultExpireTime || 300

            if (typeof name !== 'string')
                return false;

            let result = await this.client.ZRANK(name, key);
            return result;
        }
        catch (e) {
            console.error(e);
            rj(new GeneralError('ERROR_REDISClient.ZRANK', { name, key }));
        }
    }

    async zrevrank(name, key) {
        try {
            // ttl = ttl || this.credentials.defaultExpireTime || 300

            if (typeof name !== 'string')
                return false;

            let result = await this.client.ZREVRANK(name, key);
            return result;
        }
        catch (e) {
            console.error(e);
            rj(new GeneralError('ERROR_REDISClient.ZREVRANK', { name, key }));
        }
    }

    async zrem(name, key) {
        try {
            if (typeof name !== 'string')
                return false;

            let result = await this.client.ZREM(name, key);
            return result;
        }
        catch (e) {
            console.error(e);
            rj(new GeneralError('ERROR_REDISClient.ZREM', { name, key }));
        }
    }

}


async function test() {

    const r = new RedisService();
    //const s = new RedisService();
    await r.connect();
    // await r.subscribe('evt_newgame', (channel, value) => {
    //     console.log("Received Event: ", channel, value);
    // });
    // await r.watch('joe2', (channel, value) => {
    //     console.log("Changed Key: ", channel, value);
    // })
    // await r.publish('evt_newgame', { id: 1234 });
    // await r.set('joe2', { id: 555 });

    await r.hset('action-1', '1234',)
    // await r.set('joe', { id: 1234 });
    // let data = await r.get('joe');
    // console.log(data);
}

// test();

module.exports = new RedisService();