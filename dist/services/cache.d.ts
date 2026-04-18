import NodeCache from "node-cache";
import RedisService from "./redis.js";
declare class Cacher {
    cache: NodeCache;
    dict: Record<string, any>;
    redis: typeof RedisService;
    constructor();
    get(key: string): Promise<unknown>;
    getLocal(key: string): unknown;
    getremote(key: string): Promise<any>;
    delLocal(key: string): void;
    del(key: string): Promise<void>;
    set(key: string, value: any, ttl?: number): void;
    setremote(key: string, value: any, ttl?: number): void;
    setLocal(key: string, value: any, ttl?: number): void;
    zadd(name: string, members: any): Promise<any>;
    zrevrange(name: string, min: number, max: number): Promise<any>;
    zrevrank(name: string, key: string): Promise<any>;
    zcount(name: string, min: number, max: number): Promise<any>;
    zrem(name: string, key: string): Promise<any>;
}
declare const _default: Cacher;
export default _default;
//# sourceMappingURL=cache.d.ts.map