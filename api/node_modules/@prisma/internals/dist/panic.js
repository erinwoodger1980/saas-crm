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
var panic_exports = {};
__export(panic_exports, {
  ErrorArea: () => import_chunk_LMVSIVKQ.ErrorArea,
  RustPanic: () => import_chunk_LMVSIVKQ.RustPanic,
  getWasmError: () => import_chunk_LMVSIVKQ.getWasmError,
  isRustPanic: () => import_chunk_LMVSIVKQ.isRustPanic,
  isWasmPanic: () => import_chunk_LMVSIVKQ.isWasmPanic
});
module.exports = __toCommonJS(panic_exports);
var import_chunk_LMVSIVKQ = require("./chunk-LMVSIVKQ.js");
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
