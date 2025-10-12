import * as T from 'fp-ts/lib/Task';
import * as TE from 'fp-ts/lib/TaskEither';
export declare const createDirIfNotExists: (dir: string) => TE.TaskEither<{
    readonly type: "fs-create-dir";
    readonly error: Error & {
        code: string;
    };
    readonly meta: {
        dir: string;
    };
}, string | undefined>;
export declare const writeFile: (params: {
    path: string;
    content: string;
}) => TE.TaskEither<{
    readonly type: "fs-write-file";
    readonly error: Error & {
        code: string;
    };
    readonly meta: {
        path: string;
        content: string;
    };
}, void>;
export declare const removeEmptyDirs: (dir: string) => TE.TaskEither<{
    readonly type: "fs-remove-empty-dirs";
    readonly error: Error & {
        code: string;
    };
    readonly meta: {
        dir: string;
    };
}, void>;
export declare const removeDir: (dir: string) => TE.TaskEither<{
    readonly type: "fs-remove-dir";
    readonly error: Error & {
        code: string;
    };
    readonly meta: {
        dir: string;
    };
}, void>;
export declare const removeFile: (filePath: string) => TE.TaskEither<{
    readonly type: "fs-remove-file";
    readonly error: Error & {
        code: string;
    };
    readonly meta: {
        filePath: string;
    };
}, void>;
export declare const getNestedFoldersInDir: (dir: string) => T.Task<string[]>;
export declare const getFilesInDir: (dir: string, pattern?: string) => T.Task<string[]>;
