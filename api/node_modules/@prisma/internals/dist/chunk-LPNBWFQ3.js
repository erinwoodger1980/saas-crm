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
var chunk_LPNBWFQ3_exports = {};
__export(chunk_LPNBWFQ3_exports, {
  PRISMA_POSTGRES_PROTOCOL: () => PRISMA_POSTGRES_PROTOCOL,
  PRISMA_POSTGRES_PROVIDER: () => PRISMA_POSTGRES_PROVIDER,
  isPrismaPostgres: () => isPrismaPostgres,
  isPrismaPostgresDev: () => isPrismaPostgresDev
});
module.exports = __toCommonJS(chunk_LPNBWFQ3_exports);
var PRISMA_POSTGRES_PROVIDER = "prisma+postgres";
var PRISMA_POSTGRES_PROTOCOL = `${PRISMA_POSTGRES_PROVIDER}:`;
function isPrismaPostgres(connectionString) {
  return connectionString?.toString().startsWith(`${PRISMA_POSTGRES_PROTOCOL}//`) ?? false;
}
function isPrismaPostgresDev(connectionString) {
  if (!isPrismaPostgres(connectionString)) {
    return false;
  }
  const { host } = new URL(connectionString);
  return host.includes("localhost") || host.includes("127.0.0.1") || host.includes("[::1]");
}
