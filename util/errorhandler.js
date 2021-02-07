

class GeneralError extends Error {
    constructor(ecode, payload, previous) {
        super();

        this.codeErrors = [];
        this.ecode = ecode;
        this.payload = payload;

        // let error = { ecode, payload };
        // this.errors = [];

        // if (previous && previous.getErrors) {
        //     let prevErrors = previous.getErrors();
        //     if (prevErrors && prevErrors.length > 0) {
        //         this.errors = this.errors.concat(prevErrors);
        //     }
        // }

        // this.errors.push(error);
    }

    send(res) {
        if (typeof this.ecode === 'string') {
            let error = {};
            error.ecode = this.ecode;
            if (this.payload)
                error.payload = this.payload;
            res.status(this.getCode()).json(error);
            return;
        }

        res.status(this.getCode()).json(this.ecode);
    }

    getErrors() {
        return this.errors;
    }
    getCode() {
        if (this instanceof BadRequest) {
            return 400;
        } if (this instanceof NotFound) {
            return 400;
        }
        return 400;
    }
}

class SQLError extends GeneralError { }
class CodeError extends GeneralError { }
class BadRequest extends GeneralError { }
class NotFound extends GeneralError { }

module.exports = {
    GeneralError,
    BadRequest,
    NotFound,
    CodeError,
    SQLError
};