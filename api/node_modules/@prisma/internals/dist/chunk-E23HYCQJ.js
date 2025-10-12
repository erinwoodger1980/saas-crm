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
var chunk_E23HYCQJ_exports = {};
__export(chunk_E23HYCQJ_exports, {
  theme: () => theme
});
module.exports = __toCommonJS(chunk_E23HYCQJ_exports);
var import_chunk_PG5FDKSF = require("./chunk-PG5FDKSF.js");
var theme = {
  keyword: import_chunk_PG5FDKSF.cyan,
  entity: import_chunk_PG5FDKSF.cyan,
  value: (s) => (0, import_chunk_PG5FDKSF.bold)((0, import_chunk_PG5FDKSF.blue)(s)),
  punctuation: import_chunk_PG5FDKSF.blue,
  directive: import_chunk_PG5FDKSF.cyan,
  function: import_chunk_PG5FDKSF.cyan,
  variable: (s) => (0, import_chunk_PG5FDKSF.bold)((0, import_chunk_PG5FDKSF.blue)(s)),
  string: (s) => (0, import_chunk_PG5FDKSF.bold)((0, import_chunk_PG5FDKSF.green)(s)),
  boolean: import_chunk_PG5FDKSF.yellow,
  number: import_chunk_PG5FDKSF.cyan,
  comment: import_chunk_PG5FDKSF.gray
};
