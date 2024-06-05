import * as schema from '../model/schema.json' assert  { type: "json" };

export function validateSimple(tableName, fields) {
    return _validateSimple(tableName, fields)
}
export function validateField(tableName, key, value, fields) {
    return _validateField(tableName, key, value, fields)
}

export function validate(tableName, fields) {
    return _validate(tableName, fields)
}
function _validateSimple(tableName, fields) {
    let results = validate(tableName, fields);

    let errors = [];
    if (!results._passed) {
        for (var key in results) {
            let field = results[key];
            if (field && field?.errors.length > 0) {
                errors = errors.concat(field);
            }
        }
    }
    return errors;
}

function _validate(tableName, fields) {
    let table = schema[tableName];
    let results = [];
    for (var key in table) {
        let rules = table[key];
        let value = fields[key];

        //these should be validated separatetly or REMOVED completely
        if (Array.isArray(value)) {
            continue;
        }

        let errors = validateField(tableName, key, value, fields);
        if (errors.length > 0) {
            results.push({ key, value, errors });
            // results[key] = ;
            // results["_passed"] = false;
        }
    }
    return results;
}

function _validateField(tableName, key, value, fields) {
    let table = schema[tableName];
    let rules = table[key];
    let errors = [];
    //field not listed,
    if (!rules) {
        return errors;
    }

    for (var key in rules) {
        if (key == "label") continue;
        if (key in validationRules) {
            validationRules[key](fields, table, rules, value, errors);
        }
    }
    return errors;
}

const regexColorHex = /^#([0-9a-f]{3}){1,2}$/i;


const validationRules = {
    type: (fields, table, rules, value, errors) => {
        return
        if (value == null) return;
        if (rules.type && typeof value !== rules.type) {
            errors.push(ValidateError("E_FIELD_INVALIDTYPE", rules.label));
        }
    },
    required: (fields, table, rules, value, errors) => {
        if (!rules.required) return;
        if (
            typeof value === "undefined" ||
            value == null ||
            (typeof value === "string" && value.length <= 0)
        ) {
            errors.push(
                ValidateError("E_FIELD_REQUIRED", rules.label + " is required.")
            );
        } else if (rules.type && typeof value !== rules.type) {
            errors.push(
                ValidateError(
                    "E_FIELD_INVALIDTYPE",
                    rules.label + " has invalid type."
                )
            );
        }
    },
    integer: (fields, table, rules, value, errors) => {
        if (typeof value === "string" && Number.parseInt(value) === NaN) {
            errors.push(
                ValidateError(
                    "E_NOT_INTEGER",
                    rules.label + " is a string, must be an integer."
                )
            );
        }

        if (!Number.isInteger(value)) {
            errors.push(
                ValidateError(
                    "E_NOT_INTEGER",
                    rules.label + " must be an integer."
                )
            );
        }
    },
    min: (fields, table, rules, value, errors) => {
        if (typeof value === "number") {
            if (value < rules.min) {
                errors.push(
                    ValidateError(
                        "E_NUMBER_TOOSMALL",
                        rules.label + " is less than min, " + rules.min
                    )
                );
            }
        } else if (typeof value === "string") {
            if (value.length < rules.min) {
                errors.push(
                    ValidateError(
                        "E_FIELD_TOOSHORT",
                        rules.label +
                        " is too short, min of " +
                        rules.min +
                        " characters."
                    )
                );
            }
        }
    },
    max: (fields, table, rules, value, errors) => {
        if (typeof value === "number") {
            if (value > rules.max) {
                errors.push(
                    ValidateError(
                        "E_NUMBER_TOOBIG",
                        rules.label + " is more than max, " + rules.max
                    )
                );
            }
        }
        if (typeof value === "string") {
            if (value.length > rules.max) {
                errors.push(
                    ValidateError(
                        "E_FIELD_TOOLONG",
                        rules.label +
                        " is too long, max of " +
                        rules.max +
                        " characters."
                    )
                );
            }
        }
    },
    greaterthanequal: (fields, table, rules, value, errors) => {
        let other = rules.greaterthanequal;
        if (!(other in table)) {
            errors.push(
                ValidateError("E_FIELD_NOTEXIST", [rules.label, other])
            );
            return;
        }

        let otherRules = table[other];
        if (otherRules.type != "number") {
            errors.push(
                ValidateError("E_FIELD_INCOMPATIBLE", [
                    rules.label,
                    otherRules.label,
                    "number",
                ])
            );
            return;
        }

        let otherValue = fields[other];
        if (value < otherValue) {
            errors.push(
                ValidateError("E_NUMBER_TOOSMALL", [rules.label, otherValue])
            );
            return;
        }
    },
    lessthanequal: (fields, table, rules, value, errors) => {
        let other = rules.lessthanequal;
        if (!(other in table)) {
            errors.push(
                ValidateError("E_FIELD_NOTEXIST", [rules.label, other])
            );
            return;
        }

        let otherRules = table[other];
        if (otherRules.type != "number") {
            errors.push(
                ValidateError("E_FIELD_INCOMPATIBLE", [
                    rules.label,
                    otherRules.label,
                    "number",
                ])
            );
            return;
        }

        let otherValue = fields[other];
        if (value > otherValue) {
            errors.push(
                ValidateError("E_NUMBER_TOOBIG", [rules.label, otherValue])
            );
            return;
        }
    },
    iscolor: (fields, table, rules, value, errors) => {
        if (typeof value !== "string") {
            errors.push(ValidateError("E_FIELD_INCOMPATIBLE", [rules.label]));
        }

        if (typeof value === "string") {
            if (!regexColorHex.test(value)) {
                errors.push(
                    ValidateError("E_INVALID_COLOR", [rules.label, value])
                );
            }
        }
    },
};

function ValidateError(ecode, payload) {
    return payload; // { ecode, payload };
}

