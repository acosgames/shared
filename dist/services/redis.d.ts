declare class RedisService {
    constructor(credentials?: any);
    retry(): void;
    isActive(): any;
    getRedisServers: (options: any) => Promise<void>;
    connect: (credentials: any) => Promise<unknown>;
    subscribe(channel: any, callback: any): Promise<unknown>;
    watch(key: any, callback: any): Promise<unknown>;
    onMessage(channel: any, value: any, extra: any): Promise<void>;
    onError(error: any): Promise<void>;
    onConnect(data: any): Promise<void>;
    onReady(data: any): Promise<void>;
    onEnd(data: any): Promise<void>;
    publish(key: any, value: any): Promise<any>;
    set(key: any, value: any, ttl: any): Promise<any>;
    hset(key: any, field: any, value: any): Promise<any>;
    del(key: any): Promise<void>;
    sadd(key: any, field: any): Promise<any>;
    srem(key: any, field: any): Promise<any>;
    smembers(key: any): Promise<any>;
    scard(key: any): Promise<any>;
    hget(key: any, field: any): Promise<any>;
    hdel(key: any, field: any): Promise<any>;
    hgetall(key: any): Promise<any>;
    get(key: any): Promise<any>;
    zadd(name: any, members: any): Promise<any>;
    zrange(name: any, start: any, end: any): Promise<any>;
    zrevrange(name: any, start: any, end: any): Promise<any>;
    zcount(name: any, start: any, end: any): Promise<any>;
    zrank(name: any, key: any): Promise<any>;
    zrevrank(name: any, key: any): Promise<any>;
    zrem(name: any, members: any): Promise<any>;
}
declare const _default: RedisService;
export default _default;
//# sourceMappingURL=redis.d.ts.map