
const NODE_ENV = process.env.NODE_ENV;

module.exports = () => {
    console.log("NODE_ENV: ", NODE_ENV);

    if (NODE_ENV == 'prod' || NODE_ENV == 'production') {
        console.log("LOADING PRODUCTION CREDENTIALS");
        return require('../credential/production.json');
    }
    console.log("LOADING LOCALHOST CREDENTIALS");
    return require('../credential/localhost.json');
}