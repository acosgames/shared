export default class ObjectStorage {
    constructor(credentials?: any);
    connect(): void;
    s3(): () => /*elided*/ any;
    deleteObject(params: any, cb?: any): any;
    upload(params: any, options?: any, cb?: any): any;
    list(params: any): any;
    multiPartUpload(Bucket: any, Key: any, buffer: any, options?: any): Promise<any>;
    downloadClientFile(Key: any): Promise<unknown>;
    downloadServerDatabase(Key: any): Promise<unknown>;
    unzipServerFile(body: any): Promise<unknown>;
    downloadPublicScript(Key: any): Promise<unknown>;
    downloadServerScript(Key: any): Promise<unknown>;
}
//# sourceMappingURL=objectstorage.d.ts.map