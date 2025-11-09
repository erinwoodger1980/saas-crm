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
  const out = {
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
  res.json(out);
});

export default router;
