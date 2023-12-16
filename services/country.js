
const geoip = require('geoip-country');

function getCountry(ip) {
    try {
        let response = geoip.lookup(ip);
        if (!response)
            return 'US';
        return response.country;
    }
    catch (e) {
        console.error(e);
    }
    return 'US'
}

module.exports = { getCountry }