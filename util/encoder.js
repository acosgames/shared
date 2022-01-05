const pako = require('pako');
const encoder = new TextEncoder();
const decoder = new TextDecoder();
// const { serialize, deserialize } = require('bson');
// const ServerAPI = require('../../api/src/api/server');

function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function str2ab(str) {
    var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    var bufView = new Uint16Array(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

let testJSON = {
    "room_slug": "JHMKGD",
    "state": {
        "cells": {
            "0": "",
            "1": "",
            "2": "",
            "3": "",
            "4": "",
            "5": "",
            "6": "",
            "7": "",
            "8": ""
        },
        "startPlayer": "manC6"
    },
    "rules": {
        "bestOf": 5,
        "maxPlayers": 2
    },
    "next": {
        "id": "manC6",
        "action": "pick"
    },
    "events": ['hello', 1, 0.2, { mytestkey: 'a value' }, [100, 200, 300]],
    "timer": {
        "seq": 1
    },
    "players": {
        "8CCkf": {
            "name": "joe",
            "rank": false,
            "score": new Date(),
            "type": true,
            "id": "8CCkf"
        },
        "manC6": {
            "name": "5SG",
            "rank": 18446556446050,
            "score": 123423,
            "type": "X"
        }
    },
    "prev": {}
};

const TYPE_OBJ = 1;
const TYPE_ARR = 2;
const TYPE_BOOL = 3;
const TYPE_DATE = 4;
const TYPE_DICT = 5;
const TYPE_STRING = 6;
const TYPE_INT8 = 7;
const TYPE_UINT8 = 8;
const TYPE_INT16 = 9;
const TYPE_UINT16 = 10;
const TYPE_INT32 = 11;
const TYPE_UINT32 = 12;
const TYPE_INT64 = 13;
const TYPE_UINT64 = 14;
const TYPE_FLOAT32 = 15;
const TYPE_FLOAT64 = 16;
const TYPE_ENDOBJ = 17;
const TYPE_ENDARR = 18;
const TYPE_FLOATSTR = 19;
const TYPE_NULL = 20;
const TYPE_ZERO = 21;
const TYPE_EMPTYSTRING = 22;
const TYPE_TRUE = 23;
const TYPE_FALSE = 24;
const TYPE_ONE = 25;
const TYPE_TWO = 26;
const TYPE_THREE = 27;
const TYPE_EMPTY_OBJ = 28;
const TYPE_EMPTY_ARR = 29;
const TYPE_DEL_DICTKEY = 30;
const TYPE_STRING_DICT1 = 31;
const TYPE_STRING_DICT2 = 32;

var dvbuff = new ArrayBuffer(16);
var dv = new DataView(dvbuff);


var defaultOrder = [
    'room_slug',
    'game_slug',
    'gameid',
    'version',
    'state',
    'events',
    'players',
    'timer',
    'rules',
    'next',
    'prev',
    'action',
    'seq',
    'rank',
    'rating',
    'ratingTxt',
    'score',
    '_win',
    '_loss',
    '_tie',
    '_played',
    'win',
    'loss',
    'tie',
    'wins',
    'losses',
    'tied',
    'forfeit',
    'forfeited',
    'strip',
    'type',
    'payload',
    'dict',
    'db',
    'latest_tsupdate',
    'minplayers',
    'maxplayers',
    'teams',
    'mode',
    'owner',
    'isfull',
    'isprivate',
    'tsupdate',
    'tsinsert',
    'name',
    'id',
    'offset',
    'serverTime',
    'gamestatus',
    'pregame',
    'starting',
    'gamestart',
    'gameover',
    'join',
    'leave',
    'seconds',
    'end',
    'ready',
    'update',
    'finish',
    'winner',
    'private',
    'timeleft',
    'user',
    'pick',
    'picked',
    'move',
    'moved',
    'cells',
    'cellid',
    'cellx',
    'celly',
    'cellz',
    'startPlayer',
    'queue',
    'experimental',
    'local',
    'ping',
    'pong',
    'joingame',
    'joinroom',
    'joinqueue',
    'leavequeue',
    'spectate',
    'newround',
    'round',
    'rounds',
    'inrooms',
    'shortid',
    'private_key',
    'joined',
    'Wood I',
    'Wood II',
    'Wood III',
    'Wood IV',
    'Bronze I',
    'Bronze II',
    'Bronze III',
    'Bronze IV',
    'Silver I',
    'Silver II',
    'Silver III',
    'Silver IV',
    'Gold I',
    'Gold II',
    'Gold III',
    'Gold IV',
    'Platinum I',
    'Platinum II',
    'Platinum III',
    'Platinum IV',
    'Champion I',
    'Champion II',
    'Champion III',
    'Champion IV',
    'Grand Champion I',
    'Grand Champion II',
    'Grand Champion III',
    'Grand Champion IV',
]

var defaultDict = null;


function createDefaultDict(storedDict) {

    if (defaultDict != null) {
        return defaultDict;
    }
    defaultDict = {
        count: defaultOrder.length,
        keys: {},
        order: defaultOrder.slice()
    }
    if (storedDict) {
        defaultDict.order = defaultDict.order.concat(storedDict.order);
        defaultDict.count = defaultDict.order.length;
    }
    createDictKeys(defaultDict);

    // if (storedDict && Array.isArray(storedDict)) {
    //     for (var i = 0; i < storedDict.length; i++) {
    //         let key = storedDict[i];
    //         dict.keys[key] = i;
    //         order.push(key);
    //     }
    // }

    return defaultDict;
}


function isObject(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object';
}

function serialize(json, dict) {
    let buffer = [];
    dict = dict || { count: defaultOrder.length, keys: {}, order: [] };

    let cache = {};

    serializeEX(json, buffer, dict, cache);


    let arrBuffer = Uint8Array.from(buffer);
    // for (var i = 0; i < buffer.length; i++) {
    //     arrBuffer[i] = buffer[i];
    // }

    return arrBuffer.buffer;

}

function serializeEX(json, buffer, dict, cache) {
    buffer = buffer || [];
    dict = dict || { count: defaultOrder.length, keys: {}, order: [] };

    if (typeof json === 'undefined' || json == null) {
        buffer.push(TYPE_NULL);
        return;
    }
    let isString = (typeof json === 'string' || json instanceof String);

    if (json instanceof Date) {
        buffer.push(TYPE_DATE);
        let epoch = json.getTime();
        // console.log('epoch', epoch);
        dv.setBigUint64(0, BigInt(epoch));
        buffer.push(dv.getUint8(0));
        buffer.push(dv.getUint8(1));
        buffer.push(dv.getUint8(2));
        buffer.push(dv.getUint8(3));
        buffer.push(dv.getUint8(4));
        buffer.push(dv.getUint8(5));
        buffer.push(dv.getUint8(6));
        buffer.push(dv.getUint8(7));
        return;
    }

    if (Array.isArray(json)) {
        if (json.length == 0) {
            buffer.push(TYPE_EMPTY_ARR);
            return;
        }
        buffer.push(TYPE_ARR);
        serializeArr(json, buffer, dict, cache);
        buffer.push(TYPE_ENDARR);
        return;
    }

    if (isObject(json)) {
        if (Object.keys(json).length == 0) {
            buffer.push(TYPE_EMPTY_OBJ);
            return;
        }

        buffer.push(TYPE_OBJ);
        serializeObj(json, buffer, dict, cache);
        buffer.push(TYPE_ENDOBJ);
        return;
    }


    if (isString) {

        if (json.length == 0) {
            buffer.push(TYPE_EMPTYSTRING);
            return;
        }

        let exists = mapKey(json, buffer, dict, cache, true);
        if (exists) {
            return;
        }


        if (json in cache) {
            let pos = cache[json];
            console.log("Found cache for:", json, "at", pos);
            if (json.length <= 255) {
                buffer.push(TYPE_STRING_DICT1);
                dv.setUint8(0, pos);
                buffer.push(dv.getUint8(0));
            }
            else {
                buffer.push(TYPE_STRING_DICT2);
                dv.setUint16(0, pos);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
            }

            return;
        }

        buffer.push(TYPE_STRING)
        let pos = buffer.length;
        cache[json] = pos;

        let encoded = encoder.encode(json);
        for (var i = 0; i < encoded.byteLength; i++) {
            // console.log(json + '[' + i + ']', encoded[i]);
            buffer.push(encoded[i]);
        }
        buffer.push(0);
        return;
    }


    if (typeof json === "boolean") {
        if (json == false) {
            buffer.push(TYPE_FALSE);
            return;
        }
        buffer.push(TYPE_TRUE);
        return;
    }

    if (typeof json === 'number') {
        if (Number.isInteger(json)) {
            if (json == 0) {
                buffer.push(TYPE_ZERO);
                return;
            } else if (json == 1) {
                buffer.push(TYPE_ONE);
                return;
            } else if (json == 2) {
                buffer.push(TYPE_TWO);
                return;
            } else if (json == 3) {
                buffer.push(TYPE_THREE);
                return;
            }
            else if (json >= -128 && json <= 127) {
                buffer.push(TYPE_INT8);
                dv.setInt8(0, json);
                buffer.push(dv.getUint8(0));
            }
            else if (json >= 0 && json <= 255) {
                buffer.push(TYPE_UINT8);
                dv.setUint8(0, json);
                buffer.push(dv.getUint8(0));
            }
            else if (json >= -32768 && json <= 32767) {
                buffer.push(TYPE_INT16);
                dv.setInt16(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
            }
            else if (json >= 0 && json <= 65535) {
                buffer.push(TYPE_UINT16);
                dv.setUint16(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
            }
            else if (json >= -2147483648 && json <= 2147483647) {
                buffer.push(TYPE_INT32);
                dv.setInt32(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
            }
            else if (json >= 0 && json <= 4294967295) {
                buffer.push(TYPE_UINT32);
                dv.setUint32(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
            }
            else if (json < -2147483648 || json > 4294967295) {
                buffer.push(TYPE_INT64);
                dv.setBigInt64(0, BigInt(json));
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
                buffer.push(dv.getUint8(4));
                buffer.push(dv.getUint8(5));
                buffer.push(dv.getUint8(6));
                buffer.push(dv.getUint8(7));
            }
            else if (json > 4294967295) {
                buffer.push(TYPE_UINT64);
                dv.setBigUint64(0, BigInt(json));
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
                buffer.push(dv.getUint8(4));
                buffer.push(dv.getUint8(5));
                buffer.push(dv.getUint8(6));
                buffer.push(dv.getUint8(7));
            }
            return;
        }
        else {
            // if (json >= -3.4e38 && json <= 3.4e38) {
            // buffer.push(TYPE_FLOAT32);
            // dv.setFloat32(0, json);
            // buffer.push(dv.getUint8(0));
            // buffer.push(dv.getUint8(1));
            // buffer.push(dv.getUint8(2));
            // buffer.push(dv.getUint8(3));
            // }
            // else {
            let str = "" + json;
            if (str.length < 6) {
                buffer.push(TYPE_FLOATSTR);
                let encoded = encoder.encode(json);
                for (var i = 0; i < encoded.byteLength; i++) {
                    // console.log(json + '[' + i + ']', encoded[i]);
                    buffer.push(encoded[i]);
                }
                buffer.push(0);
            }
            else {
                buffer.push(TYPE_FLOAT64);
                dv.setFloat64(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
                buffer.push(dv.getUint8(4));
                buffer.push(dv.getUint8(5));
                buffer.push(dv.getUint8(6));
                buffer.push(dv.getUint8(7));
            }

            // }
            return;
        }
    }


}

function mapKey(key, buffer, dict, cache, skip) {
    let id = dict.count || 0;
    if (key in dict.keys) {
        id = dict.keys[key];
    } else {
        if (skip) {
            return false;
        }
        if (dict.frozen || dict.count >= 255) {
            serializeEX(key, buffer, dict, cache);
            return false;
        }

        id = dict.count;
        dict.count += 1;
        dict.keys[key] = id;
        dict.order.push(key);

    }

    buffer.push(TYPE_DICT);
    buffer.push(id);

    return true;
}

function mapDeletionKey(key, buffer, dict, cache) {

    let skey = key.substr(1, key.length - 1);
    if (!(skey in dict.keys)) {
        mapKey(key, buffer, dict, cache);
        return false;
    }

    let id = dict.keys[skey];
    buffer.push(TYPE_DEL_DICTKEY);
    buffer.push(id);

    return true;
}

function serializeObj(json, buffer, dict, cache) {

    for (var key in json) {
        let value = json[key];
        if (key[0] == '$') {
            if (mapDeletionKey(key, buffer, dict, cache))
                return;
        }
        else {
            mapKey(key, buffer, dict, cache);
        }
        serializeEX(value, buffer, dict, cache);
    }
}

function serializeArr(json, buffer, dict, cache) {

    for (var i = 0; i < json.length; i++) {
        let value = json[i];
        serializeEX(value, buffer, dict, cache);
    }
}

function deserialize(buffer, pos, dict) {
    var ref = {
        buffer,
        pos,
        dict
    }
    return deserializeEX(ref);
}

function deserializeEX(ref) {

    // buffer = new DataView(ref.buffer);
    let json;
    let arr, i;
    let data;
    let type = ref.buffer.getInt8(ref.pos++);

    switch (type) {
        case TYPE_EMPTY_OBJ:
            json = {};
            break;
        case TYPE_EMPTY_ARR:
            json = [];
            break;
        case TYPE_DICT:
            let id = ref.buffer.getUint8(ref.pos++);
            json = ref.dict.order[id];
            break;
        case TYPE_NULL:
            json = null;
            break;
        case TYPE_ZERO:
            json = 0;
            break;
        case TYPE_ONE:
            json = 1;
            break;
        case TYPE_TWO:
            json = 2;
            break;
        case TYPE_THREE:
            json = 3;
            break;
        case TYPE_OBJ:
            json = deserializeObj({}, ref);
            break;
        case TYPE_ARR:
            json = deserializeArr([], ref);
            break;
        case TYPE_EMPTYSTRING:
            json = '';
            break;
        //the string exists in the buffer already less than 255 indices away
        case TYPE_STRING_DICT1:
            arr = [];
            let position = ref.buffer.getUint8(ref.pos);
            for (; position < ref.buffer.byteLength; position++) {
                let val = ref.buffer.getUint8(position);
                if (val == 0) {
                    break;
                }
                arr.push(val);
            }
            ref.pos++; //skip null terminated
            data = new Uint8Array(arr);
            json = decoder.decode(data);
            break;
        //the string exists in the buffer already less than 65,536 indices away
        case TYPE_STRING_DICT2:
            arr = [];
            let position2 = ref.buffer.getUint16(ref.pos);
            for (; position2 < ref.buffer.byteLength; position2++) {
                let val = ref.buffer.getUint8(position2);
                if (val == 0) {
                    break;
                }
                arr.push(val);
            }
            ref.pos += 2; //skip null terminated
            data = new Uint8Array(arr);
            json = decoder.decode(data);
            break;
        case TYPE_STRING:
            arr = [];
            for (; ref.pos < ref.buffer.byteLength; ref.pos++) {
                let val = ref.buffer.getUint8(ref.pos);
                if (val == 0) {
                    break;
                }
                arr.push(val);
            }
            ref.pos++; //skip null terminated
            data = new Uint8Array(arr);
            json = decoder.decode(data);
            // console.log('string: ', json);
            break;
        case TYPE_TRUE:
            json = true;
            break;
        case TYPE_FALSE:
            json = false;
            break;
        case TYPE_DATE:
            json = ref.buffer.getBigUint64(ref.pos);
            json = new Date(Number(json));
            ref.pos += 8;
            break;
        case TYPE_INT8:
            json = ref.buffer.getInt8(ref.pos);
            ref.pos++;
            break;
        case TYPE_UINT8:
            json = ref.buffer.getUint8(ref.pos);
            ref.pos++;
            break;
        case TYPE_INT16:
            json = ref.buffer.getInt16(ref.pos);
            ref.pos += 2;
            break;
        case TYPE_UINT16:
            json = ref.buffer.getUint16(ref.pos);
            ref.pos += 2;
            break;
        case TYPE_INT32:
            json = ref.buffer.getInt32(ref.pos);
            ref.pos += 4;
            break;
        case TYPE_UINT32:
            json = ref.buffer.getUint32(ref.pos);
            ref.pos += 4;
            break;
        case TYPE_INT64:
            json = ref.buffer.getBigInt64(ref.pos);
            json = Number(json);
            ref.pos += 8;
            break;
        case TYPE_UINT64:
            json = ref.buffer.getBigUint64(ref.pos);
            json = Number(json);
            ref.pos += 8;
            break;
        // case TYPE_FLOAT32:
        //     json = ref.buffer.getFloat32(ref.pos);
        //     ref.pos += 4;
        //     break;
        case TYPE_FLOATSTR:
            arr = [];
            for (; ref.pos < ref.buffer.byteLength; ref.pos++) {
                let val = ref.buffer.getUint8(ref.pos);
                if (val == 0) {
                    break;
                }
                arr.push(val);
            }
            ref.pos++; //skip null terminated
            data = new Uint8Array(arr);
            json = decoder.decode(data);
            json = parseFloat(json);
            break;
        case TYPE_FLOAT64:
            json = ref.buffer.getFloat64(ref.pos);
            ref.pos += 8;
            break;
    }

    return json;
}

function deserializeObj(json, ref) {
    json = json || {};

    let type = ref.buffer.getUint8(ref.pos++);
    if (type == TYPE_ENDOBJ) {
        return json
    }

    if (type != TYPE_DICT && type != TYPE_STRING && type != TYPE_DEL_DICTKEY && type != TYPE_STRING_DICT1 && type != TYPE_STRING_DICT2) {
        throw 'E_INVALIDOBJ';
    }

    if (type == TYPE_DEL_DICTKEY) {
        let id = ref.buffer.getUint8(ref.pos++);
        let key = '$' + ref.dict.order[id];
        json[key] = 0;

        return deserializeObj(json, ref);
    }

    if (type == TYPE_DICT) {
        let id = ref.buffer.getUint8(ref.pos++);
        let key = ref.dict.order[id];
        let value = deserializeEX(ref);
        json[key] = value;
        // console.log(key, value);

        return deserializeObj(json, ref);
    }

    if (type == TYPE_STRING || type == TYPE_STRING_DICT1 || type == TYPE_STRING_DICT2) {
        ref.pos--;
        // let id = ref.buffer.getUint8(ref.pos++);
        let key = deserializeEX(ref);
        let value = deserializeEX(ref);
        json[key] = value;
        // console.log(key, value);
        return deserializeObj(json, ref);
    }

    throw 'E_INVALIDOBJ';
}

function deserializeArr(json, ref) {
    json = json || [];

    if (ref.pos >= ref.buffer.byteLength) {
        throw 'E_INDEXOUTOFBOUNDS';
    }

    let type = ref.buffer.getUint8(ref.pos++);
    if (type == TYPE_ENDARR) {
        return json
    }
    ref.pos--; //move cursor back to get next value

    let value = deserializeEX(ref);
    json.push(value);

    return deserializeArr(json, ref);
}

function encode(json, storedDict) {
    try {

        // console.log("ENCODING: ", JSON.stringify(json, null, 2));
        let dict = createDefaultDict(storedDict);
        dict.frozen = true;
        // console.time('serialize');
        let encoded = serialize(json, dict);
        // console.timeEnd('serialize');
        // console.log('Encoded Size: ', encoded.byteLength)
        // let jsonStr = JSON.stringify(json);
        // let buffer = encoder.encode(jsonStr);
        // let deflated = pako.deflate(encoded);
        //console.log("encode json len: " + buffer.length);
        //console.log("encode byte len: ", deflated.length);
        return encoded;
    }
    catch (e) {
        console.error(e);
    }
    return null;
}

function decode(raw, storedDict) {
    try {

        let dict = createDefaultDict(storedDict);
        dict.frozen = true;
        var dataview = new DataView(raw);
        // console.time('deserialize');
        let decoded = deserialize(dataview, 0, dict);
        // console.timeEnd('deserialize');
        // let inflated = pako.inflate(raw);
        // let jsonStr = decoder.decode(inflated);
        // let json = JSON.parse(jsonStr);
        //console.log("decode byte len: ", raw.byteLength);
        //console.log("decode json len: " + inflated.length);
        return decoded;
    }
    catch (e) {
        console.error(e);
        try {
            let jsonStr = raw.toString();
            let json = JSON.parse(jsonStr);
            return json;
        }
        catch (e) {
            console.error(e);
        }

    }
    return null;
}

function createDictKeys(dict) {
    for (var i = 0; i < dict.order.length; i++) {
        let key = dict.order[i];
        dict.keys[key] = i;
    }
}

function test() {

    let buffer = [];
    let dict = { count: defaultOrder.length, keys: {}, order: defaultOrder.slice(), frozen: false };
    createDictKeys(dict);

    console.time('serialize');
    let encoded = serialize(testJSON, dict);
    let deflated = pako.deflate(encoded);
    console.timeEnd('serialize');

    // console.log("Dict: ", dict);
    let bufferLen = buffer.length;
    let dictLen = JSON.stringify(dict.order).length;

    console.time('compression')
    let jsonStr = JSON.stringify(testJSON);
    let jsonEncoded = encoder.encode(jsonStr);
    let jsonDeflated = pako.deflate(jsonEncoded);
    console.timeEnd('compression')

    // console.log("Dict: ", dict);
    console.log("Buffer:", encoded.byteLength);
    console.log("Dict length: ", dictLen);
    console.log("Buffer+Dict length: ", dictLen + encoded.byteLength);
    console.log("JSON length: ", JSON.stringify(testJSON).length);
    console.log("compressed byte len: ", deflated.length);
    console.log("compressed JSON str byte len: ", jsonDeflated.length);
    var dataview = new DataView(encoded);
    console.time('deserialize');
    let decoded = deserialize(dataview, 0, dict);
    console.timeEnd('deserialize');
    // console.log(JSON.parse(JSON.stringify(testJSON)))
    console.log(decoded);
    // console.log(decoded.players['8CCkf'].score.getTime())
}

// test();

module.exports = { encode, decode, serialize, deserialize, defaultDict }