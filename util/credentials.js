
const FSGENV = process.env.FSGENV;

module.exports = () => {
    if (FSGENV == 'prod' || FSGENV == 'production') {
        return require('../credential/production.json');
    }

    return require('../credential/localhost.json');
}