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
var prismaPostgres_exports = {};
__export(prismaPostgres_exports, {
  PRISMA_POSTGRES_PROTOCOL: () => import_chunk_LPNBWFQ3.PRISMA_POSTGRES_PROTOCOL,
  PRISMA_POSTGRES_PROVIDER: () => import_chunk_LPNBWFQ3.PRISMA_POSTGRES_PROVIDER,
  isPrismaPostgres: () => import_chunk_LPNBWFQ3.isPrismaPostgres,
  isPrismaPostgresDev: () => import_chunk_LPNBWFQ3.isPrismaPostgresDev
});
module.exports = __toCommonJS(prismaPostgres_exports);
var import_chunk_LPNBWFQ3 = require("../chunk-LPNBWFQ3.js");
var import_chunk_4VNS5WPM = require("../chunk-4VNS5WPM.js");
