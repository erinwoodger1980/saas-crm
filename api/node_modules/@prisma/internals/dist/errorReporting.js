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
var errorReporting_exports = {};
__export(errorReporting_exports, {
  ErrorKind: () => import_chunk_5AI4FIZ3.ErrorKind,
  createErrorReport: () => import_chunk_5AI4FIZ3.createErrorReport,
  makeErrorReportCompleted: () => import_chunk_5AI4FIZ3.makeErrorReportCompleted,
  uploadZip: () => import_chunk_5AI4FIZ3.uploadZip
});
module.exports = __toCommonJS(errorReporting_exports);
var import_chunk_5AI4FIZ3 = require("./chunk-5AI4FIZ3.js");
var import_chunk_NVNI2SRU = require("./chunk-NVNI2SRU.js");
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
