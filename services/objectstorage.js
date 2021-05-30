
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

const UploadFile = require('./uploadfile');
const upload = new UploadFile();

const AWS = require('aws-sdk');
const fs = require('fs');

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
                    console.log('file downloaded successfully')
                })
            }
            catch (e) {
                console.error(e);
            }
        });
    }

    downloadServerScript(Key) {
        return new Promise((rs, rj) => {
            try {
                var params = {
                    Key,
                    Bucket: 'fsg-server'
                }

                let rootPath = './serverScripts';
                let folderPath = '/' + Key.split('/')[0];
                let localPath = rootPath + '/' + Key;
                if (fs.existsSync(localPath)) {
                    let data = fs.readFileSync(localPath);
                    let js = data.toString('utf-8');
                    rs(js);
                    console.log('file loaded from filesystem successfully')
                    return;
                }
                this.s3.getObject(params, function (err, data) {
                    if (err) {
                        rj(err);
                        return;
                    }

                    fs.mkdirSync(rootPath + folderPath, { recursive: true });
                    fs.writeFileSync('./serverScripts/' + Key, data.Body)
                    let js = data.Body.toString('utf-8');
                    rs(js);
                    console.log('file downloaded successfully')
                })
            }
            catch (e) {
                console.error(e);
            }
        });
    }

}