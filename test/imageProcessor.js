
const ObjectStorageService = require("../services/objectstorage");
const s3 = new ObjectStorageService();
const MySQL = require('../services/mysql.js');
const mysql = new MySQL();
const mimetypes = require("../util/mimetypes.json");
const { genShortId } = require("../util/idgen");

const fs = require('fs');
const crypto = require('crypto');

const sharp = require('sharp');
const { joinImages } = require('join-images');
var tga2png = require('tga2png');


const resizeWebp = async (buffer) => {

    let thumbnail = await sharp(buffer).resize(64).webp({ quality: 100 }).toBuffer({ resolveWithObject: true });
    let medium = await sharp(buffer).resize(128).webp({ quality: 100 }).toBuffer({ resolveWithObject: true })
    let original = await sharp(buffer).webp({ quality: 100 }).toBuffer({ resolveWithObject: true })

    return { thumbnail, medium, original }
}

const resizeAvatars = async (folderPath, outputPath, category) => {
    let dirents = fs.readdirSync(folderPath, { withFileTypes: true });
    const filesNames = dirents
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name);

    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
    }


    let index = 0;
    let ids = [];
    for (let file of filesNames) {
        // if (file.indexOf("original-") == -1) {
        //     continue;
        // }
        try {
            let imageBuffer = fs.readFileSync(folderPath + '/' + file);

            let buffers = await resizeWebp(imageBuffer);

            index++;
            fs.writeFileSync(outputPath + '/' + category + '-' + index + '-medium' + '.webp', buffers.medium.data, { encoding: 'binary' });
            fs.writeFileSync(outputPath + '/' + category + '-' + index + '-original' + '.webp', buffers.original.data, { encoding: 'binary' });
            fs.writeFileSync(outputPath + '/' + category + '-' + index + '-thumbnail' + '.webp', buffers.thumbnail.data, { encoding: 'binary' });

            ids.push(index);
        }
        catch (e) {
            console.error(e);
        }
        // break;
    }

    return ids;
}

const buildAtlas = async (folderPath, title) => {
    if (!fs.existsSync(folderPath + '/atlas')) {
        fs.mkdirSync(folderPath + '/atlas');
    }


    let dirents = fs.readdirSync(folderPath + '/fixed', { withFileTypes: true });
    const filesNames = dirents
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name);

    let ids = [];

    for (let file of filesNames) {
        if (file.indexOf('medium') != 0)
            continue;

        let parts = file.split(/\-|\./);
        let id = Number.parseInt(parts[1]);
        ids.push(id);
    }

    let atlas = [[]];

    let maxColumns = 32;
    let maxRows = 3;
    let rowSize = 0;

    for (let id of ids) {
        if (atlas[rowSize].length == maxColumns) {
            let img = await joinImages(atlas[rowSize], { direction: 'horizontal' })
            await img.webp({ quality: 50 }).toFile(folderPath + '/atlas/' + title + '-' + rowSize + '.webp');
            // fs.writeFileSync(, buffer, { encoding: 'binary' });

            atlas.push([]);
            rowSize++;
        }

        if (atlas[rowSize].length < maxColumns) {
            atlas[rowSize].push(folderPath + '/fixed/medium-' + id + '.webp')
        }
    }

    let atlasid = 0;
    let imageRows = [];
    for (let i = 0; i < rowSize; i++) {


        let filename = folderPath + '/atlas/' + title + '-' + i + '.webp';
        let buffer = fs.readFileSync(filename);
        imageRows.push(buffer);

        if (i > 0 && ((i % maxRows) == 0)) {
            let img = await joinImages(imageRows, { direction: 'vertical' })
            await img.webp({ quality: 30 }).toFile(folderPath + '/atlas/atlas-' + title + '-' + atlasid + '.webp')
            atlasid++;
            imageRows = [];
        }

    }

    if (imageRows.length > 0) {
        let img = await joinImages(imageRows, { direction: 'vertical' })
        await img.webp({ quality: 50 }).toFile(folderPath + '/atlas/atlas-' + title + '-' + atlasid + '.webp')
    }

    // fs.writeFileSync(, buffer, { encoding: 'binary' });
}



