
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

module.exports = class UploadFile {

    constructor(credentials) {
        this.credentials = credentials || credutil();

        //this.s3cred = new AWS.SharedIniFileCredentials({ profile: 'b2' });
        //AWS.config.credentials = credentials;
        //var ep = new AWS.Endpoint('s3.us-west-002.backblazeb2.com');
        this.s3 = new AWS.S3(this.credentials.backblaze);

        this.upload = null;
    }

    middleware(bucketName, mimetypes, metadataCB, keyCB) {
        mimetypes = mimetypes || ['image/jpeg', 'image/png'];
        const storage = multerS3({
            s3: this.s3,
            bucket: bucketName,
            metadata: metadataCB || function (req, file, cb) {
                cb(null, { fieldName: file.fieldname });
            },
            key: keyCB || function (req, file, cb) {
                cb(null, Date.now().toString())
            }
        });
        const fileFilter = (req, file, cb) => {
            if (mimetypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(null, false);
            }
        }
        this.upload = multer({ storage: storage, fileFilter: fileFilter });
        return this.upload;
    }

}