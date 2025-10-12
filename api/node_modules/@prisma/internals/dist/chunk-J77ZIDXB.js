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
var chunk_J77ZIDXB_exports = {};
__export(chunk_J77ZIDXB_exports, {
  longestCommonPathPrefix: () => longestCommonPathPrefix,
  pathToPosix: () => pathToPosix
});
module.exports = __toCommonJS(chunk_J77ZIDXB_exports);
var import_path = __toESM(require("path"));
function pathToPosix(filePath) {
  if (import_path.default.sep === import_path.default.posix.sep) {
    return filePath;
  }
  return filePath.split(import_path.default.sep).join(import_path.default.posix.sep);
}
function longestCommonPathPrefix(pathA, pathB) {
  if (!import_path.default.isAbsolute(pathA) || !import_path.default.isAbsolute(pathB)) {
    throw new Error("longestCommonPathPrefix expects absolute paths");
  }
  if (process.platform === "win32" && (pathA.startsWith("\\\\") || pathB.startsWith("\\\\"))) {
    pathA = import_path.default.toNamespacedPath(pathA);
    pathB = import_path.default.toNamespacedPath(pathB);
  }
  const commonPrefix = longestCommonPrefix(pathA.split(import_path.default.sep), pathB.split(import_path.default.sep)).join(import_path.default.sep);
  if (commonPrefix === "") {
    return process.platform === "win32" ? void 0 : "/";
  }
  if (process.platform === "win32" && ["\\", "\\\\?", "\\\\."].includes(commonPrefix)) {
    return void 0;
  }
  if (process.platform === "win32" && commonPrefix.endsWith(":")) {
    return commonPrefix + "\\";
  }
  return commonPrefix;
}
function longestCommonPrefix(sequenceA, sequenceB) {
  const maxLen = Math.min(sequenceA.length, sequenceB.length);
  let sliceLen = 0;
  while (sliceLen <= maxLen && sequenceA[sliceLen] === sequenceB[sliceLen]) {
    sliceLen++;
  }
  return sequenceA.slice(0, sliceLen);
}
