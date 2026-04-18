import { Response } from "express";

class GeneralError extends Error {

    codeErrors: any[] = [];
    ecode: string | null = null;
    payload: any = null;

    constructor(ecode: string, payload?: any) {
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

    send(res:Response) {
        if (typeof this.ecode === 'string') {
            let error = { ecode: this.ecode, payload: this.payload };
            res.status(this.getCode()).json(error);
            return;
        }

        res.status(this.getCode()).json(this.ecode);
    }

    getErrors() {
        return this.codeErrors;
    }
    getCode() {
        if (this instanceof BadRequest) {
            return 400;
        } if (this instanceof NotFound) {
            return 404;
        }
        return 400;
    }
}

class SQLError extends GeneralError { }
class CodeError extends GeneralError { }
class BadRequest extends GeneralError { }
class NotFound extends GeneralError { }

export {
    GeneralError,
    BadRequest,
    NotFound,
    CodeError,
    SQLError,
};