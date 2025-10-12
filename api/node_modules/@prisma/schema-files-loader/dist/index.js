"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CompositeFilesResolver: () => CompositeFilesResolver,
  InMemoryFilesResolver: () => InMemoryFilesResolver,
  ensureType: () => ensureType,
  loadRelatedSchemaFiles: () => loadRelatedSchemaFiles,
  loadSchemaFiles: () => loadSchemaFiles,
  realFsResolver: () => realFsResolver
});
module.exports = __toCommonJS(index_exports);

// src/loadRelatedSchemaFiles.ts
var import_node_path2 = __toESM(require("node:path"));

// src/loadSchemaFiles.ts
var import_node_path = __toESM(require("node:path"));

// src/resolver/caseSensitivity.ts
function createFileNameToKeyMapper(options) {
  if (options.caseSensitive) {
    return (fileName) => fileName;
  }
  return (fileName) => fileName.toLocaleLowerCase();
}

// src/resolver/CompositeFilesResolver.ts
var CompositeFilesResolver = class {
  constructor(primary, secondary, options) {
    this.primary = primary;
    this.secondary = secondary;
    this._fileNameToKey = createFileNameToKeyMapper(options);
  }
  _fileNameToKey;
  async listDirContents(path3) {
    const primaryContent = await this.primary.listDirContents(path3);
    const secondaryContent = await this.secondary.listDirContents(path3);
    return uniqueWith([...primaryContent, ...secondaryContent], this._fileNameToKey);
  }
  async getEntryType(path3) {
    return await this.primary.getEntryType(path3) ?? await this.secondary.getEntryType(path3);
  }
  async getFileContents(path3) {
    return await this.primary.getFileContents(path3) ?? await this.secondary.getFileContents(path3);
  }
};
function uniqueWith(fileNames, toKey) {
  const map = /* @__PURE__ */ new Map();
  for (const fileName of fileNames) {
    const key = toKey(fileName);
    if (!map.has(key)) {
      map.set(key, fileName);
    }
  }
  return Array.from(map.values());
}

// src/resolver/InMemoryFilesResolver.ts
var InMemoryFilesResolver = class {
  _tree = {};
  _fileNameToKey;
  constructor(options) {
    this._fileNameToKey = createFileNameToKeyMapper(options);
  }
  addFile(absolutePath, content) {
    const dirs = absolutePath.split(/[\\/]/);
    const fileName = dirs.pop();
    if (!fileName) {
      throw new Error(`Path is empty`);
    }
    let currentDirRecord = this._tree;
    for (const dir of dirs) {
      const key = this._fileNameToKey(dir);
      let nextDirNode = currentDirRecord[key];
      if (!nextDirNode) {
        nextDirNode = {
          canonicalName: dir,
          content: {}
        };
        currentDirRecord[key] = nextDirNode;
      }
      if (typeof nextDirNode.content === "string") {
        throw new Error(`${dir} is a file`);
      }
      currentDirRecord = nextDirNode.content;
    }
    if (typeof currentDirRecord[fileName]?.content === "object") {
      throw new Error(`${absolutePath} is a directory`);
    }
    currentDirRecord[this._fileNameToKey(fileName)] = {
      canonicalName: fileName,
      content
    };
  }
  getInMemoryContent(absolutePath) {
    const keys = absolutePath.split(/[\\/]/).map((fileName) => this._fileNameToKey(fileName));
    let currentRecord = this._tree;
    for (const key of keys) {
      if (typeof currentRecord !== "object") {
        return void 0;
      }
      currentRecord = currentRecord[key]?.content;
    }
    return currentRecord;
  }
  listDirContents(filePath) {
    return Promise.resolve().then(() => {
      const dirContent = this.getInMemoryContent(filePath);
      if (typeof dirContent !== "object") {
        return [];
      }
      return Object.values(dirContent).map((node) => node.canonicalName);
    });
  }
  getEntryType(filePath) {
    return Promise.resolve().then(() => {
      const entry = this.getInMemoryContent(filePath);
      if (typeof entry === "string") {
        return { kind: "file" };
      }
      if (typeof entry === "object") {
        return { kind: "directory" };
      }
      return void 0;
    });
  }
  getFileContents(filePath) {
    return Promise.resolve().then(() => {
      const entry = this.getInMemoryContent(filePath);
      if (typeof entry === "undefined") {
        return void 0;
      }
      if (typeof entry === "object") {
        throw new Error(`${filePath} is directory`);
      }
      return entry;
    });
  }
};

