
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

// const UploadFile = require('./uploadfile');
// const upload = new UploadFile();

const path = require('path');

const AWS = require('aws-sdk');
const fs = require('fs');
const zlib = require("zlib");
const { rejects } = require('assert');

const { Readable } = require('stream');


module.exports = class ObjectStorage {

    constructor(credentials) {
        this.credentials = credentials || credutil();

        this.s3cred = new AWS.SharedIniFileCredentials({ profile: 'b2' });
        //AWS.config.credentials = credentials;
        //var ep = new AWS.Endpoint('s3.us-west-002.backblazeb2.com');
        this.s3 = new AWS.S3({ ...this.credentials.backblaze });
    }

    connect() {

    }

    s3() {
        return this.s3;
    }

    deleteObject(params, cb) {
        if (!params) {
            console.error("S3 Upload Failed, missing params.");
            return;
        }
        return this.s3.deleteObject(params, cb);

    }

    upload(params, options, cb) {
        if (!params) {
            console.error("S3 Upload Failed, missing params.");
            return;
        }

        options = options || { partSize: 20 * 1024 * 1024, queueSize: 5 };
        return this.s3.upload(params, options, cb)
    }

    list(params) {
        return this.s3.listObjects(params);
    }

    async multiPartUpload(Bucket, Key, buffer, options) {

        let defaultOptions = {
            Bucket, Key
        }

        options = options || {};

        if (options)
            options = Object.assign({}, defaultOptions, options);

        options.ContentType = options.ContentType || 'application/octet-stream';
        options.ACL = options.ACL || 'public-read';
        options.StorageClass = options.StorageClass || 'STANDARD';
        options.ContentEncoding = options.ContentEncoding || 'gzip';

        let multipartCreateResult = await this.s3.createMultipartUpload(options).promise()

        let chunks = [];
        let chunkCount = 1;
        let uploadPartResults = [];
        const stream = Readable.from(buffer);

        stream.on('readable', async () => {
            let chunk;
            console.log('Stream is now readable');
            while (null !== (chunk = stream.read(5242880))) {
                console.log(`Chunk read: ${chunk}`)
                chunks.push(chunk)
            }
            console.log(`Null returned`)
        })

        stream.on('end', async () => {
            for (let i = 0; i < chunks.length; i++) {
                let uploadPromiseResult = await this.s3.uploadPart({
                    Body: chunks[i],
                    Bucket,
                    Key,
                    PartNumber: i + 1,
                    UploadId: multipartCreateResult.UploadId,
                }).promise()

                uploadPartResults.push({
                    PartNumber: i + 1,
                    ETag: uploadPromiseResult.ETag
                })
            }
        })


        let completeUploadResponce = await this.s3.completeMultipartUpload({
            Bucket,
            Key,
            MultipartUpload: {
                Parts: uploadPartResults
            },
            UploadId: multipartCreateResult.UploadId
        }).promise()

        return completeUploadResponce;
    }

    downloadClientFile(Key) {
        return new Promise((rs, rj) => {
            try {
                var params = {
                    Key,
                    Bucket: 'acospub'
                }

                this.s3.getObject(params, function (err, data) {
                    if (err) {
                        rj(err);
                        return;
                    }
                    rs(data);
                    console.log('file downloaded successfully: ', Key)
                })
            }
            catch (e) {
                console.error(e);
            }
        });
    }

    downloadServerDatabase(Key) {
        const $this = this;
        return new Promise(async (rs, rj) => {
            try {
                var params = {
                    Key,
                    Bucket: 'acospriv'
                }

                let rootPath = './serverScripts';
                let folderPath = '/' + Key.split('/')[0];
                let localPath = rootPath + '/' + Key;
                if (fs.existsSync(localPath)) {
                    let data = fs.readFileSync(localPath);
                    let js = $this.unzipServerFile(data);
                    rs(js);
                    console.log('file loaded from filesystem successfully')
                    return;
                }
                this.s3.getObject(params, async function (err, data) {
                    if (err) {
                        rj(err);
                        return;
                    }

                    fs.mkdirSync(rootPath + folderPath, { recursive: true });
                    fs.writeFileSync('./serverScripts/' + Key, data.Body)

                    let js = $this.unzipServerFile(data.Body);
                    console.log('file downloaded successfully: ', Key)

                    rs(js);

                })
            }
            catch (e) {
                console.error(e);
                rj(e);
            }
        });
    }

    async unzipServerFile(body) {
        return new Promise(async (rs, rj) => {
            try {
                zlib.gunzip(body, (err, buffer) => {
                    if (err) {
                        console.error(err);
                        rj(err);
                        return;
                    }
                    let js = buffer.toString('utf8');
                    rs(js);
                });
            }
            catch (e) {
                console.error(e);
                rj(e);
            }
        })

    }

    downloadServerScript(Key, meta) {
        const $this = this;
        return new Promise(async (rs, rj) => {
            try {
                var params = {
                    Key,
                    Bucket: 'acospriv'
                }

                let rootPath = path.resolve(process.cwd(), './serverScripts');
                let folderPath = '/' + Key.split('/')[0];
                let localPath = rootPath + '/' + Key;
                let fileExists = false;
                try {
                    fileExists = fs.accessSync(localPath);
                } catch (e) {
                    console.error(e);
                }
                if (fileExists) {
                    let data = fs.readFileSync(localPath);
                    let js = await $this.unzipServerFile(data);
                    rs(js);
                    console.log('file loaded from filesystem successfully')
                    return;
                }
                this.s3.getObject(params, async function (err, data) {
                    if (err) {
                        rj(err);
                        return;
                    }

                    fs.mkdirSync(rootPath + folderPath, { recursive: true });
                    fs.writeFileSync('./serverScripts/' + Key, data.Body)

                    let js = await $this.unzipServerFile(data.Body);
                    console.log('file downloaded successfully: ', Key)

                    rs(js);

                })
            }
            catch (e) {
                console.error(e);
                rj(e);
            }
        });
    }

}