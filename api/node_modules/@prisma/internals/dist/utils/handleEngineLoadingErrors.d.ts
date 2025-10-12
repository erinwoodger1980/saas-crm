import { type PlatformInfo } from '@prisma/get-platform';
type HandleLibraryLoadingErrorsInput = {
    e: Error;
    platformInfo: PlatformInfo;
    id: string;
};
export declare function handleLibraryLoadingErrors(args: HandleLibraryLoadingErrorsInput): string;
export {};
