
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');


module.exports = class ObjectStorage {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    connect() {
        
    }

}