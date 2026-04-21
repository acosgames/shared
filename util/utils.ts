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

const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD') // Splits accented letters (e.g., "á" to "a" + accent)
    .replace(/[\u0300-\u036f]/g, '') // Removes the accent marks
    .replace(/[^a-z0-9 -]/g, '') // Removes all non-alphanumeric characters
    .replace(/\s+/g, '-') // Replaces spaces with hyphens
    .replace(/-+/g, '-'); // Replaces multiple hyphens with a single one
};

const slugifyUpper = (str) => {
  return str
    .toUpperCase()
    .trim()
    .normalize('NFD') // Splits accented letters (e.g., "á" to "a" + accent)
    .replace(/[\u0300-\u036f]/g, '') // Removes the accent marks
    .replace(/[^A-Z0-9 _]/g, '') // Removes all non-alphanumeric characters
    .replace(/\s+/g, '_') // Replaces spaces with underscores
    .replace(/_+/g, '_'); // Replaces multiple underscores with a single underscore
};

export { isObject, uniqueName, slugify, slugifyUpper };
