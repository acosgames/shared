
const FOENV = process.env.FOENV;

module.exports = () => {

    if (FOENV == 'prod' || FOENV == 'production') {
        return require('../credential/production.json');
    }

    return require('../credential/localhost.json');

}