import { Router } from 'express';
import { prisma } from '../../prisma';
import { queueRun } from '../../services/ai/loop';

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req?.auth?.userId) return res.status(401).json({ error: 'unauthorized' });
  next();
}
function isAdmin(req: any): boolean {
  const role = String(req?.auth?.role || '').toLowerCase();
  return role === 'admin' || role === 'owner';
}

router.post('/start', requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'admin_only' });
  const { taskKey, description, files, mode = 'dry-run', maxRounds = 3 } = (req.body || {}) as { taskKey: string; description: string; files?: string[]; mode?: string; maxRounds?: number };
  if (!taskKey || !description) return res.status(400).json({ error: 'taskKey and description required' });

  try {
    const systemMsg = {
      role: 'system',
      content: [
        'You are an expert code agent. OUTPUT ONLY unified git diffs.',
        'No prose, no code fences. Keep changes minimal. Respect allowlist paths.',
      ].join('\n')
    } as const;
  const session = await prisma.aiSession.create({
      data: {
        taskKey,
        description,
        files: Array.isArray(files) ? files : [],
        mode,
        maxRounds: Math.max(1, Math.min(5, Number(maxRounds) || 3)),
        status: 'OPEN',
        messages: [systemMsg],
        rounds: 0,
      }
    });
    queueRun(session.id);
    res.json({ sessionId: session.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

router.post('/status', requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'admin_only' });
  const { sessionId } = (req.body || {}) as { sessionId: string };
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const s = await prisma.aiSession.findUnique({ where: { id: sessionId } });
  if (!s) return res.status(404).json({ error: 'not_found' });
  const out: any = {
    status: s.status,
    rounds: s.rounds,
    maxRounds: s.maxRounds,
    patchText: s.patchText || null,
    logs: s.logs || null,
    prUrl: s.prUrl || null,
    branch: s.branch || null,
    usageInput: s.usageInput || 0,
    usageOutput: s.usageOutput || 0,
    costUsd: s.costUsd || 0,
  };
  if (s.status === 'FAILED' && typeof s.logs === 'string' && s.logs.includes('NON_DIFF_OUTPUT')) {
    out.hint = 'Clicked Retry as diff to convert.';
  }
  res.json(out);
});

router.post('/retry-convert', requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'admin_only' });
  const { sessionId } = (req.body || {}) as { sessionId: string };
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const session = await prisma.aiSession.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ error: 'not_found' });
  if (session.status !== 'FAILED' || !session.logs || !session.logs.includes('NON_DIFF_OUTPUT')) {
    return res.status(400).json({ error: 'not_in_non_diff_output_state' });
  }
  // Get last assistant output (simulate as logs for now)
  const lastOutput = String(session.patchText || session.logs || '').slice(0, 20000);
  // Compose convert-to-diff prompt
  const convertMsg = `\nYour last output was not a unified diff.\nConvert it into a SINGLE unified diff now.\nFollow the CONTRACT exactly. Do not add explanations.\n`;
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const { send } = await import('../../services/ai/openai');
  const { isUnifiedDiff, ensureDiffPrefixes } = await import('../../services/ai/diffContract');
  const reply = await send(model, messages.concat({role:"user", content: convertMsg + "\n\n<<BEGIN-OUTPUT>>\n" + lastOutput + "\n<<END-OUTPUT>>"}), { temperature: 0.2, max_tokens: 3000 });
  const txt = reply.text.replace(/^```diff\n?|```$/g, '').trim();
  let finalTxt = '';
  if (!isUnifiedDiff(txt)) {
    await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'FAILED', logs: 'NON_DIFF_OUTPUT', rounds: session.rounds + 1 } });
    return res.json({ ok: false, error: 'still not unified diff' });
  }
  finalTxt = ensureDiffPrefixes(txt);
  // Resume normal flow: update patchText, status, and set to READY
  await prisma.aiSession.update({ where: { id: sessionId }, data: { patchText: finalTxt, status: 'READY', logs: 'converted to unified diff', rounds: session.rounds + 1 } });
  res.json({ ok: true });
});

export default router;
