const {
    uniqueNamesGenerator,
    Config,
    adjectives,
    animals,
} = require("unique-names-generator");

const customConfig = {
    dictionaries: [adjectives, animals],
    separator: " ",
    length: 2,
    style: "capital",
};

module.exports = {
    isObject: (x) => {
        return (
            x != null &&
            (typeof x === "object" || typeof x === "function") &&
            !Array.isArray(x)
        );
    },
    uniqueName: () => {
        let displayname = uniqueNamesGenerator(customConfig);

        // console.log(displayname); // Purring Swordfish <-------------------------------

        const split = displayname.split(" ");

        if (split[0] === "sexual") {
            displayname = `Diabolic ${split[1]}`;
        }

        return displayname;
    },
};
