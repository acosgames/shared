

const NodeCache = require('node-cache');
const RedisService = require('./redis');

class Cacher {
    constructor() {
        this.cache = new NodeCache({ stdTTL: 300, checkperiod: 150 });
        this.dict = {};
        this.redis = RedisService;
    }

    async get(key) {
        //let key = shortid + '/' + room_slug;
        let value = this.dict[key];
        // let value = this.cache.get(key);
        if (typeof value == 'undefined') {
            value = await this.redis.get(key);
            if( typeof value !== 'undefined' )
                this.dict[key] = value;
        }
            

        return value;
    }

    async del(key) {
        //let key = shortid + '/' + room_slug;
        if( this.dict[key] )
            delete this.dict[key];
        // this.cache.del(key);
        await this.redis.del(key);
    }

    async set(key, value, ttl) {
        if (!ttl) {
            this.dict[key] = value;
            // this.cache.set(key, value);
            this.redis.set(key, value);
        }
        else {
            this.dict[key] = value;
            // this.cache.set(key, value, { ttl });
            this.redis.set(key, value, ttl);
        }

    }
}
module.exports = new Cacher()
