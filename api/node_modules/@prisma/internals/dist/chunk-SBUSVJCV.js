"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var chunk_SBUSVJCV_exports = {};
__export(chunk_SBUSVJCV_exports, {
  wasmSchemaEngineLoader: () => wasmSchemaEngineLoader
});
module.exports = __toCommonJS(chunk_SBUSVJCV_exports);
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = __toESM(require("node:path"));
async function getSchemaEngineWasModule() {
  const runtimeBase = import_node_path.default.join(__dirname, "..", "build");
  const schemaEngineWasmFilePath = import_node_path.default.join(runtimeBase, `schema_engine_bg.wasm`);
  const schemaEngineWasmFileBytes = await import_promises.default.readFile(schemaEngineWasmFilePath);
  return new WebAssembly.Module(schemaEngineWasmFileBytes);
}
async function getSchemaEngineWasmInstance() {
  const runtime = await import("@prisma/schema-engine-wasm/schema_engine_bg");
  const wasmModule = await getSchemaEngineWasModule();
  const instance = new WebAssembly.Instance(wasmModule, {
    // @ts-ignore
    "./schema_engine_bg.js": runtime
  });
  const wbindgen_start = instance.exports.__wbindgen_start;
  runtime.__wbg_set_wasm(instance.exports);
  wbindgen_start();
  return runtime.SchemaEngine;
}
var loadedWasmInstance;
var wasmSchemaEngineLoader = {
  async loadSchemaEngine(input, debug, adapter) {
    if (loadedWasmInstance === void 0) {
      loadedWasmInstance = await getSchemaEngineWasmInstance();
    }
    return await loadedWasmInstance.new(input, debug, adapter);
  }
};
