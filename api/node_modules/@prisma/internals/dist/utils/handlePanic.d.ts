import type { MigrateTypes } from '../migrateTypes';
import type { RustPanic } from '../panic';
type HandlePanic = {
    error: RustPanic;
    cliVersion: string;
    enginesVersion: string;
    command: string;
    getDatabaseVersionSafe: (args: MigrateTypes.GetDatabaseVersionParams | undefined) => Promise<string | undefined>;
};
export declare function handlePanic(args: HandlePanic): Promise<void>;
export {};
