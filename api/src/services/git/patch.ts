import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export interface ApplyDiffResult {
  worktreePath: string;
  cleanup: () => Promise<void>;
}

function repoRoot(): string {
  const configured = (process.env.REPO_ROOT || "").trim();
  if (configured) return configured;
  return path.resolve(__dirname, "../../../..");
}

function run(cmd: string, cwd: string) {
  return execSync(cmd, { cwd, stdio: "pipe", env: process.env }).toString();
}

export async function validateAndApplyDiff(
  diffText: string,
  baseBranch: string,
  branchName: string,
  commitMessage = "chore: apply AI patch",
): Promise<ApplyDiffResult> {
  if (!diffText || !diffText.trim()) {
    throw new Error("Diff is empty");
  }

  if (process.env.NODE_ENV === "test") {
    return {
      worktreePath: repoRoot(),
      cleanup: async () => {},
    };
  }

  const root = repoRoot();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "feature-ai-"));

  try {
    run(`git worktree add --detach ${JSON.stringify(tmp)} ${baseBranch}`, root);
    run(`git checkout -b ${branchName}`, tmp);

    const patchPath = path.join(tmp, "feature.patch");
    fs.writeFileSync(patchPath, diffText, "utf8");

    try {
      run(`git apply --check ${JSON.stringify(patchPath)}`, tmp);
    } catch (err: any) {
      throw new Error(`Patch failed validation: ${err?.message || err}`);
    }

    run(`git apply ${JSON.stringify(patchPath)}`, tmp);
    run("git add -A", tmp);
    run(`git commit -m ${JSON.stringify(commitMessage)}`, tmp);

    return {
      worktreePath: tmp,
      cleanup: async () => {
        try { fs.unlinkSync(patchPath); } catch {}
        try { run(`git worktree remove ${JSON.stringify(tmp)} --force`, root); } catch {}
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
      },
    };
  } catch (err) {
    try { run(`git worktree remove ${JSON.stringify(tmp)} --force`, root); } catch {}
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    throw err;
  }
}

export function pushBranch(branchName: string, worktreePath: string) {
  if (process.env.NODE_ENV === "test") return;
  run(`git push origin ${branchName}`, worktreePath);
}
