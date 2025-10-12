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
var chunk_LRBXMV4B_exports = {};
__export(chunk_LRBXMV4B_exports, {
  maybeInGitHook: () => maybeInGitHook
});
module.exports = __toCommonJS(chunk_LRBXMV4B_exports);
function maybeInGitHook() {
  return process.env.GIT_EXEC_PATH !== void 0 || process.env.GIT_DIR !== void 0 || process.env.GIT_INDEX_FILE !== void 0 || process.env.GIT_PREFIX !== void 0;
}
