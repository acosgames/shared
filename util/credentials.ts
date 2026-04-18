
import localhostCredentials from "../credential/localhost.json" with { type: "json" };
import productionCredentials from "../credential/production.json" with { type: "json" };
import mobileCredentials from "../credential/mobile.json" with { type: "json" };

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

export default ():any => {

    if( process.env.DEBUG == '1' ) {
        return localhostCredentials;
    }
    if (NODE_ENV == 'prod' || NODE_ENV == 'production') {
        // console.log("LOADING PRODUCTION CREDENTIALS");
        return productionCredentials;
    }

    if (NODE_ENV == 'mobile') {
        // console.log("LOADING MOBILE CREDENTIALS");
        return mobileCredentials;
    }
    // console.log("LOADING LOCALHOST CREDENTIALS");
    return localhostCredentials;
}