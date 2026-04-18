export interface MySQLConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}
export interface MySQL_DB {
    insert: (table: string, row: any) => Promise<any>;
    increment: (table: string, data: any, where: string, whereValues?: any[]) => Promise<any>;
    decrement: (table: string, data: any, where: string, whereValues?: any[]) => Promise<any>;
    insertBatch: (table: string, rows: any[], primarykeys: string[], incrementKeys?: string[], ignoreKeys?: string[]) => Promise<any>;
    update: (table: string, row: any, where: string, whereValues?: any[], ignoreKeys?: string[]) => Promise<any>;
    utcTimestamp: () => string;
    query: (sql: string, values?: any[]) => Promise<any>;
    sql: (sql: string, values?: any[]) => Promise<any>;
    delete: (table: string, where: string, values?: any[]) => Promise<any>;
}
//# sourceMappingURL=mysql.d.ts.map