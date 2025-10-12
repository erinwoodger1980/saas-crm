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
var chunk_WXRVYSYN_exports = {};
__export(chunk_WXRVYSYN_exports, {
  WasmPanicRegistry: () => WasmPanicRegistry
});
module.exports = __toCommonJS(chunk_WXRVYSYN_exports);
var WasmPanicRegistry = class {
  message = "";
  get() {
    return `${this.message}`;
  }
  // Don't use this method directly, it's only used by the Wasm panic hook in @prisma/prisma-schema-wasm.
  set_message(value) {
    this.message = `RuntimeError: ${value}`;
  }
};
