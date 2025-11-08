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

  const openaiKey = process.env.OPENAI_API_KEY || '';
  const stubDiff = (context: string) => {
    const now = new Date().toISOString();
    const body = [
      `This is a stub AI diff because OPENAI_API_KEY is not configured.`,
      `Time: ${now}`,
      `Template: ${taskKey}`,
      `Context: ${context.slice(0, 200)}`
    ].join("\n");
    // Simple, preview-only patch. Not intended for git apply.
    return [
      "*** Add File: web/AI_PATCH_STUB.txt",
      "+ " + body.replace(/\n/g, "\n+ ")
    ].join("\n");
  };

  try {
    const prompt = await buildPrompt(taskKey, fr, remainder || '');
    const diff = openaiKey ? await callOpenAI(prompt) : stubDiff(remainder || '');

    if (mode === 'dry-run' || mode === 'local') {
      return res.json({ ok: true, mode, patch: diff });
    }

    // mode === 'pr' => attempt to apply and open PR
    if (!openaiKey) {
      // Disallow PR flow without a real diff source
      return res.status(200).json({ ok: false, errors: ['OPENAI_API_KEY not set; PR mode disabled. Use dry-run to preview stub diff.'] });
    }
    const base = process.env.GIT_MAIN_BRANCH || 'main';
    const branchName = `feat/codex-${Date.now().toString(36)}`;
    try {
      await validateAndApplyDiff(diff, base, branchName);
      const checks = await runChecks();
      if (!checks.ok) {
        return res.status(200).json({ ok: false, errors: [checks.errors || 'checks_failed'], patch: diff, branchName });
      }
      const prUrl = await createBranchAndPR(branchName, fr.title, fr.description);
      return res.json({ ok: true, mode, patch: diff, branchName, prUrl });
    } catch (e: any) {
      return res.status(200).json({ ok: false, errors: [e?.message || String(e)], patch: diff });
    }
  } catch (e: any) {
    // Return 200 so the frontend can show the error details from body
    return res.status(200).json({ ok: false, errors: [e?.message || String(e)] });
  }
});

export default router;
