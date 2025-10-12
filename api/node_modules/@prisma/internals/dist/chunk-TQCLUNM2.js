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
var chunk_TQCLUNM2_exports = {};
__export(chunk_TQCLUNM2_exports, {
  highlightDatamodel: () => highlightDatamodel,
  highlightSql: () => highlightSql,
  highlightTS: () => highlightTS
});
module.exports = __toCommonJS(chunk_TQCLUNM2_exports);
var import_chunk_OIVPX3BR = require("./chunk-OIVPX3BR.js");
var import_chunk_CYAS6B5N = require("./chunk-CYAS6B5N.js");
var import_chunk_HPVMQFIY = require("./chunk-HPVMQFIY.js");
function highlightDatamodel(str) {
  return highlight(str, import_chunk_OIVPX3BR.dml);
}
function highlightSql(str) {
  return highlight(str, import_chunk_CYAS6B5N.sql);
}
function highlightTS(str) {
  return highlight(str, import_chunk_HPVMQFIY.Prism.languages.javascript);
}
function highlight(str, grammar) {
  const tokens = import_chunk_HPVMQFIY.Prism.tokenize(str, grammar);
  return tokens.map((t) => import_chunk_HPVMQFIY.Token.stringify(t)).join("");
}
