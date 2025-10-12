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
var chunk_TZJROXB3_exports = {};
__export(chunk_TZJROXB3_exports, {
  createDebugErrorType: () => createDebugErrorType,
  createSchemaValidationError: () => createSchemaValidationError,
  parseQueryEngineError: () => parseQueryEngineError,
  unlinkTempDatamodelPath: () => unlinkTempDatamodelPath
});
module.exports = __toCommonJS(chunk_TZJROXB3_exports);
var import_chunk_C47SCASR = require("./chunk-C47SCASR.js");
var import_chunk_R6QH57HZ = require("./chunk-R6QH57HZ.js");
var import_chunk_5DBOS77Y = require("./chunk-5DBOS77Y.js");
var import_chunk_XKZ6CBLA = require("./chunk-XKZ6CBLA.js");
var import_chunk_PG5FDKSF = require("./chunk-PG5FDKSF.js");
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
var import_fs = __toESM(require("fs"));
var import_function = (0, import_chunk_4VNS5WPM.__toESM)((0, import_chunk_R6QH57HZ.require_function)());
function unlinkTempDatamodelPath(options, tempDatamodelPath) {
  return (0, import_chunk_5DBOS77Y.tryCatch2)(
    () => {
      if (!options.datamodelPath && tempDatamodelPath) {
        return import_fs.default.promises.unlink(tempDatamodelPath);
      }
      return Promise.resolve(void 0);
    },
    (e) => ({
      type: "unlink-temp-datamodel-path",
      reason: "Unable to delete temporary datamodel path",
      error: e
    })
  );
}
var createDebugErrorType = (debug, fnName) => ({ type, reason, error }) => {
  debug(`error of type "${type}" in ${fnName}:
`, { reason, error });
};
function createSchemaValidationError(reason) {
  return `${(0, import_chunk_PG5FDKSF.red)((0, import_chunk_PG5FDKSF.bold)("Prisma schema validation"))} - ${reason}`;
}
function parseQueryEngineError({ errorOutput, reason }) {
  const actualError = (0, import_function.pipe)(
    (0, import_chunk_5DBOS77Y.tryCatch)(
      () => JSON.parse(errorOutput),
      () => ({ _tag: "unparsed", message: errorOutput, reason })
    ),
    (0, import_chunk_5DBOS77Y.map)((errorOutputAsJSON) => {
      const defaultMessage = (0, import_chunk_PG5FDKSF.red)((0, import_chunk_PG5FDKSF.bold)((0, import_chunk_C47SCASR.relativizePathInPSLError)(errorOutputAsJSON.message)));
      const getConfigErrorInit = (0, import_chunk_XKZ6CBLA.z)(errorOutputAsJSON).with({ error_code: "P1012" }, (eJSON) => {
        return {
          reason: createSchemaValidationError(reason),
          errorCode: eJSON.error_code
        };
      }).with({ error_code: import_chunk_XKZ6CBLA.N.string }, (eJSON) => {
        return {
          reason,
          errorCode: eJSON.error_code
        };
      }).otherwise(() => {
        return {
          reason
        };
      });
      return { _tag: "parsed", message: defaultMessage, ...getConfigErrorInit };
    }),
    (0, import_chunk_5DBOS77Y.getOrElseW)(import_function.identity)
  );
  return actualError;
}
