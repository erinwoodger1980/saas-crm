export declare enum SchemaEngineExitCode {
    Success = 0,
    Error = 1,
    Panic = 101
}
export interface SchemaEngineLogLine {
    timestamp: string;
    level: LogLevel;
    fields: LogFields;
    target: string;
}
type LogLevel = 'INFO' | 'ERROR' | 'DEBUG' | 'WARN';
interface LogFields {
    message: string;
    git_hash?: string;
    is_panic?: boolean;
    error_code?: string;
    backtrace?: string;
    [key: string]: any;
}
export type DatabaseErrorCodes = 'P1000' | 'P1001' | 'P1002' | 'P1003' | 'P1009' | 'P1010';
export type ConnectionResult = true | ConnectionError;
export interface ConnectionError {
    message: string;
    code: DatabaseErrorCodes;
}
export declare function canConnectToDatabase(connectionString: string, cwd?: string, schemaEnginePath?: string): Promise<ConnectionResult>;
export declare function createDatabase(connectionString: string, cwd?: string, schemaEnginePath?: string): Promise<boolean>;
export declare function dropDatabase(connectionString: string, cwd?: string, schemaEnginePath?: string): Promise<boolean>;
export declare function execaCommand({ connectionString, cwd, schemaEnginePath, engineCommandName, }: {
    connectionString: string;
    cwd: string;
    schemaEnginePath?: string;
    engineCommandName: 'create-database' | 'drop-database' | 'can-connect-to-database';
}): Promise<import("execa").ExecaReturnValue<string>>;
export {};
