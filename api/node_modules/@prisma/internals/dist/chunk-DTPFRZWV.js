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
var chunk_DTPFRZWV_exports = {};
__export(chunk_DTPFRZWV_exports, {
  warnOnce: () => warnOnce
});
module.exports = __toCommonJS(chunk_DTPFRZWV_exports);
var import_chunk_ZJWZK45Z = require("./chunk-ZJWZK45Z.js");
var alreadyWarned = /* @__PURE__ */ new Set();
var warnOnce = (key, message, ...args) => {
  if (!alreadyWarned.has(key)) {
    alreadyWarned.add(key);
    (0, import_chunk_ZJWZK45Z.warn)(message, ...args);
  }
};
