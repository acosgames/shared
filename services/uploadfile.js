
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

var iframeTop = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>FiveSecondGames - Client Simulator</title><meta name="description" content="FiveSecondGames Client Simulator" /><meta name="author" content="fsg" /><meta http-equiv="Content-Security-Policy" content="script-src 'self' cdn.fivesecondgames.com 'unsafe-inline';" /></head><body><div id="root"></div><script>`;
var iframeBottom = `</script></body></html>`
iframeTop = encoder.encode(iframeTop);
iframeBottom = encoder.encode(iframeBottom);

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

    async listFiles(prefix) {
        var params = {
            Bucket: "fivesecondgames",
            // Delimiter: '/',
            Prefix: prefix
        };

        const data = await this.s3.listObjects(params).promise();
        for (let index = 1; index < data['Contents'].length; index++) {
            console.log(data['Contents'][index]['Key'])
        }
        return data;
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

            if (!game.preview_images)
                return [];
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


    middlewareGame(clientBucket, serverBucket, metadataCB) {


        // mimetypes = mimetypes || ['image/jpeg', 'image/png'];
        let clientContentType = 'application/javascript';

        const gameStorage = multerS3({
            s3: this.s3,
            bucket: function (req, file, cb) {
                if (file.fieldname == 'server')
                    cb(null, 'fsg-server');
                else if (file.fieldname == 'db')
                    cb(null, 'fsg-server');
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
                    let key = game.gameid + '/' + filename;

                    cb(null, key)
                }
                else if (file.fieldname == 'server') {
                    let game = req.game;
                    var filename = 'server.bundle.' + game.version + '.js';
                    // filename = filename.replace('.js', '.' + game.version + '.js')
                    let key = game.gameid + '/' + filename;

                    cb(null, key)
                }
                else if (file.fieldname == 'client') {
                    let game = req.game;
                    var filename = 'client.bundle.' + game.version + '.js';
                    let key = game.gameid + '/client/' + filename;
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
                        let key = game.gameid + '/' + filename;
                        req.hasDb = true;
                        cb(null, key)
                    }
                    else if (file.fieldname == 'server') {
                        let game = req.game;
                        var filename = 'server.bundle.' + game.version + '.js';
                        // filename = filename.replace('.js', '.' + game.version + '.js')
                        let key = game.gameid + '/' + filename;

                        cb(null, key)
                    }
                    else if (file.fieldname == 'client') {
                        let game = req.game;
                        var filename = 'client.bundle.' + game.version + '.js';
                        let key = game.gameid + '/client/' + filename;
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
    middlewarePrivateDB(bucketName, mimetypes, metadataCB, keyCB, acl) {
        mimetypes = mimetypes || ['image/jpeg', 'image/png'];
        const storage = multerS3({
            s3: this.s3,
            bucket: bucketName,
            acl: 'private',
            contentType: (req, file, cb) => {
                cb(null, 'application/json', file.stream);
            },
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
    middlewarePrivate(bucketName, mimetypes, metadataCB, keyCB, acl) {
        mimetypes = mimetypes || ['image/jpeg', 'image/png'];
        const storage = multerS3({
            s3: this.s3,
            bucket: bucketName,
            acl: 'private',
            contentType: (req, file, cb) => {
                cb(null, 'application/javascript', file.stream);
            },
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

    /*
    
    */
    middlewareTransform(bucketName, mimetypes, metadataCB, keyCB, contentType) {



        mimetypes = mimetypes || ['image/jpeg', 'image/png'];
        contentType = 'text/html';
        const storage = multerS3({
            s3: this.s3,
            bucket: bucketName,
            acl: 'public-read',

            contentType: function (req, file, cb) { cb(null, contentType); } || multerS3.AUTO_CONTENT_TYPE,
            metadata: function (req, file, cb) {
                cb(null, { fieldName: file.fieldname, 'Content-Type': contentType, 'Content-Encoding': 'gzip', 'b2-content-encoding': 'gzip' });
            },
            key: keyCB || function (req, file, cb) {
                cb(null, Date.now().toString())
            },
            shouldTransform: function (req, file, cb) {
                cb(null, true)
            },
            transforms: [{
                id: 'html',
                key: function (req, file, cb) {
                    let game = req.game;
                    var filename = file.originalname;
                    filename = filename.replace('.js', '.' + game.version + '.html')
                    let key = game.gameid + '/client/' + filename;

                    cb(null, key)
                },
                transform: function (req, file, cb) {
                    var fileStream = file.stream;
                    var out = new stream.PassThrough();
                    let zipped
                        = zlib.createGzip();
                    var cnt = 0;

                    fileStream.on('data', (chunk) => {
                        console.log("chunk[" + cnt + "]", chunk);
                        cnt++;

                        //prepend the iframe top html
                        if (cnt == 1)
                            zipped.write(iframeTop);

                        //write the JS into the middle
                        zipped.write(chunk);
                    });

                    fileStream.on('end', () => {
                        //append the iframe bottom html
                        zipped.write(iframeBottom);

                        // var zipped = new stream.PassThrough();


                        cb(null, zipped);
                    });
                }
            }]
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