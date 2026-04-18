import { Response } from "express";
declare class GeneralError extends Error {
    codeErrors: any[];
    ecode: string | null;
    payload: any;
    constructor(ecode: string, payload?: any);
    send(res: Response): void;
    getErrors(): any[];
    getCode(): 400 | 404;
}
declare class SQLError extends GeneralError {
}
declare class CodeError extends GeneralError {
}
declare class BadRequest extends GeneralError {
}
declare class NotFound extends GeneralError {
}
export { GeneralError, BadRequest, NotFound, CodeError, SQLError, };
//# sourceMappingURL=errorhandler.d.ts.map