const uploadDBandStorage = async (folderPath, category) => {

    //load the files
    let dirents = fs.readdirSync(folderPath, { withFileTypes: true });
    const filesNames = dirents
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name);

    let db = await mysql.db();

    // let imageMap = {};
    // for (file of filesNames) {
    //     let parts = file.split(/\.|\-/);
    //     let fileExt = parts[parts.length - 1];
    //     let id = parts[1];

    //     if ((id in imageMap))
    //         continue;

    //     // let hash = genShortId(16);
    //     let hash = crypto.createHash('md5').update(`${id}.${fileExt}`).digest('hex');

    //     imageMap[id] = {
    //         hash,
    //         images: [`medium-${id}.${fileExt}`, `original-${id}.${fileExt}`, `thumbnail-${id}.${fileExt}`],
    //         hashed: [`medium-${hash}.${fileExt}`, `original-${hash}.${fileExt}`, `thumbnail-${hash}.${fileExt}`]
    //     }
    // }


    // for (let sortid in imageMap) {
    for (let filename of filesNames) {
        // let mipmap = imageMap[sortid];

        if (filename.indexOf("original") == -1)
            continue;

        let parts = filename.split('.');
        let ext = parts[parts.length - 1];

        parts = filename.split('-');

        let sortid = Number.parseInt(parts[1]);
        // let filename = mipmap.hash + '.' + fileExt;
        //upload to mysql database
        try {

            let result = await db.insert('avatar', {
                category,
                ext,
                sortid
            })
            console.log("Insert result:", result);
        }
        catch (e) {
            if (e.payload.code == 'ER_DUP_ENTRY')
                continue;
            console.error(e);
            continue;
        }

        // for (let i = 0; i < mipmap.images.length; i++) {
        // let imageFilename = mipmap.images[i];
        // let imageHashname = mipmap.hashed[i];
    }

    // return;
    for (let filename of filesNames) {
        // let mipmap = imageMap[sortid];

        let parts = filename.split('.');
        let fileExt = parts[parts.length - 1];

        let imageBuffer = fs.readFileSync(folderPath + '/' + filename);

        //upload to backblaze object storage
        try {
            let Key = 'images/portraits/' + filename;
            let ContentType = mimetypes['.' + fileExt] || 'application/octet-stream'
            let ACL = 'public-read'

            let params = {
                Bucket: 'acospub',
                Key,
                Body: imageBuffer,
                ContentType,
                ACL,
                // metadata
            };

            console.log("S3 Uploading:", Key, filename);
            let uploader = await s3.upload(params)
            uploader.on('httpUploadProgress', function (progress) {
                if (cb) {
                    cb(null, progress);
                }
            });

            let data = await uploader.promise();
            console.log("Upload finished: ", data);
        }
        catch (e) {
            console.error(e);
        }

        // }
        // break;
    }
}



const assignAvatars = async () => {
    try {
        let db = await mysql.db();

        let sqlAvatars = await db.sql(`SELECT * FROM avatar`);

        let sqlPersons = await db.sql(`SELECT * FROM person`);
        console.log(sqlAvatars.results.length, sqlPersons.results.length);
        for (let i = 0; i < sqlPersons.results.length; i++) {

            let person = sqlPersons.results[i];
            let randomAvatar = sqlAvatars.results[Math.floor(Math.random() * sqlAvatars.results.length)];
            let updateResult = await db.sql(`UPDATE person SET avatarid = ? WHERE id = ?`, [randomAvatar.avatarid, person.id])
            console.log("updating", randomAvatar.avatarid, person.id)
        }

    }
    catch (e) {
        console.error(e);
    }
}


