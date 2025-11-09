import { prisma } from '../../prisma';
import { send, computeCostUsd, ChatMessage } from './openai';
import { normalizeDiffPaths } from '../git/normalize';
import { validateDiff, applyDiffOnBranch } from '../git/patch';
import { createBranchAndPR, runChecks } from '../../routes/ai/codex';
import { buildContextBundle } from './prompt';
import path from 'path';
import { isUnifiedDiff, ensureDiffPrefixes } from './diffContract';

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(process.cwd(), '..');
const MAX_LOG_CHARS = 20_000;
const MAX_DIFF_LINES = 1500;

function redactSecrets(text: string): string {
  return text
    .replace(/(OPENAI_API_KEY|AWS_SECRET_ACCESS_KEY|STRIPE_SECRET_KEY)=?[A-Za-z0-9_\-]{10,}/gi, '$1=***')
    .replace(/Bearer\s+[A-Za-z0-9_\-]{20,}/gi, 'Bearer ***');
}

function truncate(s: string, max: number): string { return s.length > max ? s.slice(0, max) + '\n...[truncated]' : s; }


interface SessionContext {
  id: string; taskKey: string; description: string; files: any; mode: string; maxRounds: number; rounds: number; messages: any[];
}

export async function runCodexWithAutoFix(sessionId: string): Promise<void> {
  let session = await prisma.aiSession.findUnique({ where: { id: sessionId } });
  if (!session) return;
  if (session.status !== 'OPEN') {
    // Avoid double run
    return;
  }
  session = await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'RUNNING' } });

  const allow = Array.isArray(session.files) ? session.files as string[] : null;
  const baseBranch = process.env.GIT_MAIN_BRANCH || 'main';
  const branchName = `feat/ai-loop-${session.id.slice(0,8)}`;
  let cumulativeInput = session.usageInput || 0;
  let cumulativeOutput = session.usageOutput || 0;
  let cost = session.costUsd || 0;
  let lastPatch: string | null = null;
  let messages: ChatMessage[] = Array.isArray(session.messages) ? session.messages as unknown as ChatMessage[] : [];

  for (let round = session.rounds + 1; round <= session.maxRounds; round++) {
    let prompt: string;
    if (round === 1) {
      prompt = await buildInitialPromptWithContext(session.taskKey, session.description, allow);
      messages = [messages[0], { role: 'user', content: prompt }]; // system preserved
    } else {
      const recentSession = await prisma.aiSession.findUnique({ where: { id: sessionId } });
      const logs = truncate(redactSecrets(String(recentSession?.logs || '')), MAX_LOG_CHARS);
      prompt = await buildFollowupPromptWithContext(logs, allow);
      messages = [messages[0], { role: 'user', content: prompt }]; // keep system only + new user message
    }

    let reply = '';
    let finalTxt = '';
    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const resp = await send(model, messages, { temperature: 0.3, max_tokens: 3000 });
      if (resp.usage) {
        cumulativeInput += resp.usage.prompt_tokens;
        cumulativeOutput += resp.usage.completion_tokens;
        cost += computeCostUsd(resp.usage);
      }
      reply = resp.text.replace(/^```diff\n?|```$/g, '').trim();
      const txt = reply.trim();
      if (!isUnifiedDiff(txt)) {
        // 1st retry: convert-to-diff
        const convertMsg = `\nYour last output was not a unified diff.\nConvert it into a SINGLE unified diff now.\nFollow the CONTRACT exactly. Do not add explanations.\n`;
        const txt2 = await send(model, messages.concat({role:"user", content: convertMsg + "\n\n<<BEGIN-OUTPUT>>\n" + txt.slice(0, 20000) + "\n<<END-OUTPUT>>"}), { temperature: 0.2, max_tokens: 3000 });
        const diff2 = txt2.text.replace(/^```diff\n?|```$/g, '').trim();
        if (!isUnifiedDiff(diff2)) {
          await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'FAILED', logs: truncate('NON_DIFF_OUTPUT', MAX_LOG_CHARS), rounds: round, usageInput: cumulativeInput, usageOutput: cumulativeOutput, costUsd: cost } });
          return;
        }
        finalTxt = ensureDiffPrefixes(diff2);
      } else {
        finalTxt = ensureDiffPrefixes(txt);
      }
      const diffLines = finalTxt.split(/\n/);
      if (diffLines.length > MAX_DIFF_LINES) throw new Error(`diff too large lines=${diffLines.length}`);
    } catch (e: any) {
      await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'FAILED', logs: truncate(e?.message || String(e), MAX_LOG_CHARS), rounds: round, usageInput: cumulativeInput, usageOutput: cumulativeOutput, costUsd: cost } });
      return;
    }

    // Normalize & allowlist
    let normalized: string = finalTxt;
    try {
      const norm = normalizeDiffPaths(finalTxt, allow, REPO_ROOT);
      normalized = norm.diff;
      // TODO explicit allowlist rejection already enforced by normalizeDiffPaths throwing
    } catch (e: any) {
      await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'FAILED', logs: truncate(`allowlist/normalize failed: ${e?.message || e}`, MAX_LOG_CHARS), rounds: round, usageInput: cumulativeInput, usageOutput: cumulativeOutput, costUsd: cost } });
      return;
    }

    // Dry validation
    const valid = validateDiff(normalized);
    if (!valid.ok) {
      await prisma.aiSession.update({ where: { id: sessionId }, data: { rounds: round, logs: truncate(`validation failed: ${valid.error}`, MAX_LOG_CHARS), usageInput: cumulativeInput, usageOutput: cumulativeOutput, costUsd: cost } });
      lastPatch = normalized;
      continue; // next round
    }

    // Apply patch
    const applied = applyDiffOnBranch(normalized, baseBranch, branchName);
    if (!applied.ok) {
      await prisma.aiSession.update({ where: { id: sessionId }, data: { rounds: round, logs: truncate(`apply failed: ${applied.error}`, MAX_LOG_CHARS), usageInput: cumulativeInput, usageOutput: cumulativeOutput, costUsd: cost } });
      lastPatch = normalized;
      continue;
    }

    // Run checks
    const checks = await runChecks();
    if (!checks.ok) {
      await prisma.aiSession.update({ where: { id: sessionId }, data: { rounds: round, logs: truncate(`checks failed:\n${checks.errors}`, MAX_LOG_CHARS), patchText: normalized, branch: branchName, usageInput: cumulativeInput, usageOutput: cumulativeOutput, costUsd: cost } });
      lastPatch = normalized;
      continue; // attempt next round with logs
    }

    // Success
    let prUrl: string | null = null;
    if (session.mode === 'pr') {
      prUrl = await createBranchAndPR(branchName, session.description.slice(0,80), session.description);
    }
    await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'READY', rounds: round, patchText: normalized, branch: branchName, prUrl, logs: 'checks passed', usageInput: cumulativeInput, usageOutput: cumulativeOutput, costUsd: cost } });
    return;
  }

  // Exhausted rounds
  await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'FAILED', logs: 'maxRounds exhausted', usageInput: cumulativeInput, usageOutput: cumulativeOutput, costUsd: cost } });
}

