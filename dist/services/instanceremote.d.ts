export default class InstanceRemote {
    constructor(credentials?: any);
    register(params: any): Promise<any>;
    findServersByType(zone: any, instance_type: any, db?: any): Promise<any>;
    findRedisMQServers(zone: any, db: any): Promise<any>;
    processCloudConnections(server: any): Promise<any>;
    findServer(params: any, db: any): Promise<any>;
    createServer(params: any, db: any): Promise<any>;
    updateServer(params: any, db: any): Promise<any>;
    unregister(): void;
    update(): void;
}
//# sourceMappingURL=instanceremote.d.ts.map