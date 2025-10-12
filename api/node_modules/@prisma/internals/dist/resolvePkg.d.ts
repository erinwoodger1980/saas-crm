import resolve from 'resolve';
/**
 * Alternative to `require.resolve` that returns undefined instead of throwing.
 * It also enables preserving symlinks, which is not possible with the original
 * `require.resolve`. This variant will find the _root_ of a package.
 */
export declare function resolvePkg(id: string, options: resolve.AsyncOpts): Promise<string | undefined>;
