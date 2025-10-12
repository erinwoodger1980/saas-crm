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
var chunk_D4VZUY3O_exports = {};
__export(chunk_D4VZUY3O_exports, {
  arg: () => arg,
  format: () => format,
  isError: () => isError
});
module.exports = __toCommonJS(chunk_D4VZUY3O_exports);
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
var import_arg = __toESM(require("arg"));
var require_min_indent = (0, import_chunk_4VNS5WPM.__commonJS)({
  "../../node_modules/.pnpm/min-indent@1.0.1/node_modules/min-indent/index.js"(exports, module2) {
    "use strict";
    module2.exports = (string) => {
      const match = string.match(/^[ \t]*(?=\S)/gm);
      if (!match) {
        return 0;
      }
      return match.reduce((r, a) => Math.min(r, a.length), Infinity);
    };
  }
});
var import_min_indent = (0, import_chunk_4VNS5WPM.__toESM)(require_min_indent(), 1);
function stripIndent(string) {
  const indent = (0, import_min_indent.default)(string);
  if (indent === 0) {
    return string;
  }
  const regex = new RegExp(`^[ \\t]{${indent}}`, "gm");
  return string.replace(regex, "");
}
function format(input = "") {
  return stripIndent(input).trimRight() + "\n";
}
function arg(argv, spec, stopAtPositional = true, permissive = false) {
  try {
    return (0, import_arg.default)(spec, { argv, stopAtPositional, permissive });
  } catch (e) {
    return e;
  }
}
function isError(result) {
  return result instanceof Error;
}
