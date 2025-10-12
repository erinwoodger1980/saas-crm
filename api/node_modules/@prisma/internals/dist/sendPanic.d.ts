import type { MigrateTypes } from './migrateTypes';
import type { RustPanic } from './panic';
type SendPanic = {
    error: RustPanic;
    cliVersion: string;
    enginesVersion: string;
    getDatabaseVersionSafe: (args: MigrateTypes.GetDatabaseVersionParams | undefined) => Promise<string | undefined>;
};
export declare function sendPanic({ error, cliVersion, enginesVersion, getDatabaseVersionSafe, }: SendPanic): Promise<number>;
export {};
