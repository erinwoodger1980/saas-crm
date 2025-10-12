import type { BinaryPaths, Generator as IGenerator, GeneratorConfig, GeneratorManifest, GeneratorOptions } from '@prisma/generator';
export declare abstract class Generator {
    manifest: GeneratorManifest | null;
    config: GeneratorConfig;
    options?: GeneratorOptions;
    constructor(config: GeneratorConfig);
    init(): Promise<void>;
    protected abstract initImpl(): Promise<void>;
    protected abstract getManifest(): Promise<GeneratorManifest | null>;
    abstract stop(): void;
    generate(): Promise<void>;
    protected abstract generateImpl(options: GeneratorOptions): Promise<void>;
    setOptions(options: GeneratorOptions): void;
    setBinaryPaths(binaryPaths: BinaryPaths): void;
    /**
     * Returns the pretty name of the generator specified in the manifest (e.g.,
     * "Prisma Client"), or, if the former is not defined, the generator's
     * provider name (e.g., "prisma-client-js") as a fallback.
     */
    getPrettyName(): string;
    /**
     * Returns the provider name, parsed and resolved from environment variable
     * if necessary.
     */
    getProvider(): string;
}
export declare class JsonRpcGenerator extends Generator {
    #private;
    constructor(executablePath: string, config: GeneratorConfig, isNode?: boolean);
    protected initImpl(): Promise<void>;
    protected getManifest(): Promise<GeneratorManifest | null>;
    protected generateImpl(options: GeneratorOptions): Promise<void>;
    stop(): void;
}
export declare class InProcessGenerator extends Generator {
    #private;
    constructor(config: GeneratorConfig, generator: IGenerator);
    protected initImpl(): Promise<void>;
    protected getManifest(): Promise<GeneratorManifest | null>;
    protected generateImpl(options: GeneratorOptions): Promise<void>;
    stop(): void;
}
