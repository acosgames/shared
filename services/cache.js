

const NodeCache = require('node-cache');
const RedisService = require('./redis');

class Cacher {
    constructor() {
        this.cache = new NodeCache({ stdTTL: 300, checkperiod: 150 });
        this.redis = RedisService;
    }

    async get(key) {
        let key = shortid + '/' + room_slug;
        let value = cache.get(key);
        if (typeof value == 'undefined')
            value = await redis.get(key);

        return value;
    }

    del(key) {
        let key = shortid + '/' + room_slug;
        cache.del(key);
        redis.del(key);
    }

    set(key, value, ttl) {
        if (ttl) {
            cache.set(key, true);
            redis.set(key, true);
        }
        else {
            cache.set(key, true, { ttl });
            redis.set(key, true, ttl);
        }

    }
}
module.exports = new Cacher()
