const pako = require('pako');
const encoder = new TextEncoder();
const decoder = new TextDecoder();
// const { serialize, deserialize } = require('bson');
const ServerAPI = require('../../fsg-api/src/api/server');

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
    "events": {},
    "timer": {
        "seq": 1
    },
    "players": {
        "8CCkf": {
            "name": "joe",
            "rank": 2,
            "score": 0,
            "type": "O",
            "id": "8CCkf"
        },
        "manC6": {
            "name": "5SG",
            "rank": 2,
            "score": 0,
            "type": "X"
        }
    },
    "prev": {}
};

const TYPE_OBJ = 1;
const TYPE_ARR = 2;
const TYPE_BOOL = 3;
const TYPE_LONG = 4;
const TYPE_DOUBLE = 5;
const TYPE_STRING = 6;
const TYPE_DATE = 7;

function isObject(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
}

function serialize(json, buffer, dict) {
    buffer = buffer || [];
    dict = dict || { count: 0, keys: {} };

    if (isObject(json)) {
        buffer.push(TYPE_OBJ);
        serializeObj(json, buffer, dict);
        return;
    }

    if (Array.isArray(json)) {
        json.push(TYPE_ARR);
        json.push(json.length);
        serializeArr(json, buffer, dict);
        return;
    }

    if (typeof json === 'string' || json instanceof String) {
        buffer.push(TYPE_STRING)
        buffer.push(encoder.encode(json));
        buffer.push(0);
        return;
    }

    if (json instanceof Date) {
        buffer.push(TYPE_DATE);
        buffer.push()
        return;
    }

    if (typeof variable == "boolean") {
        buffer.push(TYPE_BOOL);
        buffer.push(json ? 1 : 0);
        return;
    }

    if (typeof json === 'number') {
        if (Number.isInteger(json)) {
            buffer.push(TYPE_LONG);
            buffer.push(toBytesInt32(json));
            return;
        }
        else {
            buffer.push(TYPE_DOUBLE);
            buffer.push(json)
            return;
        }

    }

    return buffer;
}

function toBytesInt32(num) {
    arr = new Uint8Array([
        (num & 0xff000000) >> 24,
        (num & 0x00ff0000) >> 16,
        (num & 0x0000ff00) >> 8,
        (num & 0x000000ff)
    ]);
    return arr.buffer;
}

function mapKey(key, buffer, dict) {
    let id = dict.count || 0;
    if (key in dict.keys) {
        id = dict.keys[key];
    } else {
        id = ++dict.count;
        dict.keys[key] = id;
    }

    buffer.push(id);
}

function serializeObj(json, buffer, dict, ignoreKeyMap) {

    for (var key in json) {
        let value = json[key];
        if (ignoreKeyMap)
            serialize(key, buffer, dict);
        else
            mapKey(key, buffer, dict);
        serialize(value, buffer, dict);
    }

}
function serializeArr(json, buffer, dict) {

    for (var i = 0; i < json.length; i++) {
        let value = json[i];
        serialize(value, buffer, dict);
    }
}

// function deserialize(json, dict) {

// }

function encode(json) {
    try {
        let jsonStr = JSON.stringify(json);
        let buffer = encoder.encode(jsonStr);
        let deflated = pako.deflate(buffer);
        //console.log("encode json len: " + buffer.length);
        //console.log("encode byte len: ", deflated.length);
        return deflated;
    }
    catch (e) {
        console.error(e);
    }
    return null;
}

function decode(raw) {
    try {
        let inflated = pako.inflate(raw);
        let jsonStr = decoder.decode(inflated);
        let json = JSON.parse(jsonStr);
        //console.log("decode byte len: ", raw.byteLength);
        //console.log("decode json len: " + inflated.length);
        return json;
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


function test() {

    let buffer = [];
    let dict = { count: 0, keys: {} };

    console.time('serialize');
    let test = serialize(testJSON, buffer, dict);


    // console.log("Dict: ", dict);
    let bufferLen = buffer.length;
    let dictLen = JSON.stringify(dict).length;
    console.log("Buffer:", bufferLen);
    // console.log("BSON Length: ", bson.length);
    console.log("Dict length: ", dictLen);
    console.log("Buffer+Dict length: ", dictLen + bufferLen);
    console.log("JSON length: ", JSON.stringify(testJSON).length);
    console.timeEnd('serialize');
}

test();

module.exports = { encode, decode }