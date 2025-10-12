import type { PlatformInfo } from '@prisma/get-platform';
/**
 * This is a wrapper around `require` for loading a Node-API library.
 * This is to avoid eval and hide require away from bundlers
 */
export declare function loadLibrary<T>(id: string, platformInfo: PlatformInfo): T;
