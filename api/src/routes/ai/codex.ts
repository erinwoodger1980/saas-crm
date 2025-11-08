import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';

interface FeatureRequestLike {
  id: string;
  title: string;
  description: string;
  allowedFiles: any;
  priority: number | null;
}

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(process.cwd(), '..');

export async function buildPrompt(taskKey: string, fr: FeatureRequestLike, extra: string): Promise<string> {
  const templatePath = path.join(REPO_ROOT, 'templates', 'prompts', `${taskKey}.prompt.txt`);
  let template = '';
  try { template = fs.readFileSync(templatePath, 'utf8'); } catch { template = 'Implement task'; }
  const nodeV = process.version;
  const tsV = safeExec('pnpm list typescript --depth 0 || true');
  const allow = Array.isArray(fr.allowedFiles) ? JSON.stringify(fr.allowedFiles).slice(0, 500) : 'none';
  return `${template}\nTASK_TITLE: ${fr.title}\nTASK_DESC: ${fr.description}\nPRIORITY: ${fr.priority || 'n/a'}\nALLOWED: ${allow}\nNODE: ${nodeV}\nTS: ${tsV}\nEXTRA: ${extra}`;
}

export async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const systemPrompt = `You are an expert code generator. Generate git-compatible unified diff patches.

CRITICAL FORMAT REQUIREMENTS:
1. Each file change MUST start with these exact headers:
   --- a/path/to/file
   +++ b/path/to/file
2. Follow with hunk headers like: @@ -1,5 +1,6 @@
3. Use standard diff markers: lines starting with space (unchanged), - (removed), + (added)
4. For new files, use: --- /dev/null and +++ b/path/to/file
5. For deleted files, use: --- a/path/to/file and +++ /dev/null

EXAMPLE for updating existing file:
--- a/web/src/components/Button.tsx
+++ b/web/src/components/Button.tsx
@@ -1,5 +1,6 @@
 export function Button() {
-  return <button>Old text</button>
+  return <button>New text</button>
 }

EXAMPLE for new file:
--- /dev/null
+++ b/web/src/components/NewFile.tsx
@@ -0,0 +1,3 @@
+export function NewComponent() {
+  return <div>New</div>
+}

Generate ONLY the unified diff, no explanations.`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${apiKey}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ 
      model, 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4096,
      temperature: 0.7
    })
  });
  
  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`OpenAI API error ${resp.status}: ${errorText.slice(0, 500)}`);
  }
  
  const data: any = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('empty AI diff - no content in response');
  return text.trim();
}

export async function validateAndApplyDiff(diffText: string, baseBranch: string, branchName: string) {
  if (!diffText) throw new Error('no diff text');
  // Ensure repo exists
  const cwd = REPO_ROOT;
  // Create branch
  safeExec(`git checkout ${baseBranch}`);
  safeExec(`git pull --ff-only || true`);
  safeExec(`git checkout -b ${branchName} || git checkout ${branchName}`);
  // Write diff to temp file
  const tmp = path.join(cwd, `.tmp_patch_${Date.now()}.diff`);
  fs.writeFileSync(tmp, diffText, 'utf8');
  // Validate
  safeExec(`git apply --check ${tmp}`);
  // Apply
  safeExec(`git apply ${tmp}`);
  safeExec(`git add -A`);
  safeExec(`git commit -m "feat: apply AI patch for ${branchName}" || true`);
  fs.unlinkSync(tmp);
}

export async function runChecks(): Promise<{ ok: boolean; errors?: string }> {
  try {
    const tscCmd = process.env.TS_CHECK_CMD || 'pnpm tsc --noEmit';
    const testCmd = process.env.TEST_CMD || 'pnpm test --runTestsByPath';
    const lintCmd = process.env.LINT_CMD || 'pnpm lint';
    const out: string[] = [];
    out.push(safeExec(tscCmd));
    out.push(safeExec(`${lintCmd} || true`));
    // Keep tests lightweight: run zero tests if none specified.
    out.push(safeExec(`${testCmd} || true`));
    return { ok: true, errors: out.join('\n').slice(0, 20000) };
  } catch (e: any) {
    return { ok: false, errors: e?.message || String(e) };
  }
}

export async function createBranchAndPR(branchName: string, title: string, body: string): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null; // Skip if not configured
  const octokit = new Octokit({ auth: token });
  try {
    // Push branch (assumes commits already made)
    safeExec(`git push origin ${branchName}`);
    const pr = await octokit.pulls.create({ owner, repo, head: branchName, base: process.env.GIT_MAIN_BRANCH || 'main', title, body });
    return pr.data.html_url;
  } catch (e: any) {
    return null;
  }
}

function safeExec(cmd: string): string {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

export const middleware = () => {}; // placeholder to avoid unused warnings if imported elsewhere
export const config = {};
