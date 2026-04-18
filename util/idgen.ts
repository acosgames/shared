import FlakeId from 'flake-idgen';
import { v4 as uuidv4 } from 'uuid';
import intformat from 'biguint-format';
// var { nanoid } = require('nanoid');

import { customAlphabet } from 'nanoid'; const nanoid = customAlphabet('6789BCDFGHJKLMNPQRTW', 6)
const fullNanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 5)

export function genUnique64({ datacenter, worker }) {
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
}

export function genUnique64string({ datacenter, worker }) {
    let id = genUnique64({ datacenter, worker });
    return int64string(id);
}

export function int64string(buff) {
    return intformat(buff, 'dec');
}

export function generateAPIKEY() {
    let id = uuidv4().replace(/\-/ig, '').toUpperCase();
    return id;
}

export function genShortId(len) {
    len = len || 5;
    return nanoid(len);
}
export function genFullShortId(len) {
    len = len || 5;
    return fullNanoid(len);
}
