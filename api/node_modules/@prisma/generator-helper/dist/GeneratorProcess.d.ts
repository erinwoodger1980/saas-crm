import type { GeneratorConfig, GeneratorManifest, GeneratorOptions } from '@prisma/generator';
type GeneratorProcessOptions = {
    isNode?: boolean;
};
export declare class GeneratorError extends Error {
    code?: number | undefined;
    data?: any;
    name: string;
    constructor(message: string, code?: number | undefined, data?: any);
}
export declare class GeneratorProcess {
    private pathOrCommand;
    private child?;
    private handlers;
    private initPromise?;
    private isNode;
    private errorLogs;
    private pendingError;
    private exited;
    constructor(pathOrCommand: string, { isNode }?: GeneratorProcessOptions);
    init(): Promise<void>;
    initSingleton(): Promise<void>;
    private rejectAllHandlers;
    private handleResponse;
    private sendMessage;
    private getMessageId;
    stop(): void;
    private rpcMethod;
    getManifest: (arg: GeneratorConfig) => Promise<GeneratorManifest | null>;
    generate: (arg: GeneratorOptions) => Promise<void>;
}
export {};
