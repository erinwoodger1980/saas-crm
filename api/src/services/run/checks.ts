import { runChecks as baseRunChecks } from '../../routes/ai/codex';

export async function runChecksWithLogs(): Promise<{ ok: boolean; logs: string[] }> {
  const res = await baseRunChecks();
  if (res.ok) return { ok: true, logs: (res.errors || '').split('\n') };
  return { ok: false, logs: (res.errors || '').split('\n') };
}