// src/resolver/realFsResolver.ts
var import_fs_extra = __toESM(require("fs-extra"));
var realFsResolver = {
  listDirContents(path3) {
    return import_fs_extra.default.readdir(path3);
  },
  async getEntryType(path3) {
    const stat = await import_fs_extra.default.lstat(path3);
    if (stat.isFile()) {
      return { kind: "file" };
    }
    if (stat.isDirectory()) {
      return { kind: "directory" };
    }
    if (stat.isSymbolicLink()) {
      return { kind: "symlink", realPath: await import_fs_extra.default.realpath(path3) };
    }
    return { kind: "other" };
  },
  getFileContents(path3) {
    return import_fs_extra.default.readFile(path3, "utf8");
  }
};

// src/loadSchemaFiles.ts
async function loadSchemaFiles(folderPath, filesResolver = realFsResolver) {
  const type = await filesResolver.getEntryType(folderPath);
  return processEntry(folderPath, type, filesResolver);
}
async function processEntry(entryPath, entryType, filesResolver) {
  if (!entryType) {
    return [];
  }
  if (entryType.kind === "symlink") {
    const realPath = entryType.realPath;
    const realType = await filesResolver.getEntryType(realPath);
    return processEntry(realPath, realType, filesResolver);
  }
  if (entryType.kind === "file") {
    if (import_node_path.default.extname(entryPath) !== ".prisma") {
      return [];
    }
    const content = await filesResolver.getFileContents(entryPath);
    if (typeof content === "undefined") {
      return [];
    }
    return [[entryPath, content]];
  }
  if (entryType.kind === "directory") {
    const dirEntries = await filesResolver.listDirContents(entryPath);
    const nested = await Promise.all(
      dirEntries.map(async (dirEntry) => {
        const fullPath = import_node_path.default.join(entryPath, dirEntry);
        const nestedEntryType = await filesResolver.getEntryType(fullPath);
        return processEntry(fullPath, nestedEntryType, filesResolver);
      })
    );
    return nested.flat();
  }
  return [];
}

// src/loadRelatedSchemaFiles.ts
async function loadRelatedSchemaFiles(filePath, filesResolver = realFsResolver) {
  const rootDir = await findSchemaRoot(filePath, filesResolver);
  if (!rootDir) {
    return singleFile(filePath, filesResolver);
  }
  return await loadSchemaFiles(rootDir, filesResolver);
}
async function singleFile(filePath, filesResolver) {
  const contents = await filesResolver.getFileContents(filePath);
  if (contents === void 0) {
    return [];
  }
  return [[filePath, contents]];
}
async function findSchemaRoot(filePath, filesResolver) {
  let dir = import_node_path2.default.dirname(filePath);
  while (dir !== filePath) {
    const parentDir = import_node_path2.default.dirname(dir);
    const contents = await filesResolver.listDirContents(parentDir);
    const prismaFiles = contents.filter((file) => import_node_path2.default.extname(file) === ".prisma");
    if (prismaFiles.length === 0) {
      return dir;
    }
    dir = parentDir;
  }
  return void 0;
}

// src/utils/ensureType.ts
var import_promises = __toESM(require("node:fs/promises"));
async function ensureType(entryPath, expectedType) {
  try {
    const pathStat = await import_promises.default.stat(entryPath);
    if (expectedType === "file" && pathStat.isFile()) {
      return void 0;
    }
    if (expectedType === "directory" && pathStat.isDirectory()) {
      return void 0;
    }
    return { kind: "WrongType", path: entryPath, expectedTypes: [expectedType] };
  } catch (e) {
    if (e.code === "ENOENT") {
      return { kind: "NotFound", path: entryPath, expectedType };
    }
    throw e;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CompositeFilesResolver,
  InMemoryFilesResolver,
  ensureType,
  loadRelatedSchemaFiles,
  loadSchemaFiles,
  realFsResolver
});
