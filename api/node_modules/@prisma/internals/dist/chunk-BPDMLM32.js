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
var chunk_BPDMLM32_exports = {};
__export(chunk_BPDMLM32_exports, {
  Generator: () => Generator,
  InProcessGenerator: () => InProcessGenerator,
  JsonRpcGenerator: () => JsonRpcGenerator
});
module.exports = __toCommonJS(chunk_BPDMLM32_exports);
var import_chunk_IOIAK7V7 = require("./chunk-IOIAK7V7.js");
var import_generator_helper = require("@prisma/generator-helper");
var Generator = class {
  manifest = null;
  config;
  options;
  constructor(config) {
    this.config = config;
  }
  async init() {
    await this.initImpl();
    this.manifest = await this.getManifest();
  }
  generate() {
    if (!this.options) {
      throw new Error(`Please first run .setOptions() on the Generator to initialize the options`);
    }
    return this.generateImpl(this.options);
  }
  setOptions(options) {
    this.options = options;
  }
  setBinaryPaths(binaryPaths) {
    if (!this.options) {
      throw new Error(`Please first run .setOptions() on the Generator to initialize the options`);
    }
    this.options.binaryPaths = binaryPaths;
  }
  /**
   * Returns the pretty name of the generator specified in the manifest (e.g.,
   * "Prisma Client"), or, if the former is not defined, the generator's
   * provider name (e.g., "prisma-client-js") as a fallback.
   */
  getPrettyName() {
    return this.manifest?.prettyName ?? this.getProvider();
  }
  /**
   * Returns the provider name, parsed and resolved from environment variable
   * if necessary.
   */
  getProvider() {
    return (0, import_chunk_IOIAK7V7.parseEnvValue)(this.config.provider);
  }
};
var JsonRpcGenerator = class extends Generator {
  #generatorProcess;
  constructor(executablePath, config, isNode) {
    super(config);
    this.#generatorProcess = new import_generator_helper.GeneratorProcess(executablePath, { isNode });
  }
  async initImpl() {
    await this.#generatorProcess.init();
  }
  async getManifest() {
    return await this.#generatorProcess.getManifest(this.config);
  }
  async generateImpl(options) {
    await this.#generatorProcess.generate(options);
  }
  stop() {
    this.#generatorProcess.stop();
  }
};
var InProcessGenerator = class extends Generator {
  #generator;
  constructor(config, generator) {
    super(config);
    this.#generator = generator;
  }
  async initImpl() {
  }
  async getManifest() {
    return await this.#generator.getManifest(this.config);
  }
  async generateImpl(options) {
    await this.#generator.generate(options);
  }
  stop() {
  }
};
