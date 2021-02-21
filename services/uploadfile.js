
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
// const busboy = require('busboy');

module.exports = class UploadFile {

    constructor(credentials) {
        this.credentials = credentials || credutil();

        this.s3cred = new AWS.SharedIniFileCredentials({ profile: 'b2' });
        //AWS.config.credentials = credentials;
        //var ep = new AWS.Endpoint('s3.us-west-002.backblazeb2.com');
        this.s3 = new AWS.S3(this.credentials.backblaze);

        this.upload = null;
    }

    async deleteBundles(client) {
        try {
            let deleted = [];
            if (!client.build_client)
                return deleted;

            let filename = client.build_client;

            var params2 = {
                Bucket: "fivesecondgames",
                Key: client.gameid + '/client/' + client.id + '/' + filename
            };
            let del = await this.s3.deleteObject(params2).promise();
            console.log(del);

            client.build_client = null;
            return del;
        }
        catch (e) {
            console.error(e, e.stack);
        }
        return [];
    }

    async deleteClientPreviews(client) {
        // var params = {
        //     Bucket: 'fivesecondgames',
        //     Prefix: gameid + '/preview/'
        // };
        try {
            // let data = await this.s3.listObjects(params).promise();

            // console.log(data);
            let deleted = [];
            if (!client.preview_images)
                return deleted;

            let previews = client.preview_images.split(',');

            for (var i = 0; i < previews.length; i++) {
                let filename = previews[i];
                var params2 = {
                    Bucket: "fivesecondgames",
                    Key: client.gameid + '/client/' + client.id + '/' + filename
                };
                let del = await this.s3.deleteObject(params2).promise();
                console.log(del);
                deleted.push(del);
            }

            return deleted;
        }
        catch (e) {
            console.error(e, e.stack);
        }
        return [];
    }


    async deletePreviews(game) {
        // var params = {
        //     Bucket: 'fivesecondgames',
        //     Prefix: gameid + '/preview/'
        // };
        try {
            // let data = await this.s3.listObjects(params).promise();

            // console.log(data);
            let deleted = [];
            let previews = game.preview_images.split(',');

            for (var i = 0; i < previews.length; i++) {
                let filename = previews[i];
                var params2 = {
                    Bucket: "fivesecondgames",
                    Key: game.gameid + '/preview/' + filename
                };
                let del = await this.s3.deleteObject(params2).promise();
                console.log(del);
                deleted.push(del);
            }

            return deleted;
        }
        catch (e) {
            console.error(e, e.stack);
        }
        return [];
    }



    // busboyMiddleware({ onFile, onField, onFinish, onFileData, onFileEnd }) {
    //     return (req, res, next) => {
    //         var busboy = new Busboy({ headers: req.headers });
    //         busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
    //             if (onFile) onFile(fieldname, file, filename, encoding, mimetype);
    //             console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
    //             file.on('data', function (data) {
    //                 if (onFileData) onFileData(data);
    //                 console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
    //             });
    //             file.on('end', function () {
    //                 if (onFileEnd) onFileEnd();
    //                 console.log('File [' + fieldname + '] Finished');
    //             });
    //         });
    //         busboy.on('field', function (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
    //             if (onField) onField(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype);
    //             console.log('Field [' + fieldname + ']: value: ' + val);

    //         });
    //         busboy.on('finish', function () {
    //             if (onFinish) onFinish();
    //             console.log('Done parsing form!');
    //             // res.writeHead(303, { Connection: 'close', Location: '/' });
    //             // res.end();
    //         });
    //         req.pipe(busboy);
    //     }
    // }

    middleware(bucketName, mimetypes, metadataCB, keyCB) {
        mimetypes = mimetypes || ['image/jpeg', 'image/png'];
        const storage = multerS3({
            s3: this.s3,
            bucket: bucketName,
            acl: 'public-read',
            contentType: multerS3.AUTO_CONTENT_TYPE,
            metadata: metadataCB || function (req, file, cb) {
                cb(null, { fieldName: file.fieldname });
            },
            key: keyCB || function (req, file, cb) {
                cb(null, Date.now().toString())
            }
        });
        const fileFilter = (req, file, cb) => {


            var key = file.originalname;
            var fileExt = key.split('.').pop();
            if (fileExt.length == key.length) {
                cb(null, false);
                return;
            }

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