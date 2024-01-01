const { uniqueNamesGenerator, Config, adjectives, animals } = require('unique-names-generator');

const customConfig = {
    dictionaries: [adjectives, animals],
    separator: ' ',
    length: 2,
    style: 'capital',
};

module.exports = {
    isObject: (x) => {
        return x != null && (typeof x === 'object' || typeof x === 'function') && !Array.isArray(x);
    },
    uniqueName: () => {

        let name = uniqueNamesGenerator(customConfig);

        // console.log(name); // Purring Swordfish <-------------------------------

        const split = name.split(' ');

        if (split[0] === 'sexual') {
            name = `Diabolic ${split[1]}`;
        }

        return name;
    }
}