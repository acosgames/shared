import {
    uniqueNamesGenerator,
    Config,
    adjectives,
    animals,
} from "unique-names-generator";

const customConfig: Config = {
    dictionaries: [adjectives, animals],
    separator: " ",
    length: 2,
    style: "capital",
};

const isObject = (x: any): x is object => {
    return (
        x != null &&
        (typeof x === "object" || typeof x === "function") &&
        !Array.isArray(x)
    );
};

const uniqueName = () => {
    let displayname = uniqueNamesGenerator(customConfig);

    // console.log(displayname); // Purring Swordfish <-------------------------------

    const split = displayname.split(" ");

    if (split[0] === "sexual") {
        displayname = `Diabolic ${split[1]}`;
    }

    return displayname;
};

export { isObject, uniqueName };
