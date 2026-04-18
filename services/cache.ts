import NodeCache from "node-cache";
import RedisService from "./redis.js";
class Cacher {
    cache: NodeCache;
    dict: Record<string, any>;
    redis: typeof RedisService;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60, checkperiod: 10 });
        this.dict = {};
        this.redis = RedisService;
    }

    async get(key:string) {
        //let key = shortid + '/' + room_slug;
        //let value = this.dict[key];
        if (!key) return null;
        let value = this.cache.get(key);
        if (typeof value === "undefined") {
            value = await this.redis.get(key);
            // if (typeof value !== 'undefined')
            //     this.dict[key] = value;
        }

        return value;
    }

    getLocal(key: string) {
        // console.log(`${key} has TTL: ${this.cache.getTtl(key)}`);
        let value = this.cache.get(key);
        return value;
    }

    async getremote(key: string) {
        //let key = shortid + '/' + room_slug;
        //let value = this.dict[key];
        let value = await this.redis.get(key);

        return value;
    }

    delLocal(key: string) {
        //let key = shortid + '/' + room_slug;
        //if (this.dict[key])
        //    delete this.dict[key];
        this.cache.del(key);
    }

    async del(key: string) {
        //let key = shortid + '/' + room_slug;
        //if (this.dict[key])
        //    delete this.dict[key];
        this.cache.del(key);
        await this.redis.del(key);
    }

    set(key: string, value: any, ttl?: number) {
        if (!ttl) {
            //this.dict[key] = value;
            this.cache.set(key, value);
            this.redis.set(key, value, 60);
        } else {
            //this.dict[key] = value;
            this.cache.set(key, value);
            this.redis.set(key, value, ttl);
        }
    }

    setremote(key: string, value: any, ttl?: number) {
        if (!ttl) {
            this.redis.set(key, value, 60);
        } else {
            this.redis.set(key, value, ttl);
        }
    }

    setLocal(key: string, value: any, ttl?: number) {
        if (!ttl) {
            //this.dict[key] = value;
            this.cache.set(key, value);
            // this.redis.set(key, value);
        } else {
            //this.dict[key] = value;
            this.cache.set(key, value, Math.round(ttl));
            // this.redis.set(key, value, ttl);
        }
    }

    async zadd(name: string, members: any) {
        let result = await this.redis.zadd(name, members);
        return result;
    }

    async zrevrange(name: string, min: number, max: number) {
        let members = await this.redis.zrevrange(name, min, max);
        return members;
    }

    async zrevrank(name: string, key: string) {
        let rank = await this.redis.zrevrank(name, key);
        return rank;
    }

    async zcount(name: string, min: number, max: number) {
        min = min || 0;
        max = max || Number.MAX_SAFE_INTEGER;
        let count = await this.redis.zcount(name, min, max);
        return count;
    }

    async zrem(name: string, key: string) {
        let result = await this.redis.zrem(name, key);
        return result;
    }
}
export default new Cacher();