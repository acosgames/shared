
import geoip from 'geoip-country';
function getCountry(ip: string): string {
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

export { getCountry };