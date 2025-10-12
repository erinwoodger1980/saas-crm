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
var chunk_H4NI2RIK_exports = {};
__export(chunk_H4NI2RIK_exports, {
  isCi: () => isCi
});
module.exports = __toCommonJS(chunk_H4NI2RIK_exports);
var isCi = () => {
  const env = process.env;
  return !!(env.CI || // Travis CI, CircleCI, Cirrus CI, GitLab CI, Appveyor, CodeShip, dsari
  env.CONTINUOUS_INTEGRATION || // Travis CI, Cirrus CI
  env.BUILD_NUMBER || // Jenkins, TeamCity
  env.RUN_ID || // TaskCluster, dsari
  // From `env` from v4.0.0 https://github.com/watson/ci-info/blob/3e1488e98680f1f776785fe8708a157b7f00e568/vendors.json
  env.AGOLA_GIT_REF || env.AC_APPCIRCLE || env.APPVEYOR || env.CODEBUILD || env.TF_BUILD || env.bamboo_planKey || env.BITBUCKET_COMMIT || env.BITRISE_IO || env.BUDDY_WORKSPACE_ID || env.BUILDKITE || env.CIRCLECI || env.CIRRUS_CI || env.CF_BUILD_ID || env.CM_BUILD_ID || env.CI_NAME || env.DRONE || env.DSARI || env.EARTHLY_CI || env.EAS_BUILD || env.GERRIT_PROJECT || env.GITEA_ACTIONS || env.GITHUB_ACTIONS || env.GITLAB_CI || env.GOCD || env.BUILDER_OUTPUT || env.HARNESS_BUILD_ID || env.JENKINS_URL || env.BUILD_ID || env.LAYERCI || env.MAGNUM || env.NETLIFY || env.NEVERCODE || env.PROW_JOB_ID || env.RELEASE_BUILD_ID || env.RENDER || env.SAILCI || env.HUDSON || env.JENKINS_URL || env.BUILD_ID || env.SCREWDRIVER || env.SEMAPHORE || env.SOURCEHUT || env.STRIDER || env.TASK_ID || env.RUN_ID || env.TEAMCITY_VERSION || env.TRAVIS || env.VELA || env.NOW_BUILDER || // See https://github.com/prisma/prisma/issues/22380 for why we commented it out
  // Users deploying on Vercel might have this env var set in the local dev env
  // env.VERCEL ||
  env.APPCENTER_BUILD_ID || env.CI_XCODE_PROJECT || env.XCS || false);
};
