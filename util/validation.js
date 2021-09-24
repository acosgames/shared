const schema = require('../model/schema.json');



function validateSimple(tableName, fields) {
    let results = validate(tableName, fields);

    let errors = [];
    if (!results._passed) {
        for (var key in results) {
            let field = results[key];
            if (field && field.length > 0) {
                errors = errors.concat(field);
            }
        }
    }
    return errors;
}

function validate(tableName, fields) {

    let table = schema[tableName];
    let results = { '_passed': true };
    for (var key in table) {
        let rules = table[key];
        let value = fields[key];

        let errors = validateField(tableName, key, value, fields);
        if (errors.length > 0) {
            results[key] = errors;
            results['_passed'] = false;
        }
    }
    return results;
}

function validateField(tableName, key, value, fields) {
    let table = schema[tableName];
    let rules = table[key];
    let errors = [];
    //field not listed, 
    if (!rules) {
        return errors;
    }

    for (var key in rules) {
        if (key == 'label') continue;
        if (key in validationRules) {
            validationRules[key](fields, table, rules, value, errors);
        }
    }

    return errors;
}

const validationRules = {
    type: (fields, table, rules, value, errors) => {
        if (rules.type && typeof value !== rules.type) {
            errors.push(ValidateError('E_FIELD_INVALIDTYPE', rules.label));
        }
    },
    required: (fields, table, rules, value, errors) => {
        if (!value || value.length < 0) {
            errors.push(ValidateError('E_FIELD_REQUIRED', rules.label));
        }
        else if (rules.type && typeof value !== rules.type) {
            errors.push(ValidateError('E_FIELD_INVALIDTYPE', rules.label));
        }
    },
    min: (fields, table, rules, value, errors) => {

        if (typeof value === 'number') {
            if (value < rules.min) {
                errors.push(ValidateError('E_NUMBER_TOOSMALL', [rules.label, rules.max]))
            }
        }
        else if (typeof value === 'string') {
            if (value.length < rules.min) {
                errors.push(ValidateError('E_FIELD_TOOSHORT', [rules.label, rules.max]))
            }
        }
    },
    max: (fields, table, rules, value, errors) => {
        if (typeof value === 'number') {
            if (value > rules.max) {
                errors.push(ValidateError('E_NUMBER_TOOBIG', [rules.label, rules.max]))
            }
        }
        if (typeof value === 'string') {
            if (value.length > rules.max) {
                errors.push(ValidateError('E_FIELD_TOOLONG', [rules.label, rules.max]))
            }
        }
    },
    greaterthanequal: (fields, table, rules, value, errors) => {
        let other = rules.greaterthanequal;
        if (!(other in table)) {
            errors.push(ValidateError('E_FIELD_NOTEXIST', [rules.label, other]))
            return;
        }

        let otherRules = table[other];
        if (otherRules.type != 'number') {
            errors.push(ValidateError('E_FIELD_INCOMPATIBLE', [rules.label, otherRules.label, "number"]))
            return;
        }

        let otherValue = fields[other];
        if (value < otherValue) {
            errors.push(ValidateError('E_NUMBER_TOOSMALL', [rules.label, otherValue]))
            return;
        }
    },
    lessthanequal: (fields, table, rules, value, errors) => {
        let other = rules.lessthanequal;
        if (!(other in table)) {
            errors.push(ValidateError('E_FIELD_NOTEXIST', [rules.label, other]))
            return;
        }

        let otherRules = table[other];
        if (otherRules.type != 'number') {
            errors.push(ValidateError('E_FIELD_INCOMPATIBLE', [rules.label, otherRules.label, "number"]))
            return;
        }

        let otherValue = fields[other];
        if (value > otherValue) {
            errors.push(ValidateError('E_NUMBER_TOOBIG', [rules.label, otherValue]))
            return;
        }
    }
}

module.exports = { validateSimple, validateField, validate }

function ValidateError(ecode, payload) {
    return { ecode, payload };
}
