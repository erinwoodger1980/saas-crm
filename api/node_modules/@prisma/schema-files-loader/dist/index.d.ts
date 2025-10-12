export declare type CaseSensitivityOptions = {
    caseSensitive: boolean;
};

/**
 * Files resolver that combines two other resolvers
 * together. Files existing in either one of those will be
 * reported. If content exist in both, primary resolver takes
 * precedence
 */
export declare class CompositeFilesResolver implements FilesResolver {
    private primary;
    private secondary;
    private _fileNameToKey;
    constructor(primary: FilesResolver, secondary: FilesResolver, options: CaseSensitivityOptions);
    listDirContents(path: string): Promise<string[]>;
    getEntryType(path: string): Promise<FsEntryType | undefined>;
    getFileContents(path: string): Promise<string | undefined>;
}

export declare function ensureType(entryPath: string, expectedType: PathType): Promise<NonFatalLookupError | undefined>;

export declare interface FilesResolver {
    listDirContents(path: string): Promise<string[]>;
    getEntryType(path: string): Promise<FsEntryType | undefined>;
    getFileContents(path: string): Promise<string | undefined>;
}

export declare type FsEntryType = {
    kind: 'file';
} | {
    kind: 'directory';
} | {
    kind: 'symlink';
    realPath: string;
} | {
    kind: 'other';
};

export declare type GetSchemaResult = {
    /**
     * A path from which schema was loaded.
     * Can be either folder or a single file
     */
    schemaPath: string;
    /**
     * Base dir for all of the schema files.
     * In-multi file mode, this is equal to `schemaPath`.
     * In single-file mode, this is a parent directory of
     * a file
     */
    schemaRootDir: string;
    /**
     * All loaded schema files
     */
    schemas: Array<LoadedFile>;
};

export declare class InMemoryFilesResolver implements FilesResolver {
    private _tree;
    private _fileNameToKey;
    constructor(options: CaseSensitivityOptions);
    addFile(absolutePath: string, content: string): void;
    private getInMemoryContent;
    listDirContents(filePath: string): Promise<string[]>;
    getEntryType(filePath: string): Promise<FsEntryType | undefined>;
    getFileContents(filePath: string): Promise<string | undefined>;
}

export declare type LoadedFile = [filePath: string, content: string];

/**
 * Given a single file path, returns
 * all files composing the same schema
 * @param filePath
 * @param filesResolver
 * @returns
 */
export declare function loadRelatedSchemaFiles(filePath: string, filesResolver?: FilesResolver): Promise<LoadedFile[]>;

/**
 * Given folder name, returns list of all files composing a single prisma schema
 * @param folderPath
 */
export declare function loadSchemaFiles(folderPath: string, filesResolver?: FilesResolver): Promise<LoadedFile[]>;

export declare type LookupResult = SuccessfulLookupResult | {
    ok: false;
    error: NonFatalLookupError;
};

export declare type NonFatalLookupError = {
    kind: 'NotFound';
    expectedType?: PathType;
    path: string;
} | {
    kind: 'WrongType';
    path: string;
    expectedTypes: PathType[];
};

export declare type PathType = 'file' | 'directory';

export declare const realFsResolver: FilesResolver;

export declare type SuccessfulLookupResult = {
    ok: true;
    schema: GetSchemaResult;
};

export { }
