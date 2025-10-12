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
var chunk_6JE6QGSJ_exports = {};
__export(chunk_6JE6QGSJ_exports, {
  HelpError: () => HelpError,
  unknownCommand: () => unknownCommand
});
module.exports = __toCommonJS(chunk_6JE6QGSJ_exports);
var import_chunk_PG5FDKSF = require("./chunk-PG5FDKSF.js");
function unknownCommand(helpTemplate, cmd) {
  return new HelpError(`
${(0, import_chunk_PG5FDKSF.bold)((0, import_chunk_PG5FDKSF.red)(`!`))} Unknown command "${cmd}"
${helpTemplate}`);
}
var HelpError = class _HelpError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "HelpError";
    Object.setPrototypeOf(this, _HelpError.prototype);
  }
};
