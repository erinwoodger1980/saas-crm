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
var chunk_BERN76ZI_exports = {};
__export(chunk_BERN76ZI_exports, {
  isCurrentBinInstalledGlobally: () => isCurrentBinInstalledGlobally
});
module.exports = __toCommonJS(chunk_BERN76ZI_exports);
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
var import_fs = __toESM(require("fs"));
var import_node_process = __toESM(require("node:process"));
var import_node_path = __toESM(require("node:path"));
var import_node_os = __toESM(require("node:os"));
var import_node_fs = __toESM(require("node:fs"));
var require_ini = (0, import_chunk_4VNS5WPM.__commonJS)({
  "../../node_modules/.pnpm/ini@4.1.1/node_modules/ini/lib/ini.js"(exports, module2) {
    "use strict";
    var { hasOwnProperty } = Object.prototype;
    var encode = (obj, opt = {}) => {
      if (typeof opt === "string") {
        opt = { section: opt };
      }
      opt.align = opt.align === true;
      opt.newline = opt.newline === true;
      opt.sort = opt.sort === true;
      opt.whitespace = opt.whitespace === true || opt.align === true;
      opt.platform = opt.platform || typeof process !== "undefined" && process.platform;
      opt.bracketedArray = opt.bracketedArray !== false;
      const eol = opt.platform === "win32" ? "\r\n" : "\n";
      const separator = opt.whitespace ? " = " : "=";
      const children = [];
      const keys = opt.sort ? Object.keys(obj).sort() : Object.keys(obj);
      let padToChars = 0;
      if (opt.align) {
        padToChars = safe(
          keys.filter((k) => obj[k] === null || Array.isArray(obj[k]) || typeof obj[k] !== "object").map((k) => Array.isArray(obj[k]) ? `${k}[]` : k).concat([""]).reduce((a, b) => safe(a).length >= safe(b).length ? a : b)
        ).length;
      }
      let out = "";
      const arraySuffix = opt.bracketedArray ? "[]" : "";
      for (const k of keys) {
        const val = obj[k];
        if (val && Array.isArray(val)) {
          for (const item of val) {
            out += safe(`${k}${arraySuffix}`).padEnd(padToChars, " ") + separator + safe(item) + eol;
          }
        } else if (val && typeof val === "object") {
          children.push(k);
        } else {
          out += safe(k).padEnd(padToChars, " ") + separator + safe(val) + eol;
        }
      }
      if (opt.section && out.length) {
        out = "[" + safe(opt.section) + "]" + (opt.newline ? eol + eol : eol) + out;
      }
      for (const k of children) {
        const nk = splitSections(k, ".").join("\\.");
        const section = (opt.section ? opt.section + "." : "") + nk;
        const child = encode(obj[k], {
          ...opt,
          section
        });
        if (out.length && child.length) {
          out += eol;
        }
        out += child;
      }
      return out;
    };
    function splitSections(str, separator) {
      var lastMatchIndex = 0;
      var lastSeparatorIndex = 0;
      var nextIndex = 0;
      var sections = [];
      do {
        nextIndex = str.indexOf(separator, lastMatchIndex);
        if (nextIndex !== -1) {
          lastMatchIndex = nextIndex + separator.length;
          if (nextIndex > 0 && str[nextIndex - 1] === "\\") {
            continue;
          }
          sections.push(str.slice(lastSeparatorIndex, nextIndex));
          lastSeparatorIndex = nextIndex + separator.length;
        }
      } while (nextIndex !== -1);
      sections.push(str.slice(lastSeparatorIndex));
      return sections;
    }
    var decode = (str, opt = {}) => {
      opt.bracketedArray = opt.bracketedArray !== false;
      const out = /* @__PURE__ */ Object.create(null);
      let p = out;
      let section = null;
      const re = /^\[([^\]]*)\]\s*$|^([^=]+)(=(.*))?$/i;
      const lines = str.split(/[\r\n]+/g);
      const duplicates = {};
      for (const line of lines) {
        if (!line || line.match(/^\s*[;#]/) || line.match(/^\s*$/)) {
          continue;
        }
        const match = line.match(re);
        if (!match) {
          continue;
        }
        if (match[1] !== void 0) {
          section = unsafe(match[1]);
          if (section === "__proto__") {
            p = /* @__PURE__ */ Object.create(null);
            continue;
          }
          p = out[section] = out[section] || /* @__PURE__ */ Object.create(null);
          continue;
        }
        const keyRaw = unsafe(match[2]);
        let isArray;
        if (opt.bracketedArray) {
          isArray = keyRaw.length > 2 && keyRaw.slice(-2) === "[]";
        } else {
          duplicates[keyRaw] = (duplicates?.[keyRaw] || 0) + 1;
          isArray = duplicates[keyRaw] > 1;
        }
        const key = isArray ? keyRaw.slice(0, -2) : keyRaw;
        if (key === "__proto__") {
          continue;
        }
        const valueRaw = match[3] ? unsafe(match[4]) : true;
        const value = valueRaw === "true" || valueRaw === "false" || valueRaw === "null" ? JSON.parse(valueRaw) : valueRaw;
        if (isArray) {
          if (!hasOwnProperty.call(p, key)) {
            p[key] = [];
          } else if (!Array.isArray(p[key])) {
            p[key] = [p[key]];
          }
        }
        if (Array.isArray(p[key])) {
          p[key].push(value);
        } else {
          p[key] = value;
        }
      }
      const remove = [];
      for (const k of Object.keys(out)) {
        if (!hasOwnProperty.call(out, k) || typeof out[k] !== "object" || Array.isArray(out[k])) {
          continue;
        }
        const parts = splitSections(k, ".");
        p = out;
        const l = parts.pop();
        const nl = l.replace(/\\\./g, ".");
        for (const part of parts) {
          if (part === "__proto__") {
            continue;
          }
          if (!hasOwnProperty.call(p, part) || typeof p[part] !== "object") {
            p[part] = /* @__PURE__ */ Object.create(null);
          }
          p = p[part];
        }
        if (p === out && nl === l) {
          continue;
        }
        p[nl] = out[k];
        remove.push(k);
      }
      for (const del of remove) {
        delete out[del];
      }
      return out;
    };
    var isQuoted = (val) => {
      return val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'");
    };
    var safe = (val) => {
      if (typeof val !== "string" || val.match(/[=\r\n]/) || val.match(/^\[/) || val.length > 1 && isQuoted(val) || val !== val.trim()) {
        return JSON.stringify(val);
      }
      return val.split(";").join("\\;").split("#").join("\\#");
    };
    var unsafe = (val, doUnesc) => {
      val = (val || "").trim();
      if (isQuoted(val)) {
        if (val.charAt(0) === "'") {
          val = val.slice(1, -1);
        }
        try {
          val = JSON.parse(val);
        } catch {
        }
      } else {
        let esc = false;
        let unesc = "";
        for (let i = 0, l = val.length; i < l; i++) {
          const c = val.charAt(i);
          if (esc) {
            if ("\\;#".indexOf(c) !== -1) {
              unesc += c;
            } else {
              unesc += "\\" + c;
            }
            esc = false;
          } else if (";#".indexOf(c) !== -1) {
            break;
          } else if (c === "\\") {
            esc = true;
          } else {
            unesc += c;
          }
        }
        if (esc) {
          unesc += "\\";
        }
        return unesc.trim();
      }
      return val;
    };
    module2.exports = {
      parse: decode,
      decode,
      stringify: encode,
      encode,
      safe,
      unsafe
    };
  }
});
var import_ini = (0, import_chunk_4VNS5WPM.__toESM)(require_ini(), 1);
var isWindows = import_node_process.default.platform === "win32";
var readRc = (filePath) => {
  try {
    return import_ini.default.parse(import_node_fs.default.readFileSync(filePath, "utf8")).prefix;
  } catch {
  }
};
var getEnvNpmPrefix = () => Object.keys(import_node_process.default.env).reduce((prefix, name) => /^npm_config_prefix$/i.test(name) ? import_node_process.default.env[name] : prefix, void 0);
var getGlobalNpmrc = () => {
  if (isWindows && import_node_process.default.env.APPDATA) {
    return import_node_path.default.join(import_node_process.default.env.APPDATA, "/npm/etc/npmrc");
  }
  if (import_node_process.default.execPath.includes("/Cellar/node")) {
    const homebrewPrefix = import_node_process.default.execPath.slice(0, import_node_process.default.execPath.indexOf("/Cellar/node"));
    return import_node_path.default.join(homebrewPrefix, "/lib/node_modules/npm/npmrc");
  }
  if (import_node_process.default.execPath.endsWith("/bin/node")) {
    const installDir = import_node_path.default.dirname(import_node_path.default.dirname(import_node_process.default.execPath));
    return import_node_path.default.join(installDir, "/etc/npmrc");
  }
};
var getDefaultNpmPrefix = () => {
  if (isWindows) {
    const { APPDATA } = import_node_process.default.env;
    return APPDATA ? import_node_path.default.join(APPDATA, "npm") : import_node_path.default.dirname(import_node_process.default.execPath);
  }
  return import_node_path.default.dirname(import_node_path.default.dirname(import_node_process.default.execPath));
};
var getNpmPrefix = () => {
  const envPrefix = getEnvNpmPrefix();
  if (envPrefix) {
    return envPrefix;
  }
  const homePrefix = readRc(import_node_path.default.join(import_node_os.default.homedir(), ".npmrc"));
  if (homePrefix) {
    return homePrefix;
  }
  if (import_node_process.default.env.PREFIX) {
    return import_node_process.default.env.PREFIX;
  }
  const globalPrefix = readRc(getGlobalNpmrc());
  if (globalPrefix) {
    return globalPrefix;
  }
  return getDefaultNpmPrefix();
};
var npmPrefix = import_node_path.default.resolve(getNpmPrefix());
var getYarnWindowsDirectory = () => {
  if (isWindows && import_node_process.default.env.LOCALAPPDATA) {
    const dir = import_node_path.default.join(import_node_process.default.env.LOCALAPPDATA, "Yarn");
    if (import_node_fs.default.existsSync(dir)) {
      return dir;
    }
  }
  return false;
};
var getYarnPrefix = () => {
  if (import_node_process.default.env.PREFIX) {
    return import_node_process.default.env.PREFIX;
  }
  const windowsPrefix = getYarnWindowsDirectory();
  if (windowsPrefix) {
    return windowsPrefix;
  }
  const configPrefix = import_node_path.default.join(import_node_os.default.homedir(), ".config/yarn");
  if (import_node_fs.default.existsSync(configPrefix)) {
    return configPrefix;
  }
  const homePrefix = import_node_path.default.join(import_node_os.default.homedir(), ".yarn-config");
  if (import_node_fs.default.existsSync(homePrefix)) {
    return homePrefix;
  }
  return npmPrefix;
};
var globalDirectory = {};
globalDirectory.npm = {};
globalDirectory.npm.prefix = npmPrefix;
globalDirectory.npm.packages = import_node_path.default.join(npmPrefix, isWindows ? "node_modules" : "lib/node_modules");
globalDirectory.npm.binaries = isWindows ? npmPrefix : import_node_path.default.join(npmPrefix, "bin");
var yarnPrefix = import_node_path.default.resolve(getYarnPrefix());
globalDirectory.yarn = {};
globalDirectory.yarn.prefix = yarnPrefix;
globalDirectory.yarn.packages = import_node_path.default.join(yarnPrefix, getYarnWindowsDirectory() ? "Data/global/node_modules" : "global/node_modules");
globalDirectory.yarn.binaries = import_node_path.default.join(globalDirectory.yarn.packages, ".bin");
var global_directory_default = globalDirectory;
function isCurrentBinInstalledGlobally() {
  try {
    const realPrismaPath = import_fs.default.realpathSync(process.argv[1]);
    const usingGlobalNpm = realPrismaPath.indexOf(import_fs.default.realpathSync(global_directory_default.npm.packages)) === 0;
    if (usingGlobalNpm) {
      return "npm";
    }
  } catch (e) {
  }
  return false;
}
