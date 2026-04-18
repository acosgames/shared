import { MySQL_DB } from "../types/mysql.js";
export default class MySQL {
    credentials: any;
    connections: any;
    pool: any;
    constructor(credentials?: any);
    initPool(): void;
    disconnect(): void;
    getConnection(): Promise<unknown>;
    begin(jobname: string): Promise<unknown>;
    end(jobname: string): void;
    rollback(jobname: any): void;
    utcTimestamp: () => string;
    db(): MySQL_DB;
    objToString(obj: any): {
        keys: any[];
        values: any[];
    };
}
//# sourceMappingURL=mysql.d.ts.map