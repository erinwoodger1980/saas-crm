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
var chunk_5VQNKCKW_exports = {};
__export(chunk_5VQNKCKW_exports, {
  require_temp_dir: () => require_temp_dir
});
module.exports = __toCommonJS(chunk_5VQNKCKW_exports);
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
var require_temp_dir = (0, import_chunk_4VNS5WPM.__commonJS)({
  "../../node_modules/.pnpm/temp-dir@2.0.0/node_modules/temp-dir/index.js"(exports, module2) {
    "use strict";
    var fs = (0, import_chunk_4VNS5WPM.__require)("fs");
    var os = (0, import_chunk_4VNS5WPM.__require)("os");
    var tempDirectorySymbol = Symbol.for("__RESOLVED_TEMP_DIRECTORY__");
    if (!global[tempDirectorySymbol]) {
      Object.defineProperty(global, tempDirectorySymbol, {
        value: fs.realpathSync(os.tmpdir())
      });
    }
    module2.exports = global[tempDirectorySymbol];
  }
});
