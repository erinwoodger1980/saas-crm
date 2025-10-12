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
var chunk_CUD726EK_exports = {};
__export(chunk_CUD726EK_exports, {
  getCommandWithExecutor: () => getCommandWithExecutor
});
module.exports = __toCommonJS(chunk_CUD726EK_exports);
var import_chunk_BERN76ZI = require("./chunk-BERN76ZI.js");
function getCommandWithExecutor(command) {
  if ((0, import_chunk_BERN76ZI.isCurrentBinInstalledGlobally)()) {
    return command;
  } else {
    const npxUsed = __dirname.includes("_npx");
    if (npxUsed) {
      return `npx ${command}`;
    } else {
      return command;
    }
  }
}
