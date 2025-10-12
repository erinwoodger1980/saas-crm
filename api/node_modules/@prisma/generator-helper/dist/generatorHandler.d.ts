import type { GeneratorConfig, GeneratorManifest, GeneratorOptions } from '@prisma/generator';
export interface Handler {
    onGenerate(options: GeneratorOptions): Promise<any>;
    onManifest?(config: GeneratorConfig): GeneratorManifest | Promise<GeneratorManifest>;
}
export declare function generatorHandler(handler: Handler): void;
