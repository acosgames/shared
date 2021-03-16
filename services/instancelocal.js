
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');


module.exports = class InstanceLocal {

    constructor(credentials) {
        this.credentials = credentials || credutil();

    }

    register() {

    }

    unregister() {

    }


    update() {

    }


}