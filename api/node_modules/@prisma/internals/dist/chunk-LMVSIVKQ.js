"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var chunk_LMVSIVKQ_exports = {};
__export(chunk_LMVSIVKQ_exports, {
  ErrorArea: () => ErrorArea,
  RustPanic: () => RustPanic,
  getWasmError: () => getWasmError,
  isRustPanic: () => isRustPanic,
  isWasmPanic: () => isWasmPanic
});
module.exports = __toCommonJS(chunk_LMVSIVKQ_exports);
var RustPanic = class extends Error {
  __typename = "RustPanic";
  request;
  rustStack;
  area;
  introspectionUrl;
  constructor(message, rustStack, request, area, introspectionUrl) {
    super(message);
    this.name = "RustPanic";
    this.rustStack = rustStack;
    this.request = request;
    this.area = area;
    this.introspectionUrl = introspectionUrl;
  }
};
function isRustPanic(e) {
  return e.__typename === "RustPanic";
}
var ErrorArea = /* @__PURE__ */ ((ErrorArea2) => {
  ErrorArea2["LIFT_CLI"] = "LIFT_CLI";
  ErrorArea2["PHOTON_STUDIO"] = "PHOTON_STUDIO";
  ErrorArea2["INTROSPECTION_CLI"] = "INTROSPECTION_CLI";
  ErrorArea2["FMT_CLI"] = "FMT_CLI";
  ErrorArea2["QUERY_ENGINE_BINARY_CLI"] = "QUERY_ENGINE_BINARY_CLI";
  ErrorArea2["QUERY_ENGINE_LIBRARY_CLI"] = "QUERY_ENGINE_LIBRARY_CLI";
  return ErrorArea2;
})(ErrorArea || {});
function isWasmPanic(error) {
  return error.name === "RuntimeError";
}
function getWasmError(error) {
  const message = globalThis.PRISMA_WASM_PANIC_REGISTRY.get();
  const stack = [message, ...(error.stack || "NO_BACKTRACE").split("\n").slice(1)].join("\n");
  return { message, stack };
}
