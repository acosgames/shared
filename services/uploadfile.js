
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3-transform');
// const busboy = require('busboy');
var zlib = require('zlib');
var stream = require("stream");
const { GeneralError } = require('../util/errorhandler');

const encoder = new TextEncoder('utf-8');
const decoder = new TextDecoder('utf-8');

module.exports = class UploadFile {

    constructor(credentials) {
        this.credentials = credentials || credutil();

        this.s3cred = new AWS.SharedIniFileCredentials({ profile: 'b2' });
        //AWS.config.credentials = credentials;
        //var ep = new AWS.Endpoint('s3.us-west-002.backblazeb2.com');
        this.s3 = new AWS.S3(this.credentials.backblaze);

        this.upload = null;
    }

    async uploadByStreamGzip(Bucket, Key, data) {

        return new Promise((rs, rj) => {


            try {
                let params = {
                    Bucket,
                    Key,
                    Body: data,
                    ACL: 'public-read',
                    ContentType: 'application/javascript',
                    ContentEncoding: 'gzip'
                }
                var options = { partSize: 10 * 1024 * 1024, queueSize: 1 };

                this.s3.upload(params, options, function (err, data) {
                    if (err) {
                        console.log("Error", err);
                        rj(err);
                    } if (data) {
                        console.log("Upload Success", data.Location);
                        rs(data);
                    }
                });
            }
            catch (e) {
                console.error(e);
            }
        })
    }


    async uploadByStreamGzipHtml(Bucket, Key, data) {

        return new Promise((rs, rj) => {


            try {
                let params = {
                    Bucket,
                    Key,
                    Body: data,
                    ACL: 'public-read',
                    ContentType: 'text/html',
                    ContentEncoding: 'gzip'
                }
                var options = { partSize: 10 * 1024 * 1024, queueSize: 1 };

                this.s3.upload(params, options, function (err, data) {
                    if (err) {
                        console.log("Error", err);
                        rj(err);
                    } if (data) {
                        console.log("Upload Success", data.Location);
                        rs(data);
                    }
                });
            }
            catch (e) {
                console.error(e);
            }
        })
    }

    async deleteBundles(client) {
        try {
            let deleted = [];
            if (!client.build_client)
                return deleted;

            let filename = client.build_client;

            var params2 = {
                Bucket: "acospub",
                Key: 'g/' + client.game_slug + '/client/' + client.id + '/' + filename
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

    async listFiles(prefix) {
        var params = {
            Bucket: "acospub",
            // Delimiter: '/',
            Prefix: prefix
        };

        const data = await this.s3.listObjects(params).promise();
        for (let index = 1; index < data['Contents'].length; index++) {
            console.log(data['Contents'][index]['Key'])
        }
        return data;
    }


    async deletePreviews(game) {
        // var params = {
        //     Bucket: 'acospub',
        //     Prefix: gameid + '/preview/'
        // };
        try {
            // let data = await this.s3.listObjects(params).promise();

            if (!game.preview_images)
                return [];
            // console.log(data);
            let deleted = [];
            let previews = game.preview_images.split(',');

            for (var i = 0; i < previews.length; i++) {
                let filename = previews[i];
                var params2 = {
                    Bucket: "acospub",
                    Key: 'g/' + game.game_slug + '/preview/' + filename
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


    middlewareGame(clientBucket, serverBucket, metadataCB) {


        // mimetypes = mimetypes || ['image/jpeg', 'image/png'];
        let clientContentType = 'application/javascript';

        const gameStorage = multerS3({
            s3: this.s3,
            bucket: function (req, file, cb) {
                if (file.fieldname == 'server')
                    cb(null, serverBucket);
                else if (file.fieldname == 'db')
                    cb(null, serverBucket);
                else if (file.fieldname == 'client')
                    cb(null, clientBucket);
                else cb(null, null);


            },
            acl: function (req, file, cb) {
                if (file.fieldname == 'server')
                    cb(null, 'private');
                else if (file.fieldname == 'db')
                    cb(null, 'private');
                else if (file.fieldname == 'client')
                    cb(null, 'public-read');
                else cb(null, null);


            },
            contentType: function (req, file, cb) {
                if (file.fieldname == 'server')
                    cb(null, 'application/javascript', file.stream);
                else if (file.fieldname == 'db')
                    cb(null, 'application/json', file.stream);
                else if (file.fieldname == 'client')
                    cb(null, clientContentType);
                else cb(null, null);
            } || multerS3.AUTO_CONTENT_TYPE,
            metadata: function (req, file, cb) {
                if (file.fieldname !== 'client')
                    cb(null, { fieldName: file.fieldname });
                cb(null, { fieldName: file.fieldname, 'Content-Type': clientContentType, 'Content-Encoding': 'gzip', 'b2-content-encoding': 'gzip' });
            },
            key: (req, file, cb) => {
                if (file.fieldname == 'db') {
                    let game = req.game;
                    var filename = "server.db." + game.version + '.json';
                    let key = game.game_slug + '/' + filename;

                    cb(null, key)
                }
                else if (file.fieldname == 'server') {
                    let game = req.game;
                    var filename = 'server.bundle.' + game.version + '.js';
                    // filename = filename.replace('.js', '.' + game.version + '.js')
                    let key = game.game_slug + '/' + filename;

                    cb(null, key)
                }
                else if (file.fieldname == 'client') {
                    let game = req.game;
                    var filename = 'client.bundle.' + game.version + '.js';
                    let key = 'g/' + game.game_slug + '/client/' + filename;
                    cb(null, key)
                }
                else cb(null, null)
            },
            shouldTransform: function (req, file, cb) {
                if (file.fieldname !== 'client')
                    cb(null, false);
                cb(null, true)
            },
            transforms: [{
                id: 'js',
                key: function (req, file, cb) {
                    if (file.fieldname == 'db') {
                        let game = req.game;
                        var filename = "server.db." + game.version + '.json';
                        let key = game.game_slug + '/' + filename;
                        req.hasDb = true;
                        cb(null, key)
                    }
                    else if (file.fieldname == 'server') {
                        let game = req.game;
                        var filename = 'server.bundle.' + game.version + '.js';
                        // filename = filename.replace('.js', '.' + game.version + '.js')
                        let key = game.game_slug + '/' + filename;

                        cb(null, key)
                    }
                    else if (file.fieldname == 'client') {
                        let game = req.game;
                        var filename = 'client.bundle.' + game.version + '.js';
                        let key = 'g/' + game.game_slug + '/client/' + filename;
                        cb(null, key)
                    }
                    else cb(null, null)
                },
                transform: function (req, file, cb) {
                    // var fileStream = file.stream;
                    // var out = new stream.PassThrough();
                    let zipped
                        = zlib.createGzip();
                    // var cnt = 0;

                    console.log("Transformed: ", file.fieldname);
                    file.stream.on('data', (chunk) => {
                        // console.log("chunk[" + cnt + "]", chunk);
                        // cnt++;
                        //prepend the iframe top html
                        // if (cnt == 1)
                        //     zipped.write(iframeTop);
                        //write the JS into the middle
                        zipped.write(chunk);
                    });

                    file.stream.on('end', () => {
                        //append the iframe bottom html
                        // zipped.write(iframeBottom);
                        // var zipped = new stream.PassThrough();
                        cb(null, zipped);
                    });
                }
            }]
        });


        const gameMimetypes = ['text/javascript', 'application/javascript', 'application/json'];
        const gameFileFilter = (req, file, cb) => {
            // if (file.fieldname !== 'client') {
            //     cb(null, false);
            //     return;
            // }

            var key = file.originalname;
            var fileExt = key.split('.').pop();
            if (fileExt.length == key.length) {
                cb(null, false);
                return;
            }

            if (gameMimetypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(null, false);
            }
        }



        let gameMulter = multer({ storage: gameStorage, fileFilter: gameFileFilter });

        let gameMiddleware = gameMulter.any();
        return gameMiddleware;
    }




    middleware(bucketName, mimetypes, metadataCB, keyCB, contentType) {
        mimetypes = mimetypes || ['image/jpeg', 'image/png'];
        const storage = multerS3({
            s3: this.s3,
            bucket: bucketName,
            acl: 'public-read',
            contentType: contentType || multerS3.AUTO_CONTENT_TYPE,
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