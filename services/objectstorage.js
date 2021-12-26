
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

const UploadFile = require('./uploadfile');
const upload = new UploadFile();

const AWS = require('aws-sdk');
const fs = require('fs');
const zlib = require("zlib");
const { rejects } = require('assert');

module.exports = class ObjectStorage {

    constructor(credentials) {
        this.credentials = credentials || credutil();

        this.s3cred = new AWS.SharedIniFileCredentials({ profile: 'b2' });
        //AWS.config.credentials = credentials;
        //var ep = new AWS.Endpoint('s3.us-west-002.backblazeb2.com');
        this.s3 = new AWS.S3(this.credentials.backblaze);
    }

    connect() {

    }

    s3() {
        return this.s3;
    }

    upload(key, data) {

    }

    downloadClientFile(Key) {
        return new Promise((rs, rj) => {
            try {
                var params = {
                    Key,
                    Bucket: 'fivesecondgames'
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
                    Bucket: 'fsg-server'
                }

                let rootPath = './serverScripts';
                let folderPath = '/' + Key.split('/')[0];
                let localPath = rootPath + '/' + Key;
                if (fs.existsSync(localPath)) {
                    let data = await fs.promises.readFile(localPath);
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

                    await fs.promises.mkdir(rootPath + folderPath, { recursive: true });
                    await fs.promises.writeFile('./serverScripts/' + Key, data.Body)

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
                    Bucket: 'fsg-server'
                }

                let rootPath = './serverScripts';
                let folderPath = '/' + Key.split('/')[0];
                let localPath = rootPath + '/' + Key;
                let fileExists = false;
                try {
                    fileExists = await fs.promises.access(localPath);
                } catch (e) {
                    console.error(e);
                }
                if (fileExists) {
                    let data = await fs.promises.readFile(localPath);
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

                    await fs.promises.mkdir(rootPath + folderPath, { recursive: true });
                    await fs.promises.writeFile('./serverScripts/' + Key, data.Body)

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