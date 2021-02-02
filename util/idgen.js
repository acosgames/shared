const FlakeId = require('flakeid');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    genUnique64(mid) {
        mid = mid || 0;
        const flake = new FlakeId({
            mid, //optional, define machine id
            timeOffset: (2020 - 1970) * 31536000 * 1000 //optional, define a offset time
        });
        return flake.gen();
    },

    generateAPIKEY() {
        let id = uuidv4().replace(/\-/ig, '').toUpperCase();
        return id;
    }
}