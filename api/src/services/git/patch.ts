import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(process.cwd(), '..');

export function validateDiff(diffText: string): { ok: boolean; error?: string } {
  try {
    if (!diffText.trim()) return { ok: false, error: 'empty diff' };
    const tmp = path.join(REPO_ROOT, `.tmp_validate_${Date.now()}.diff`);
    fs.writeFileSync(tmp, diffText, 'utf8');
    execSync(`git apply --check ${tmp}`, { cwd: REPO_ROOT, stdio: 'pipe' });
    fs.unlinkSync(tmp);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function applyDiffOnBranch(diffText: string, baseBranch: string, branchName: string): { ok: boolean; error?: string } {
  try {
    if (!diffText.trim()) return { ok: false, error: 'empty diff' };
    execSync(`git checkout ${baseBranch}`, { cwd: REPO_ROOT, stdio: 'pipe' });
    execSync(`git pull --ff-only || true`, { cwd: REPO_ROOT, stdio: 'pipe' });
    execSync(`git checkout -b ${branchName} || git checkout ${branchName}`, { cwd: REPO_ROOT, stdio: 'pipe' });
    const tmp = path.join(REPO_ROOT, `.tmp_apply_${Date.now()}.diff`);
    fs.writeFileSync(tmp, diffText, 'utf8');
    execSync(`git apply --whitespace=fix ${tmp}`, { cwd: REPO_ROOT, stdio: 'pipe' });
    execSync(`git add -A`, { cwd: REPO_ROOT, stdio: 'pipe' });
    execSync(`git commit -m "feat: AI loop patch ${branchName}" || true`, { cwd: REPO_ROOT, stdio: 'pipe' });
    fs.unlinkSync(tmp);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
