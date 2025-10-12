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
var chunk_X77CS5RK_exports = {};
__export(chunk_X77CS5RK_exports, {
  fixBinaryTargets: () => fixBinaryTargets
});
module.exports = __toCommonJS(chunk_X77CS5RK_exports);
function transformBinaryTargetToEnvValue(binaryTarget) {
  return { fromEnvVar: null, value: binaryTarget };
}
function fixBinaryTargets(schemaBinaryTargets, runtimeBinaryTarget) {
  schemaBinaryTargets = schemaBinaryTargets || [];
  if (!schemaBinaryTargets.find((object) => object.native === true)) {
    return [transformBinaryTargetToEnvValue("native"), ...schemaBinaryTargets];
  }
  return [...schemaBinaryTargets, transformBinaryTargetToEnvValue(runtimeBinaryTarget)];
}
