const { networkInterfaces } = require('os');
const nets = networkInterfaces();


module.exports = {

    getLocalAddr: () => {
        for (const name of Object.keys(nets)) {

            if (name != 'Local Area Connection' && name != 'ens1')
                continue;

            let ips = nets[name];
            let ip = ips[ips.length - 1].address;

            return ip;
        }

        return '';
    }
}