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
var chunk_NIWBAJZV_exports = {};
__export(chunk_NIWBAJZV_exports, {
  callOnceOnSuccess: () => callOnceOnSuccess
});
module.exports = __toCommonJS(chunk_NIWBAJZV_exports);
function callOnceOnSuccess(fn) {
  let result;
  return (...args) => {
    if (result) {
      return result;
    }
    result = fn(...args).catch((err) => {
      result = void 0;
      throw err;
    });
    return result;
  };
}
