import { Router } from "express";
import { buildPrompt, callOpenAI, validateAndApplyDiff, runChecks, createBranchAndPR } from "./ai/codex";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req?.auth?.userId) return res.status(401).json({ error: "unauthorized" });
  next();
}
function isAdmin(req: any): boolean {
  const role = String(req?.auth?.role || '').toLowerCase();
  return role === 'admin' || role === 'owner';
}

// POST /ai/codex/run
router.post('/run', requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'admin_only' });
  const { extraContext = '', files, mode = 'dry-run' } = (req.body || {}) as { extraContext?: string; files?: string[]; mode?: 'dry-run'|'pr'|'local' };

  // Extract task template key from leading token like [ads-lp-prod] description ...
  let taskKey = 'generic';
  let remainder = extraContext;
  const m = extraContext.match(/^\s*\[([^\]]+)\]\s*(.*)$/s);
  if (m) { taskKey = m[1].trim() || taskKey; remainder = m[2]; }

  // Fabricate a FeatureRequest-like object for prompt building
  const fr = {
    id: 'virtual',
    title: remainder.slice(0, 80) || 'AI Patch',
    description: remainder.slice(0, 400) || 'AI generated patch',
    allowedFiles: Array.isArray(files) && files.length ? files : undefined,
    priority: 2 as number | null
  };

  try {
    const prompt = await buildPrompt(taskKey, fr, remainder || '');
    const diff = await callOpenAI(prompt);

    if (mode === 'dry-run' || mode === 'local') {
      return res.json({ ok: true, mode, patch: diff });
    }

    // mode === 'pr' => attempt to apply and open PR
    const base = process.env.GIT_MAIN_BRANCH || 'main';
    const branchName = `feat/codex-${Date.now().toString(36)}`;
    try {
      await validateAndApplyDiff(diff, base, branchName);
      const checks = await runChecks();
      if (!checks.ok) {
        return res.status(400).json({ ok: false, errors: [checks.errors || 'checks_failed'], patch: diff, branchName });
      }
      const prUrl = await createBranchAndPR(branchName, fr.title, fr.description);
      return res.json({ ok: true, mode, patch: diff, branchName, prUrl });
    } catch (e: any) {
      return res.status(500).json({ ok: false, errors: [e?.message || String(e)], patch: diff });
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, errors: [e?.message || String(e)] });
  }
});

export default router;
