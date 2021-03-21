
const credutil = require('../util/credentials')
const { utcDATETIME } = require('../util/datefns');

const axios = require('axios');

module.exports = class InstanceLocal {

    constructor(credentials) {
        this.credentials = credentials || credutil();

        this.axiosConfig = {
            headers: {
                'X-API-KEY': this.credentials.platform.apikey
            }
        }
    }

    async register(params) {

        try {
            let url = this.credentials.platform.api.url + '/api/v1/server/register';
            params = params || {
                public_addr: '' + process.env.PORT
            }


            let response = await axios.post(url, params, this.axiosConfig);
            if (response.data) {
                return response.data;
            }
        }
        catch (e) {
            console.error(e);
        }
        return null;
    }

    unregister() {

    }


    update() {

    }


}