import { prisma } from '../../prisma';
import { send, computeCostUsd, ChatMessage } from './openai';
import { normalizeDiffPaths } from '../git/normalize';
import { validateDiff, applyDiffOnBranch } from '../git/patch';
import { createBranchAndPR, runChecks } from '../../routes/ai/codex';
import path from 'path';

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(process.cwd(), '..');
const MAX_LOG_CHARS = 20_000;
const MAX_DIFF_LINES = 1500;

function redactSecrets(text: string): string {
  return text
    .replace(/(OPENAI_API_KEY|AWS_SECRET_ACCESS_KEY|STRIPE_SECRET_KEY)=?[A-Za-z0-9_\-]{10,}/gi, '$1=***')
    .replace(/Bearer\s+[A-Za-z0-9_\-]{20,}/gi, 'Bearer ***');
}

function truncate(s: string, max: number): string { return s.length > max ? s.slice(0, max) + '\n...[truncated]' : s; }

function isUnifiedDiff(text: string): boolean {
  return /^---\s+(a\/|\/dev\/null)/m.test(text) && /^\+\+\+\s+(b\/|\/dev\/null)/m.test(text);
}

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
      prompt = buildInitialPrompt(session.taskKey, session.description, allow);
      messages = [messages[0], { role: 'user', content: prompt }]; // system preserved
    } else {
      const failedLogs = lastPatch ? 'Previous patch failed tests.' : 'Previous attempt failed validation.';
  const recentSession = await prisma.aiSession.findUnique({ where: { id: sessionId } });
      const logs = truncate(redactSecrets(String(recentSession?.logs || '')), MAX_LOG_CHARS);
      const fuPrompt = buildFollowupPrompt(logs);
      messages = [messages[0], { role: 'user', content: fuPrompt }]; // keep system only + new user message
    }

    let openaiText: string = '';
    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const resp = await send(model, messages, { temperature: 0.3, max_tokens: 3000 });
      if (resp.usage) {
        cumulativeInput += resp.usage.prompt_tokens;
        cumulativeOutput += resp.usage.completion_tokens;
        cost += computeCostUsd(resp.usage);
      }
      openaiText = resp.text.replace(/^```diff\n?|```$/g, '').trim();
      if (!isUnifiedDiff(openaiText)) throw new Error('model did not return unified diff');
      const diffLines = openaiText.split(/\n/);
      if (diffLines.length > MAX_DIFF_LINES) throw new Error(`diff too large lines=${diffLines.length}`);
    } catch (e: any) {
  await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'FAILED', logs: truncate(e?.message || String(e), MAX_LOG_CHARS), rounds: round, usageInput: cumulativeInput, usageOutput: cumulativeOutput, costUsd: cost } });
      return;
    }

    // Normalize & allowlist
    let normalized: string = openaiText;
    try {
      const norm = normalizeDiffPaths(openaiText, allow, REPO_ROOT);
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

function buildInitialPrompt(taskKey: string, description: string, allow: string[] | null): string {
  return [
    `TASK: ${taskKey}`,
    'DESCRIPTION:', description,
    'ALLOWED FILES (read-only):', ...(allow || ['(none)']).slice(0,200),
    '',
    'CONSTRAINTS:',
    '- OUTPUT ONLY unified diffs; no prose.',
    '- Keep change surface minimal; prefer small edits.',
    '- Preserve public exports & existing behavior unless required.',
    '- If adding deps, include package.json diff only (no lockfiles).',
    '- Do not invent paths outside allowlist.',
  ].join('\n');
}

function buildFollowupPrompt(logs: string): string {
  return [
    'Previous attempt failed. LOGS (truncated):', logs,
    '',
    'Produce a MINIMAL correction unified diff touching as few files as possible.',
    'NO commentary; ONLY diff output.',
  ].join('\n');
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
