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
var chunk_LRU47BGE_exports = {};
__export(chunk_LRU47BGE_exports, {
  GeneratorConfigClass: () => GeneratorConfigClass,
  getOriginalBinaryTargetsValue: () => getOriginalBinaryTargetsValue,
  printDatamodelObject: () => printDatamodelObject,
  printGeneratorConfig: () => printGeneratorConfig
});
module.exports = __toCommonJS(chunk_LRU47BGE_exports);
var import_chunk_KDP6C3CB = require("./chunk-KDP6C3CB.js");
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
var import_indent_string = (0, import_chunk_4VNS5WPM.__toESM)((0, import_chunk_KDP6C3CB.require_indent_string)());
function printGeneratorConfig(config) {
  return String(new GeneratorConfigClass(config));
}
var GeneratorConfigClass = class {
  constructor(config) {
    this.config = config;
  }
  toString() {
    const { config } = this;
    const provider = config.provider.fromEnvVar ? `env("${config.provider.fromEnvVar}")` : config.provider.value;
    const obj = JSON.parse(
      JSON.stringify({
        provider,
        binaryTargets: getOriginalBinaryTargetsValue(config.binaryTargets)
      })
    );
    return `generator ${config.name} {
${(0, import_indent_string.default)(printDatamodelObject(obj), 2)}
}`;
  }
};
function getOriginalBinaryTargetsValue(binaryTargets) {
  let value;
  if (binaryTargets.length > 0) {
    const binaryTargetsFromEnvVar = binaryTargets.find((object) => object.fromEnvVar !== null);
    if (binaryTargetsFromEnvVar) {
      value = `env("${binaryTargetsFromEnvVar.fromEnvVar}")`;
    } else {
      value = binaryTargets.map((object) => object.native ? "native" : object.value);
    }
  } else {
    value = void 0;
  }
  return value;
}
function printDatamodelObject(obj) {
  const maxLength = Object.keys(obj).reduce((max, curr) => Math.max(max, curr.length), 0);
  return Object.entries(obj).map(([key, value]) => `${key.padEnd(maxLength)} = ${niceStringify(value)}`).join("\n");
}
function niceStringify(value) {
  return JSON.parse(
    JSON.stringify(value, (_, value2) => {
      if (Array.isArray(value2)) {
        return `[${value2.map((element) => JSON.stringify(element)).join(", ")}]`;
      }
      return JSON.stringify(value2);
    })
  );
}
