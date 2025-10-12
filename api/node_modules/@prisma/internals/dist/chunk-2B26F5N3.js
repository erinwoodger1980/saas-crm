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
var chunk_2B26F5N3_exports = {};
__export(chunk_2B26F5N3_exports, {
  resolveOutput: () => resolveOutput
});
module.exports = __toCommonJS(chunk_2B26F5N3_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_util = require("util");
var exists = (0, import_util.promisify)(import_fs.default.exists);
async function resolveNodeModulesBase(cwd) {
  if (await exists(import_path.default.resolve(process.cwd(), "prisma/schema.prisma"))) {
    return process.cwd();
  }
  if (import_path.default.relative(process.cwd(), cwd) === "prisma" && await exists(import_path.default.resolve(process.cwd(), "package.json"))) {
    return process.cwd();
  }
  if (await exists(import_path.default.resolve(cwd, "node_modules"))) {
    return cwd;
  }
  if (await exists(import_path.default.resolve(cwd, "../node_modules"))) {
    return import_path.default.join(cwd, "../");
  }
  if (await exists(import_path.default.resolve(cwd, "package.json"))) {
    return cwd;
  }
  if (await exists(import_path.default.resolve(cwd, "../package.json"))) {
    return import_path.default.join(cwd, "../");
  }
  return cwd;
}
async function resolveOutput(options) {
  const defaultOutput = stripRelativePath(options.defaultOutput);
  if (defaultOutput.startsWith("node_modules")) {
    const nodeModulesBase = await resolveNodeModulesBase(options.baseDir);
    return import_path.default.resolve(nodeModulesBase, defaultOutput);
  }
  return import_path.default.resolve(options.baseDir, defaultOutput);
}
function stripRelativePath(pathString) {
  if (pathString.startsWith("./")) {
    return pathString.slice(2);
  }
  return pathString;
}
