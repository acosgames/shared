const pako = require('pako');

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

function encode(json) {

    try {
        let jsonStr = JSON.stringify(json);
        let buffer = encoder.encode(jsonStr);
        // let deflated = pako.deflate(buffer);
        return buffer;
    }
    catch (e) {
        console.error(e);
    }

    try {
        let jsonStr = JSON.stringify(json);
        let buffer = encoder.encode(jsonStr);
        let deflated = pako.deflate(buffer);
        return deflated;
    }
    catch (e) {
        console.error(e);
    }
    return null;
}

function decode(raw) {
    try {
        // let inflated = pako.inflate(raw);
        let jsonStr = decoder.decode(raw);
        let json = JSON.parse(jsonStr);
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


    try {
        let inflated = pako.inflate(raw);
        let jsonStr = decoder.decode(inflated);
        let json = JSON.parse(jsonStr);
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

module.exports = { encode, decode }