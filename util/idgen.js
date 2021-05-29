var FlakeId = require('flake-idgen');
const { v4: uuidv4 } = require('uuid');
var intformat = require('biguint-format')

// var { nanoid } = require('nanoid');

const { customAlphabet } = require('nanoid')
const nanoid = customAlphabet('6789BCDFGHJKLMNPQRTW', 6)
const fullNanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 5)
module.exports = {
    genUnique64({ datacenter, worker }) {
        datacenter = datacenter || 0;
        worker = worker || 0;
        //mid = mid || 0;
        const flake = new FlakeId({
            datacenter,
            worker
            //mid, //optional, define machine id
            //timeOffset: (2020 - 1970) * 31536000 * 1000 //optional, define a offset time
        });
        return flake.next();
    },

    genUnique64string({ datacenter, worker }) {
        let id = IdGen.genUnique64({ datacenter, worker });
        return IdGen.int64string(id);
    },

    int64string(buff) {
        return intformat(buff, 'dec');
    },

    generateAPIKEY() {
        let id = uuidv4().replace(/\-/ig, '').toUpperCase();
        return id;
    },

    genShortId(len) {
        len = len || 5;
        return nanoid(len);
    },
    genFullShortId(len) {
        len = len || 5;
        return fullNanoid(len);
    }
}