import fs from "fs";
import path from "path";
import os from "os";
import { createChatCompletion } from "../../services/ai/openai";
import { validateAndApplyDiff as applyDiff, pushBranch } from "../../services/git/patch";
import { runChecks as runRepoChecks } from "../../services/run/checks";
import { createPullRequest } from "../../services/vcs/github";

export interface FeaturePromptContext {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  allowedFiles?: unknown;
  extraContext?: string;
}

function repoRoot(): string {
  const configured = (process.env.REPO_ROOT || "").trim();
  if (configured) return configured;
  return path.resolve(__dirname, "../../../..");
}

function normalizeAllowedFiles(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => normalizeAllowedFiles(v))
      .filter((v): v is string => typeof v === "string" && !!v.trim());
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .flatMap((v) => normalizeAllowedFiles(v))
      .filter(Boolean);
  }
  return [];
}

function gatherFileSnippets(allowed: string[]): string {
  const snippets: string[] = [];
  const root = repoRoot();
  const limit = 3;
  for (const candidate of allowed) {
    if (snippets.length >= limit) break;
    if (!candidate || /[*?]/.test(candidate)) continue;
    const normalized = path.normalize(candidate).replace(/^\.\/+/, "");
    const resolved = path.join(root, normalized);
    if (!resolved.startsWith(root)) continue;
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) continue;
      const raw = fs.readFileSync(resolved, "utf8");
      const truncated = raw.split(/\r?\n/).slice(0, 120).join(os.EOL);
      snippets.push([
        `// File: ${normalized}`,
        "```",
        truncated,
        "```",
      ].join(os.EOL));
    } catch {}
  }
  return snippets.join(`${os.EOL}${os.EOL}`);
}

export async function buildPrompt(taskKey: string, ctx: FeaturePromptContext): Promise<string> {
  const root = repoRoot();
  const templatePath = path.join(root, "templates", "prompts", `${taskKey}.prompt.txt`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Prompt template not found for taskKey '${taskKey}'`);
  }
  const template = fs.readFileSync(templatePath, "utf8");

  let typescriptVersion = "unknown";
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    typescriptVersion = require("typescript/package.json").version || "unknown";
  } catch {}

  const allowed = normalizeAllowedFiles(ctx.allowedFiles);
  const snippets = gatherFileSnippets(allowed);

  const signals = [
    `Node version: ${process.version}`,
    `TypeScript version: ${typescriptVersion}`,
    `TS check command: ${(process.env.TS_CHECK_CMD || "pnpm tsc --noEmit").trim()}`,
    `Test command: ${(process.env.TEST_CMD || "pnpm test").trim()}`,
    `Lint command: ${(process.env.LINT_CMD || "pnpm lint").trim()}`,
  ].join(os.EOL);

  return [
    `## Feature Request`,
    `ID: ${ctx.id}`,
    `Title: ${ctx.title}`,
    `Category: ${ctx.category || "unspecified"}`,
    `Description:`,
    ctx.description,
    ctx.extraContext ? `Extra context: ${ctx.extraContext}` : null,
    allowed.length ? `Allowed files/globs: ${allowed.join(", ")}` : "Allowed files/globs: (not restricted)",
    "",
    "## Repo Signals",
    signals,
    snippets ? `${os.EOL}## Allowed file snippets${os.EOL}${snippets}` : null,
    "",
    "## Instructions",
    template.trim(),
  ]
    .filter((segment): segment is string => typeof segment === "string" && segment !== null)
    .join(os.EOL.repeat(2));
}

export async function callOpenAI(prompt: string): Promise<string> {
  if (process.env.NODE_ENV === "test") {
    return (
      process.env.TEST_OPENAI_DIFF ||
      [
        "diff --git a/README.md b/README.md",
        "index 1111111..2222222 100644",
        "--- a/README.md",
        "+++ b/README.md",
        "@@",
        "+Test patch",
      ].join("\n")
    );
  }
  return createChatCompletion(prompt, process.env.OPENAI_MODEL);
}

export const validateAndApplyDiff = applyDiff;
export const runChecks = runRepoChecks;
export const createBranchAndPR = createPullRequest;
export const pushAppliedBranch = pushBranch;
