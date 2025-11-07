import { execSync } from "child_process";

export interface CheckResult {
  command: string;
  ok: boolean;
  output: string;
}

export interface ChecksSummary {
  ok: boolean;
  results: CheckResult[];
}

function runCommand(cmd: string, cwd: string): CheckResult {
  try {
    const output = execSync(cmd, { cwd, env: process.env, stdio: "pipe" }).toString();
    return { command: cmd, ok: true, output };
  } catch (err: any) {
    const output = (err?.stdout?.toString?.() || "") + (err?.stderr?.toString?.() || err?.message || "");
    return { command: cmd, ok: false, output };
  }
}

export async function runChecks(cwd: string): Promise<ChecksSummary> {
  if (process.env.NODE_ENV === "test") {
    return { ok: true, results: [] };
  }

  const commands = [
    (process.env.TS_CHECK_CMD || "").trim(),
    (process.env.TEST_CMD || "").trim(),
    (process.env.LINT_CMD || "").trim(),
  ].filter(Boolean);

  const results = commands.map((cmd) => runCommand(cmd, cwd));
  const ok = results.every((r) => r.ok);
  return { ok, results };
}
