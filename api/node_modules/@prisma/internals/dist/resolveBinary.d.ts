import { BinaryType, engineEnvVarMap } from '@prisma/fetch-engine';
import * as TE from 'fp-ts/TaskEither';
export { BinaryType, engineEnvVarMap };
export declare function resolveBinary(name: BinaryType, proposedPath?: string): Promise<string>;
export declare function safeResolveBinary(name: BinaryType, proposedPath?: string): TE.TaskEither<Error, string>;
export declare function maybeCopyToTmp(file: string): Promise<string>;
