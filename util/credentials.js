
const FOENV = process.env.FOENV;

module.exports = () => {

    if (FOENV == 'prod' || FOENV == 'production') {
        return require('../credentials/production.json');
    }

    return require('../credentials/localhost.json');

}