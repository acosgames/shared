
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

const UploadFile = require('./uploadfile');
const upload = new UploadFile();

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

}