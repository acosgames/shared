
const ACOSENV = process.env.ACOSENV;

module.exports = () => {
    if (ACOSENV == 'prod' || ACOSENV == 'production') {
        return require('../credential/production.json');
    }

    return require('../credential/localhost.json');
}