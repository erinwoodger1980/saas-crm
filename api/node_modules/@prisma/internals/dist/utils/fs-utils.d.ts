/**
 * Create a directory if it doesn't exist yet.
 * Note: { recursive: true } prevents EEEXIST error codes when the directory already exists.
 * This function can potentially fail (e.g., if the user doesn't have permissions to create the directory).
 */
export declare function createDirIfNotExists(dir: string): Promise<string | undefined>;
/**
 * Create a file with the given content.
 * This function can potentially fail (e.g., if the user doesn't have permissions to create the file).
 */
export declare function writeFile({ path, content }: {
    path: string;
    content: string;
}): Promise<void>;
/**
 * Retrieve any foolder in the given directory, at the top-level of depth.
 */
export declare function getTopLevelFoldersInDir(dir: string): Promise<string[]>;
/**
 * Retrieve any folder nested into the given directory, at any level of depth.
 */
export declare function getNestedFoldersInDir(dir: string): Promise<string[]>;
export declare function getFilesInDir(dir: string, pattern?: string): Promise<string[]>;
/**
 * Removes all empty directories in the given directory.
 * If at the end of the recursion the given directory is empty, that
 * directory is removed as well.
 * Note: this function can potentially fail (e.g., if the user doesn't have permissions to remove a directory).
 */
export declare function removeEmptyDirs(dir: string): Promise<void>;
