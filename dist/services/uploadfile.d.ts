export default class UploadFile {
    constructor(credentials?: any);
    uploadByStreamGzip(Bucket: any, Key: any, data: any): Promise<unknown>;
    uploadByStreamGzipHtml(Bucket: any, Key: any, data: any): Promise<unknown>;
    deleteBundles(client: any): Promise<any>;
    listFiles(prefix: any): Promise<any>;
    deletePreviews(game: any): Promise<any[]>;
    middlewareGame(clientBucket: any, serverBucket: any, metadataCB: any): any;
    middleware(bucketName: any, mimetypes: any, metadataCB: any, keyCB: any, contentType: any): any;
}
//# sourceMappingURL=uploadfile.d.ts.map