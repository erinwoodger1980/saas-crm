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
var chunk_IOIAK7V7_exports = {};
__export(chunk_IOIAK7V7_exports, {
  parseBinaryTargetsEnvValue: () => parseBinaryTargetsEnvValue,
  parseEnvValue: () => parseEnvValue
});
module.exports = __toCommonJS(chunk_IOIAK7V7_exports);
var import_chunk_PG5FDKSF = require("./chunk-PG5FDKSF.js");
function parseEnvValue(object) {
  if (object.fromEnvVar && object.fromEnvVar != "null") {
    const value = process.env[object.fromEnvVar];
    if (!value) {
      throw new Error(
        `Attempted to load provider value using \`env(${object.fromEnvVar})\` but it was not present. Please ensure that ${(0, import_chunk_PG5FDKSF.dim)(
          object.fromEnvVar
        )} is present in your Environment Variables`
      );
    }
    return value;
  }
  return object.value;
}
function parseBinaryTargetsEnvValue(object) {
  if (object.fromEnvVar && object.fromEnvVar != "null") {
    const value = process.env[object.fromEnvVar];
    if (!value) {
      throw new Error(
        `Attempted to load binaryTargets value using \`env(${object.fromEnvVar})\` but it was not present. Please ensure that ${(0, import_chunk_PG5FDKSF.dim)(
          object.fromEnvVar
        )} is present in your Environment Variables`
      );
    }
    return JSON.parse(value);
  }
  return object.value;
}
