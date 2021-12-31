
const NODE_ENV = process.env.NODE_ENV;

module.exports = () => {
    if (NODE_ENV == 'prod' || NODE_ENV == 'production') {
        return require('../credential/production.json');
    }

    return require('../credential/localhost.json');
}