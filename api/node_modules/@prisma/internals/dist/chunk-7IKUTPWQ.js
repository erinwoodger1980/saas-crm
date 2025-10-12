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
var chunk_7IKUTPWQ_exports = {};
__export(chunk_7IKUTPWQ_exports, {
  getGitHubIssueUrl: () => getGitHubIssueUrl,
  wouldYouLikeToCreateANewIssue: () => wouldYouLikeToCreateANewIssue
});
module.exports = __toCommonJS(chunk_7IKUTPWQ_exports);
var import_chunk_XKZ6CBLA = require("./chunk-XKZ6CBLA.js");
var import_chunk_4VNS5WPM = require("./chunk-4VNS5WPM.js");
var import_node_util = require("node:util");
var import_get_platform = require("@prisma/get-platform");
var import_node_process = __toESM(require("node:process"));
var import_node_os = __toESM(require("node:os"));
var import_node_fs = __toESM(require("node:fs"));
var import_node_fs2 = __toESM(require("node:fs"));
var import_node_fs3 = __toESM(require("node:fs"));
var import_prompts = __toESM(require("prompts"));
var require_is_windows = (0, import_chunk_4VNS5WPM.__commonJS)({
  "../../node_modules/.pnpm/is-windows@1.0.2/node_modules/is-windows/index.js"(exports, module2) {
    "use strict";
    (function(factory) {
      if (exports && typeof exports === "object" && typeof module2 !== "undefined") {
        module2.exports = factory();
      } else if (typeof define === "function" && define.amd) {
        define([], factory);
      } else if (typeof window !== "undefined") {
        window.isWindows = factory();
      } else if (typeof global !== "undefined") {
        global.isWindows = factory();
      } else if (typeof self !== "undefined") {
        self.isWindows = factory();
      } else {
        this.isWindows = factory();
      }
    })(function() {
      "use strict";
      return function isWindows2() {
        return process && (process.platform === "win32" || /^(msys|cygwin)$/.test(process.env.OSTYPE));
      };
    });
  }
});
var require_new_github_issue_url = (0, import_chunk_4VNS5WPM.__commonJS)({
  "../../node_modules/.pnpm/new-github-issue-url@0.2.1/node_modules/new-github-issue-url/index.js"(exports, module2) {
    "use strict";
    module2.exports = (options = {}) => {
      let repoUrl;
      if (options.repoUrl) {
        repoUrl = options.repoUrl;
      } else if (options.user && options.repo) {
        repoUrl = `https://github.com/${options.user}/${options.repo}`;
      } else {
        throw new Error("You need to specify either the `repoUrl` option or both the `user` and `repo` options");
      }
      const url = new URL(`${repoUrl}/issues/new`);
      const types = [
        "body",
        "title",
        "labels",
        "template",
        "milestone",
        "assignee",
        "projects"
      ];
      for (const type of types) {
        let value = options[type];
        if (value === void 0) {
          continue;
        }
        if (type === "labels" || type === "projects") {
          if (!Array.isArray(value)) {
            throw new TypeError(`The \`${type}\` option should be an array`);
          }
          value = value.join(",");
        }
        url.searchParams.set(type, value);
      }
      return url.toString();
    };
    module2.exports.default = module2.exports;
  }
});
var require_is_docker = (0, import_chunk_4VNS5WPM.__commonJS)({
  "../../node_modules/.pnpm/is-docker@2.2.1/node_modules/is-docker/index.js"(exports, module2) {
    "use strict";
    var fs4 = (0, import_chunk_4VNS5WPM.__require)("fs");
    var isDocker2;
    function hasDockerEnv2() {
      try {
        fs4.statSync("/.dockerenv");
        return true;
      } catch (_) {
        return false;
      }
    }
    function hasDockerCGroup2() {
      try {
        return fs4.readFileSync("/proc/self/cgroup", "utf8").includes("docker");
      } catch (_) {
        return false;
      }
    }
    module2.exports = () => {
      if (isDocker2 === void 0) {
        isDocker2 = hasDockerEnv2() || hasDockerCGroup2();
      }
      return isDocker2;
    };
  }
});
var require_is_wsl = (0, import_chunk_4VNS5WPM.__commonJS)({
  "../../node_modules/.pnpm/is-wsl@2.2.0/node_modules/is-wsl/index.js"(exports, module2) {
    "use strict";
    var os2 = (0, import_chunk_4VNS5WPM.__require)("os");
    var fs4 = (0, import_chunk_4VNS5WPM.__require)("fs");
    var isDocker2 = require_is_docker();
    var isWsl2 = () => {
      if (process.platform !== "linux") {
        return false;
      }
      if (os2.release().toLowerCase().includes("microsoft")) {
        if (isDocker2()) {
          return false;
        }
        return true;
      }
      try {
        return fs4.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft") ? !isDocker2() : false;
      } catch (_) {
        return false;
      }
    };
    if (process.env.__IS_WSL_TEST__) {
      module2.exports = isWsl2;
    } else {
      module2.exports = isWsl2();
    }
  }
});
var require_open = (0, import_chunk_4VNS5WPM.__commonJS)({
  "../../node_modules/.pnpm/open@7.4.2/node_modules/open/index.js"(exports, module2) {
    "use strict";
    var { promisify } = (0, import_chunk_4VNS5WPM.__require)("util");
    var path = (0, import_chunk_4VNS5WPM.__require)("path");
    var childProcess = (0, import_chunk_4VNS5WPM.__require)("child_process");
    var fs4 = (0, import_chunk_4VNS5WPM.__require)("fs");
    var isWsl2 = require_is_wsl();
    var isDocker2 = require_is_docker();
    var pAccess = promisify(fs4.access);
    var pReadFile = promisify(fs4.readFile);
    var localXdgOpenPath = path.join(__dirname, "xdg-open");
    var getWslDrivesMountPoint = /* @__PURE__ */ (() => {
      const defaultMountPoint = "/mnt/";
      let mountPoint;
      return async function() {
        if (mountPoint) {
          return mountPoint;
        }
        const configFilePath = "/etc/wsl.conf";
        let isConfigFileExists = false;
        try {
          await pAccess(configFilePath, fs4.constants.F_OK);
          isConfigFileExists = true;
        } catch (_) {
        }
        if (!isConfigFileExists) {
          return defaultMountPoint;
        }
        const configContent = await pReadFile(configFilePath, { encoding: "utf8" });
        const configMountPoint = /root\s*=\s*(.*)/g.exec(configContent);
        if (!configMountPoint) {
          return defaultMountPoint;
        }
        mountPoint = configMountPoint[1].trim();
        mountPoint = mountPoint.endsWith("/") ? mountPoint : mountPoint + "/";
        return mountPoint;
      };
    })();
    module2.exports = async (target, options) => {
      if (typeof target !== "string") {
        throw new TypeError("Expected a `target`");
      }
      options = {
        wait: false,
        background: false,
        allowNonzeroExitCode: false,
        ...options
      };
      let command;
      let { app } = options;
      let appArguments = [];
      const cliArguments = [];
      const childProcessOptions = {};
      if (Array.isArray(app)) {
        appArguments = app.slice(1);
        app = app[0];
      }
      if (process.platform === "darwin") {
        command = "open";
        if (options.wait) {
          cliArguments.push("--wait-apps");
        }
        if (options.background) {
          cliArguments.push("--background");
        }
        if (app) {
          cliArguments.push("-a", app);
        }
      } else if (process.platform === "win32" || isWsl2 && !isDocker2()) {
        const mountPoint = await getWslDrivesMountPoint();
        command = isWsl2 ? `${mountPoint}c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe` : `${process.env.SYSTEMROOT}\\System32\\WindowsPowerShell\\v1.0\\powershell`;
        cliArguments.push(
          "-NoProfile",
          "-NonInteractive",
          "\u2013ExecutionPolicy",
          "Bypass",
          "-EncodedCommand"
        );
        if (!isWsl2) {
          childProcessOptions.windowsVerbatimArguments = true;
        }
        const encodedArguments = ["Start"];
        if (options.wait) {
          encodedArguments.push("-Wait");
        }
        if (app) {
          encodedArguments.push(`"\`"${app}\`""`, "-ArgumentList");
          appArguments.unshift(target);
        } else {
          encodedArguments.push(`"${target}"`);
        }
        if (appArguments.length > 0) {
          appArguments = appArguments.map((arg) => `"\`"${arg}\`""`);
          encodedArguments.push(appArguments.join(","));
        }
        target = Buffer.from(encodedArguments.join(" "), "utf16le").toString("base64");
      } else {
        if (app) {
          command = app;
        } else {
          const isBundled = !__dirname || __dirname === "/";
          let exeLocalXdgOpen = false;
          try {
            await pAccess(localXdgOpenPath, fs4.constants.X_OK);
            exeLocalXdgOpen = true;
          } catch (_) {
          }
          const useSystemXdgOpen = process.versions.electron || process.platform === "android" || isBundled || !exeLocalXdgOpen;
          command = useSystemXdgOpen ? "xdg-open" : localXdgOpenPath;
        }
        if (appArguments.length > 0) {
          cliArguments.push(...appArguments);
        }
        if (!options.wait) {
          childProcessOptions.stdio = "ignore";
          childProcessOptions.detached = true;
        }
      }
      cliArguments.push(target);
      if (process.platform === "darwin" && appArguments.length > 0) {
        cliArguments.push("--args", ...appArguments);
      }
      const subprocess = childProcess.spawn(command, cliArguments, childProcessOptions);
      if (options.wait) {
        return new Promise((resolve, reject) => {
          subprocess.once("error", reject);
          subprocess.once("close", (exitCode) => {
            if (options.allowNonzeroExitCode && exitCode > 0) {
              reject(new Error(`Exited with code ${exitCode}`));
              return;
            }
            resolve(subprocess);
          });
        });
      }
      subprocess.unref();
      return subprocess;
    };
  }
});
var import_is_windows = (0, import_chunk_4VNS5WPM.__toESM)(require_is_windows());
var isDockerCached;
function hasDockerEnv() {
  try {
    import_node_fs3.default.statSync("/.dockerenv");
    return true;
  } catch {
    return false;
  }
}
function hasDockerCGroup() {
  try {
    return import_node_fs3.default.readFileSync("/proc/self/cgroup", "utf8").includes("docker");
  } catch {
    return false;
  }
}
function isDocker() {
  if (isDockerCached === void 0) {
    isDockerCached = hasDockerEnv() || hasDockerCGroup();
  }
  return isDockerCached;
}
var cachedResult;
var hasContainerEnv = () => {
  try {
    import_node_fs2.default.statSync("/run/.containerenv");
    return true;
  } catch {
    return false;
  }
};
function isInsideContainer() {
  if (cachedResult === void 0) {
    cachedResult = hasContainerEnv() || isDocker();
  }
  return cachedResult;
}
var isWsl = () => {
  if (import_node_process.default.platform !== "linux") {
    return false;
  }
  if (import_node_os.default.release().toLowerCase().includes("microsoft")) {
    if (isInsideContainer()) {
      return false;
    }
    return true;
  }
  try {
    return import_node_fs.default.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft") ? !isInsideContainer() : false;
  } catch {
    return false;
  }
};
var is_wsl_default = import_node_process.default.env.__IS_WSL_TEST__ ? isWsl : isWsl();
var import_new_github_issue_url = (0, import_chunk_4VNS5WPM.__toESM)(require_new_github_issue_url());
var import_open = (0, import_chunk_4VNS5WPM.__toESM)(require_open());
function getGitHubIssueUrl({
  title,
  user = "prisma",
  repo = "prisma",
  template = "bug_report.yml",
  body
}) {
  return (0, import_new_github_issue_url.default)({
    user,
    repo,
    template,
    title,
    body
  });
}
async function wouldYouLikeToCreateANewIssue(options) {
  const shouldCreateNewIssue = await (0, import_chunk_XKZ6CBLA.z)(options.prompt).with(true, async () => {
    const createNewIssueResponse = await (0, import_prompts.default)({
      type: "select",
      name: "value",
      message: "Would you like to create a GitHub issue?",
      initial: 0,
      choices: [
        {
          title: "Yes",
          value: true,
          description: `Create a new GitHub issue`
        },
        {
          title: "No",
          value: false,
          description: `Don't create a new GitHub issue`
        }
      ]
    });
    return Boolean(createNewIssueResponse.value);
  }).otherwise(() => Promise.resolve(true));
  if (shouldCreateNewIssue) {
    const binaryTarget = await (0, import_get_platform.getBinaryTargetForCurrentPlatform)();
    const url = getGitHubIssueUrl({
      title: options.title ?? "",
      body: issueTemplate(binaryTarget, options)
    });
    const shouldOpenWait = (0, import_is_windows.default)() || is_wsl_default;
    await (0, import_open.default)(url, { wait: shouldOpenWait });
  } else {
    process.exit(130);
  }
}
var issueTemplate = (platform, options) => {
  return (0, import_node_util.stripVTControlCharacters)(`
Hi Prisma Team! The following command just crashed.
${options.reportId ? `The report Id is: ${options.reportId}` : ""}

## Command

\`${options.command}\`

## Versions
      
| Name        | Version            |
|-------------|--------------------|
| Platform    | ${platform.padEnd(19)}| 
| Node        | ${process.version.padEnd(19)}| 
| Prisma CLI  | ${options.cliVersion.padEnd(19)}| 
| Engine      | ${options.enginesVersion.padEnd(19)}| 

## Error
\`\`\`
${options.error}
\`\`\`
`);
};
/*! Bundled license information:

is-windows/index.js:
  (*!
   * is-windows <https://github.com/jonschlinkert/is-windows>
   *
   * Copyright © 2015-2018, Jon Schlinkert.
   * Released under the MIT License.
   *)
*/
