
const ErrorCodes = {
    "E_GAME_DUPENAME": "Game name '$1' already exists.",
    "E_GAME_INVALID": "Game data is invalid, please review again.",
    "E_GAME_CREATEFAILED": "Game creation failed.",
    "E_GAME_UPDATEFAILED": "Game update failed.",
    "E_GAME_NOTFOUND": "Game not found.",
    "E_PERSON_MISSINGINFO": "Person object is missing info.",
    "E_PERSON_NOTFOUND": "Person was not found.",
    "E_PERSON_UPDATEFAILED": "Person update failed.",
    "E_PERSON_DUPENAME": "Person name '$1' already exists.",
    "E_PERSON_CREATEFAILED": "Person create failed.",
    "E_SQL_ERROR": "Error accessing database, please notify admin.",
    "E_FIELD_REQUIRED": "$1 is required",
    "E_FIELD_INVALIDTYPE": "$1 has invalid type",
    "E_FIELD_TOOLONG": "$1 is too long, must be under $2 characters.",
    "E_FIELD_TOOSHORT": "$1 is too short, must be more than $2 characters.",

}

export default function errorMessage(error) {
    if (!(error.ecode in ErrorCodes)) {
        return "";
    }

    var message = ErrorCodes[error.ecode];
    if (error.payload) {
        if (Array.isArray(error.payload)) {
            error.payload.forEach((v, i) => {
                let id = i + 1;
                message = message.replace('$' + id, v);
            })
        }
        else if (typeof error.payload === 'string') {
            message = message.replace('$1', error.payload);
        }
    }

    return message;
}