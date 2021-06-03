

const NodeCache = require('node-cache');
const RedisService = require('./redis');

class Cacher {
    constructor() {
        this.cache = new NodeCache({ stdTTL: 300, checkperiod: 150 });
        this.redis = RedisService;
    }

    async get(key) {
        //let key = shortid + '/' + room_slug;
        let value = this.cache.get(key);
        if (typeof value == 'undefined')
            value = await this.redis.get(key);

        return value;
    }

    del(key) {
        //let key = shortid + '/' + room_slug;
        this.cache.del(key);
        this.redis.del(key);
    }

    set(key, value, ttl) {
        if (ttl) {
            this.cache.set(key, true);
            this.redis.set(key, true);
        }
        else {
            this.cache.set(key, true, { ttl });
            this.redis.set(key, true, ttl);
        }

    }
}
module.exports = new Cacher()
