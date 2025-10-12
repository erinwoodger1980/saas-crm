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
var chunk_ZJWZK45Z_exports = {};
__export(chunk_ZJWZK45Z_exports, {
  error: () => error,
  info: () => info,
  log: () => log,
  logger_exports: () => logger_exports,
  query: () => query,
  should: () => should,
  tags: () => tags,
  warn: () => warn
});
module.exports = __toCommonJS(chunk_ZJWZK45Z_exports);
var import_chunk_PG5FDKSF = require("./chunk-PG5FDKSF.js");
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
var logger_exports = {};
(0, import_chunk_4VNS5WPM.__export)(logger_exports, {
  error: () => error,
  info: () => info,
  log: () => log,
  query: () => query,
  should: () => should,
  tags: () => tags,
  warn: () => warn
});
var tags = {
  error: (0, import_chunk_PG5FDKSF.red)("prisma:error"),
  warn: (0, import_chunk_PG5FDKSF.yellow)("prisma:warn"),
  info: (0, import_chunk_PG5FDKSF.cyan)("prisma:info"),
  query: (0, import_chunk_PG5FDKSF.blue)("prisma:query")
};
var should = {
  warn: () => !process.env.PRISMA_DISABLE_WARNINGS
};
function log(...data) {
  console.log(...data);
}
function warn(message, ...optionalParams) {
  if (should.warn()) {
    console.warn(`${tags.warn} ${message}`, ...optionalParams);
  }
}
function info(message, ...optionalParams) {
  console.info(`${tags.info} ${message}`, ...optionalParams);
}
function error(message, ...optionalParams) {
  console.error(`${tags.error} ${message}`, ...optionalParams);
}
function query(message, ...optionalParams) {
  console.log(`${tags.query} ${message}`, ...optionalParams);
}
