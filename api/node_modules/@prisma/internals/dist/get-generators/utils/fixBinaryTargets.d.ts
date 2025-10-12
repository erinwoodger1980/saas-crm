import { BinaryTargetsEnvValue } from '@prisma/generator';
import { BinaryTarget } from '@prisma/get-platform';
export declare function fixBinaryTargets(schemaBinaryTargets: BinaryTargetsEnvValue[], runtimeBinaryTarget: BinaryTarget | string): BinaryTargetsEnvValue[];
