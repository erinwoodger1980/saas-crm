export declare class RustPanic extends Error {
    readonly __typename = "RustPanic";
    request: any;
    rustStack: string;
    area: ErrorArea;
    introspectionUrl?: string;
    constructor(message: string, rustStack: string, request: any, area: ErrorArea, introspectionUrl?: string);
}
export declare function isRustPanic(e: Error): e is RustPanic;
export declare enum ErrorArea {
    LIFT_CLI = "LIFT_CLI",
    PHOTON_STUDIO = "PHOTON_STUDIO",
    INTROSPECTION_CLI = "INTROSPECTION_CLI",
    FMT_CLI = "FMT_CLI",
    QUERY_ENGINE_BINARY_CLI = "QUERY_ENGINE_BINARY_CLI",
    QUERY_ENGINE_LIBRARY_CLI = "QUERY_ENGINE_LIBRARY_CLI"
}
/**
 * Branded type for Wasm panics.
 */
export type WasmPanic = Error & {
    name: 'RuntimeError';
};
/**
 * Returns true if the given error is a Wasm panic.
 */
export declare function isWasmPanic(error: Error): error is WasmPanic;
export declare function getWasmError(error: WasmPanic): {
    message: string;
    stack: string;
};
