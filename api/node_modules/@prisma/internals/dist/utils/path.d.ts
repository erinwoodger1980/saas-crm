/**
 * Normalize `filePath` to use forward slashes as a separator. `filePath` is
 * treated as a path specific to the current platform, so backslashes will only
 * be replaced with forward slashes on Windows. On other platforms, where a
 * backslash is a valid filename character, it will be treated as such and will
 * not be replaced.
 */
export declare function pathToPosix(filePath: string): string;
/**
 * Returns the longest common path ancestor of the two paths (which may also be equal to one or both of them).
 * If they don't share a common ancestor (which may be the case on Windows if both paths are on different disks),
 * returns `undefined`.
 */
export declare function longestCommonPathPrefix(pathA: string, pathB: string): string | undefined;
