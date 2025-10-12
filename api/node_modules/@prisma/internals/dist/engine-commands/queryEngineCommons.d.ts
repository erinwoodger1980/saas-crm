import * as TE from 'fp-ts/TaskEither';
export declare function unlinkTempDatamodelPath(options: {
    datamodelPath?: string;
}, tempDatamodelPath: string | undefined): TE.TaskEither<{
    type: string;
    reason: string;
    error: unknown;
}, void>;
export declare const createDebugErrorType: (debug: (formatter: any, ...args: any[]) => void, fnName: string) => ({ type, reason, error }: {
    type: string;
    reason: string;
    error: Error;
}) => void;
export declare function createSchemaValidationError(reason: string): string;
export type QueryEngineErrorInit = {
    reason: string;
    message: string;
} & ({
    readonly _tag: 'parsed';
    errorCode?: string;
} | {
    readonly _tag: 'unparsed';
});
export type ParseQueryEngineError = {
    errorOutput: string;
    reason: string;
};
/**
 * Parse the error output of getConfig / getDmmf, which follow the format convention of the query-engine methods.
 */
export declare function parseQueryEngineError({ errorOutput, reason }: ParseQueryEngineError): QueryEngineErrorInit;
