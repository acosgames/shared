
const NODE_ENV = process.env.NODE_ENV;

console.log("NODE_ENV: ", NODE_ENV);

if (NODE_ENV == 'prod' || NODE_ENV == 'production') {
    console.log("LOADING PRODUCTION CREDENTIALS");
}
else if (NODE_ENV == 'mobile') {
    console.log("LOADING MOBILE CREDENTIALS");
}
else
    console.log("LOADING LOCALHOST CREDENTIALS");

module.exports = () => {

    if (NODE_ENV == 'prod' || NODE_ENV == 'production') {
        // console.log("LOADING PRODUCTION CREDENTIALS");
        return require('../credential/production.json');
    }

    if (NODE_ENV == 'mobile') {
        // console.log("LOADING MOBILE CREDENTIALS");
        return require('../credential/mobile.json');
    }
    // console.log("LOADING LOCALHOST CREDENTIALS");
    return require('../credential/localhost.json');
}