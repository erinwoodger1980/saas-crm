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
var chunk_CGFNDGGI_exports = {};
__export(chunk_CGFNDGGI_exports, {
  maxBy: () => maxBy,
  maxWithComparator: () => maxWithComparator
});
module.exports = __toCommonJS(chunk_CGFNDGGI_exports);
function maxWithComparator(items, comparator) {
  if (items.length === 0) {
    return void 0;
  }
  let result = items[0];
  for (let i = 1; i < items.length; i++) {
    const compareValue = comparator(result, items[i]);
    if (compareValue < 0) {
      result = items[i];
    }
  }
  return result;
}
function maxBy(items, callback) {
  return maxWithComparator(items, (a, b) => callback(a) - callback(b));
}