async function buildInitialPromptWithContext(taskKey: string, description: string, allow: string[] | null): Promise<string> {
  const bundle = await buildContextBundle({
    taskKey,
    description,
    allowGlobs: allow,
    logs: '',
    repoRoot: REPO_ROOT,
  });
  
  const sections = [
    `TASK: ${taskKey}`,
    'DESCRIPTION:', description,
    '',
    'File Manifest (allowlisted, truncated):',
    ...bundle.manifest.slice(0, 200),
  ];
  
  if (bundle.excerpts.length > 0) {
    sections.push('', 'Relevant Code Excerpts:');
    for (const { path, text, clipped } of bundle.excerpts) {
      sections.push(`--- FILE: ${path} (clipped=${clipped}) ---`);
      sections.push(text);
      sections.push('');
    }
  }
  
  sections.push(
    '',
    'CONSTRAINTS:',
    '- OUTPUT ONLY unified diffs; no prose.',
    '- Use ONLY paths from File Manifest.',
    '- Keep change surface minimal; prefer small edits.',
    '- Preserve public exports & existing behavior unless required.',
    '- If adding deps, include package.json diff only (no lockfiles).',
    '- Do not invent paths outside allowlist.'
  );
  
  return sections.join('\n');
}

async function buildFollowupPromptWithContext(logs: string, allow: string[] | null): Promise<string> {
  const bundle = await buildContextBundle({
    description: 'Fix errors from previous attempt',
    allowGlobs: allow,
    logs,
    repoRoot: REPO_ROOT,
  });
  
  const sections = [
    'Previous attempt failed. LOGS (truncated):', bundle.errorsExcerpt,
  ];
  
  if (bundle.excerpts.length > 0) {
    sections.push('', 'Code Around Errors:');
    for (const { path, text, clipped } of bundle.excerpts) {
      sections.push(`--- FILE: ${path} (clipped=${clipped}) ---`);
      sections.push(text);
      sections.push('');
    }
  }
  
  sections.push(
    '',
    'Produce a MINIMAL correction unified diff touching as few files as possible.',
    'NO commentary; ONLY diff output.'
  );
  
  return sections.join('\n');
}

// Simple in-memory runner queue to avoid overlapping runs
const active = new Set<string>();
export function queueRun(sessionId: string) {
  if (active.has(sessionId)) return;
  active.add(sessionId);
  setTimeout(async () => {
    try { await runCodexWithAutoFix(sessionId); } finally { active.delete(sessionId); }
  }, 10);
}
