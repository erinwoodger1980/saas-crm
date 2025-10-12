import type { ErrorCapturingSqlDriverAdapterFactory } from '@prisma/driver-adapter-utils';
import type { ConstructorOptions, SchemaEngine } from '@prisma/schema-engine-wasm';
export declare const wasmSchemaEngineLoader: {
    loadSchemaEngine(input: ConstructorOptions, debug: (arg: string) => void, adapter: ErrorCapturingSqlDriverAdapterFactory): Promise<SchemaEngine>;
};
