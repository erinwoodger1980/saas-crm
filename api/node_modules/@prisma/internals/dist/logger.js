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
var logger_exports = {};
__export(logger_exports, {
  error: () => import_chunk_ZJWZK45Z.error,
  info: () => import_chunk_ZJWZK45Z.info,
  log: () => import_chunk_ZJWZK45Z.log,
  query: () => import_chunk_ZJWZK45Z.query,
  should: () => import_chunk_ZJWZK45Z.should,
  tags: () => import_chunk_ZJWZK45Z.tags,
  warn: () => import_chunk_ZJWZK45Z.warn
});
module.exports = __toCommonJS(logger_exports);
var import_chunk_ZJWZK45Z = require("./chunk-ZJWZK45Z.js");
var import_chunk_PG5FDKSF = require("./chunk-PG5FDKSF.js");
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
