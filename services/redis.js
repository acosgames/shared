const redis = require("redis");
const { promisify } = require("util");
const { GeneralError } = require("../util/errorhandler");


module.exports = class RedisService {
    constructor(credentials) {
        this.credentials = credentials || {
            host: "127.0.0.1",
            port: 6379,
        };

        this.callbacks = {};
    }

    connect(credentials) {
        if (credentials) {
            this.credentials = credentials;
        }
        const self = this;
        return new Promise((rs, rj) => {
            self.client = redis.createClient(self.credentials);
            self._publish = promisify(self.client.publish).bind(self.client);
            self._set = promisify(self.client.set).bind(self.client);
            self._get = promisify(self.client.get).bind(self.client);
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
        })
    }

    async subscribe(channel, callback) {
        const self = this;
        this.callbacks[channel] = callback || null;
        return new Promise((rs, rj) => {
            if (!channel) {
                rj("Missing channel");
            }

            if (!self.subscriber) {
                self.subscriber = redis.createClient(self.credentials);
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
                self.watcher = redis.createClient(self.credentials);
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
        console.error("onError", error);
    }
    async onConnect(data) {
        console.log("onConnect", data);
    }
    async onReady(data) {
        console.log("onReady", data);
    }
    async onEnd(data) {
        console.log("onEnd", data);
    }

    async publish(key, value) {
        try {

            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }

            let result = await this._publish(key, value);
            return result;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDIS_PUBLISH', { key, value });
        }
    }

    async set(key, value) {
        try {

            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }

            let result = await this._set(key, value);
            return result;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDIS_SET', { key, value });
        }

    }

    async get(key) {
        try {
            let data = await this._get(key);

            let firstChar = data.trim()[0];
            if (firstChar == '{' || firstChar == '[')
                data = JSON.parse(data);
            return data;
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDIS_GET', { key });
        }
    }
}


async function test() {

    const r = new RedisService();
    //const s = new RedisService();
    await r.connect();
    await r.subscribe('evt_newgame', (channel, value) => {
        console.log("Received Event: ", channel, value);
    });
    await r.watch('joe2', (channel, value) => {
        console.log("Changed Key: ", channel, value);
    })
    await r.publish('evt_newgame', { id: 1234 });
    await r.set('joe2', { id: 555 });
    // await r.set('joe', { id: 1234 });
    // let data = await r.get('joe');
    // console.log(data);
}

// test();

// export default new RedisService();