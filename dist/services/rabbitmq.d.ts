declare class RabbitMQService {
    constructor(credentials?: any);
    getInChannel(): any;
    isActive(): any;
    retry(options: any): void;
    getMQServers(options: any): Promise<void>;
    connect(options: any): Promise<void>;
    reconnectSubscriberChannels(): Promise<void>;
    unsubscribe(exchange: any, pattern: any, queue: any): Promise<boolean>;
    findExistingQueue(queue: any): Promise<string | false>;
    subscribe(exchange: any, pattern: any, callback: any, queue: any): Promise<any>;
    subscribeAutoDelete(exchange: any, pattern: any, callback: any, queue: any): Promise<string | false>;
    nackMsg(msg: any): void;
    ackMsg(msg: any): void;
    assertQueue(queue: any, ttl: any): Promise<unknown>;
    unsubscribeQueue(queue: any): Promise<boolean>;
    subscribeQueue(queue: any, callback: any): Promise<unknown>;
    publish(exchange: any, pattern: any, value: any): Promise<any>;
    publishQueue(queue: any, value: any): Promise<any>;
}
declare const _default: RabbitMQService;
export default _default;
//# sourceMappingURL=rabbitmq.d.ts.map