import schema from '../model/schema.json';

export function validateSimple(tableName, fields) {
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

export function validate(tableName, fields) {

    let table = schema[tableName];
    let results = { '_passed': true };
    for (var key in table) {
        let rules = table[key];
        let value = fields[key];

        let errors = validateField(tableName, key, value);
        if (errors.length > 0) {
            results[key] = errors;
            results['_passed'] = false;
        }
    }
    return results;
}

export function validateField(tableName, key, value) {
    let table = schema[tableName];
    let rules = table[key];
    let errors = [];
    //field not listed, 
    if (!rules) {
        return errors;
    }

    // if (rules && rules.required && (typeof value === 'undefined'))
    //     errors.push(ValidateError('E_FIELD_REQUIRED', rules.label))

    //not matching type


    if (rules.required) {
        if (!value || value.length < 0) {
            errors.push(ValidateError('E_FIELD_REQUIRED', rules.label));
        }
        else if (typeof value !== rules.type) {
            errors.push(ValidateError('E_FIELD_INVALIDTYPE', rules.label));
        }
    }
    else if (typeof value !== rules.type) {
        errors.push(ValidateError('E_FIELD_INVALIDTYPE', rules.label));
    }

    if (typeof value === 'string') {

        if (value.length > rules.max) {
            errors.push(ValidateError('E_FIELD_TOOLONG', [rules.label, rules.max]))
        }
        else if (value.length < rules.min)
            errors.push(ValidateError('E_FIELD_TOOSHORT', [rules.label, rules.min]));
    }

    return errors;
}


function ValidateError(ecode, payload) {
    return { ecode, payload };
}
