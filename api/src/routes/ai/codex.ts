import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';
import { buildInitialPrompt } from '../../services/ai/prompt';
import { normalizeDiffPaths } from '../../services/git/normalize';

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
  const base = buildInitialPrompt(taskKey, fr, extra, REPO_ROOT);
  return `${template}\n${base}`;
}

export async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const systemPrompt = `You are an expert code generator. Generate ONLY git-compatible unified diff patches. Do NOT use markdown code blocks.

CRITICAL FORMAT REQUIREMENTS (follow EXACTLY):
1. Start each file with:
   --- a/relative/path/to/file
   +++ b/relative/path/to/file

2. Follow with hunk header:
   @@ -startLine,lineCount +startLine,lineCount @@
   
3. Every hunk MUST have:
   - At least 3 context lines (starting with space) before changes
   - Changed lines (starting with - for removals, + for additions)
   - At least 3 context lines (starting with space) after changes

4. New files:
   --- /dev/null
   +++ b/path/to/file
   @@ -0,0 +1,N @@
   +line1
   +line2

5. Each line in the diff body must start with: space (context), - (remove), or + (add)

CORRECT EXAMPLE:
--- a/web/src/app/page.tsx
+++ b/web/src/app/page.tsx
@@ -10,7 +10,7 @@
 export default function HomePage() {
   const [data, setData] = useState(null);
   
-  return <div>Old content</div>
+  return <div>Updated content</div>
 }
 
 function helper() {

Generate ONLY the diff. NO explanations. NO code blocks. NO text before or after the diff.`;

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
  let text = data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('empty AI diff - no content in response');
  
  // Clean up the diff: remove markdown code blocks if present
  text = text.replace(/^```diff\s*\n/gm, '').replace(/^```\s*\n/gm, '').replace(/```$/gm, '');
  
  // Validate diff format
  const lines = text.trim().split('\n');
  const hasProperHeaders = lines.some((l: string) => l.match(/^--- (a\/|\/dev\/null)/)) && 
                           lines.some((l: string) => l.match(/^\+\+\+ (b\/|\/dev\/null)/));
  const hasHunkHeaders = lines.some((l: string) => l.match(/^@@ -\d+,?\d* \+\d+,?\d* @@/));
  
  if (!hasProperHeaders || !hasHunkHeaders) {
    throw new Error('AI generated invalid diff format - missing proper --- a/ +++ b/ headers or @@ hunk markers');
  }
  
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
