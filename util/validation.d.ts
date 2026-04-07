export type ValidationError = unknown;

export type ValidationResultItem = {
    key: string;
    value: unknown;
    errors: ValidationError[];
};

export declare function validateSimple(
    tableName: string,
    fields: Record<string, unknown>
): ValidationResultItem[];

export declare function validateField(
    tableName: string,
    key: string,
    value: unknown,
    fields: Record<string, unknown>
): ValidationError[];

export declare function validate(
    tableName: string,
    fields: Record<string, unknown>
): ValidationResultItem[];
