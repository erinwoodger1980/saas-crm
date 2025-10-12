import type { BinaryPaths } from '@prisma/generator';
import type { BinaryTarget } from '@prisma/get-platform';
import type { GetBinaryPathsByVersionInput } from '../getGenerators';
export declare function getBinaryPathsByVersion({ neededVersions, detectBinaryTarget, version, printDownloadProgress, skipDownload, binaryPathsOverride, }: GetBinaryPathsByVersionInput): Promise<{
    binaryPathsByVersion: Record<string, BinaryPaths>;
    binaryTarget: BinaryTarget;
}>;