const convertTGA2PNG = async (folderPath, outputPath) => {

    let dirents = fs.readdirSync(folderPath, { withFileTypes: true });
    const filesNames = dirents
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name);


    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
    }


    for (let file of filesNames) {


        let inputFilepath = folderPath + '/' + file;
        let outputFilepath = outputPath + '/' + file.replace('.TGA', '.png');

        console.log("Converting to:", outputFilepath);

        try {
            await tga2png(inputFilepath, outputFilepath)

        } catch (e) {
            console.error(e);
        }

    }

}

const resizeWebpRanks = async (buffer) => {

    let original = await sharp(buffer).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })

    return original
}

const resizeGameRanks = async (folderPath, outputPath, style) => {
    let dirents = fs.readdirSync(folderPath, { withFileTypes: true });
    const filesNames = dirents
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name);

    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
    }

    let index = 0;
    let ids = [];
    for (let file of filesNames) {
        if (file.indexOf(style) === -1) {
            continue;
        }
        try {
            let imageBuffer = fs.readFileSync(folderPath + '/' + file);

            let original = await resizeWebpRanks(imageBuffer);

            index++;
            // fs.writeFileSync(folderPath + '/fixed/' + category + '-medium-' + index + '.webp', buffers.medium.data, { encoding: 'binary' });
            fs.writeFileSync(outputPath + '/' + index + '.webp', original.data, { encoding: 'binary' });
            // fs.writeFileSync(folderPath + '/fixed/' + category + '-thumbnail-' + index + '.webp', buffers.thumbnail.data, { encoding: 'binary' });
        }
        catch (e) {
            console.error(e);
        }
        // break;
    }

    return ids;
}


const uploadGameRanks = async (folderPath, prefix) => {
    let dirents = fs.readdirSync(folderPath, { withFileTypes: true });
    const filesNames = dirents
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name);

    for (let file of filesNames) {

        let imageBuffer = fs.readFileSync(folderPath + '/' + file);

        //upload to backblaze object storage
        try {
            let parts = file.split('.');
            // let number = Number.parseInt(parts[0]);
            // if (number <= 25)
            //     continue;

            let fileExt = parts[parts.length - 1];

            let Key = prefix + '/' + file;
            let ContentType = mimetypes['.' + fileExt] || 'application/octet-stream'
            let ACL = 'public-read'

            let params = {
                Bucket: 'acospub',
                Key,
                Body: imageBuffer,
                ContentType,
                ACL,
                // metadata
            };

            console.log("S3 Uploading:", Key);
            let uploader = await s3.upload(params)
            uploader.on('httpUploadProgress', function (progress) {
                if (cb) {
                    cb(null, progress);
                }
            });

            let data = await uploader.promise();
            console.log("Upload finished: ", data);
        }
        catch (e) {
            console.error(e);
        }
    }
}


let categories = [
    // 'humans',
    // 'elves',
    // 'dwarves',
    // 'orcs',
    'assorted'
]


const main = async () => {

    //MAKE MIPMAP FOR AVATARS
    for (let category of categories) {
        try {
            let folderPath = `./test/avatars/${category}`;
            let outputPath = `./test/avatars/${category}/final`;
            // let ids = await resizeAvatars(folderPath, outputPath, category);
            // await buildAtlas(folderPath, category);
            // await uploadDBandStorage(outputPath, category);
        }
        catch (e) {
            console.error(e);
        }
    }


    //CONVERT TGA TO PNG 
    try {
        let folderPath = `./test/ranks/tga`;
        let outputPath = `./test/ranks/png`;
        // await convertTGA2PNG(folderPath, outputPath);
    }
    catch (e) {
        console.error(e);
    }

    //CONVERT RANKS TO WEBP and OPTIMIZE
    try {
        let folderPath = `./test/ranks/png`;
        let outputPath = `./test/ranks/platform`;
        // await resizeGameRanks(folderPath, outputPath, 'style_3');
        // await uploadGameRanks(outputPath, 'icons/ranks/platform')
    }
    catch (e) {
        console.error(e);
    }

    //ASSIGN RANDOM AVATARS TO EXISTING PLAYERS
    await assignAvatars();

    process.exit();


}

main();