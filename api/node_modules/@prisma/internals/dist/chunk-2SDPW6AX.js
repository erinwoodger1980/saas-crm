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
var chunk_2SDPW6AX_exports = {};
__export(chunk_2SDPW6AX_exports, {
  parseAWSNodejsRuntimeEnvVarVersion: () => parseAWSNodejsRuntimeEnvVarVersion
});
module.exports = __toCommonJS(chunk_2SDPW6AX_exports);
function parseAWSNodejsRuntimeEnvVarVersion() {
  const runtimeEnvVar = process.env.AWS_LAMBDA_JS_RUNTIME;
  if (!runtimeEnvVar || runtimeEnvVar === "") return null;
  try {
    const runtimeRegex = /^nodejs(\d+).x$/;
    const match = runtimeRegex.exec(runtimeEnvVar);
    if (match) {
      return parseInt(match[1]);
    }
  } catch (e) {
    console.error(
      `We could not parse the AWS_LAMBDA_JS_RUNTIME env var with the following value: ${runtimeEnvVar}. This was silently ignored.`
    );
  }
  return null;
}
