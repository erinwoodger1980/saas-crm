import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma';

const router = Router();

function ensureDeveloper(req: any, res: any, next: any) {
  const isDev = req.auth?.user?.isDeveloper || req.auth?.isDeveloper;
  if (!isDev) return res.status(403).json({ ok: false, error: 'forbidden' });
  next();
}

// List all developer users
router.get('/', ensureDeveloper, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isDeveloper: true },
      select: { id: true, email: true, isDeveloper: true, role: true }
    });
    res.json({ ok: true, developers: users });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: 'failed_to_list', detail: e?.message });
  }
});

// Add or promote a user to developer
router.post('/', ensureDeveloper, async (req: any, res) => {
  try {
    const { email, name } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ ok: false, error: 'email_required' });
    }
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      return res.status(400).json({ ok: false, error: 'email_invalid' });
    }

    const existing = await prisma.user.findFirst({ where: { email: normalized } });
    if (existing) {
      const updated = existing.isDeveloper
        ? existing
        : await prisma.user.update({ where: { id: existing.id }, data: { isDeveloper: true, role: 'owner' } });
      return res.status(200).json({ ok: true, item: { id: updated.id, email: updated.email, promoted: !existing.isDeveloper } });
    }

    // Create global developer user without tenant association (requires later linking)
    // We will create against a template tenant if available for permissions; else first tenant.
    const anyTenant = await prisma.tenant.findFirst({ select: { id: true } });
    if (!anyTenant) return res.status(500).json({ ok: false, error: 'no_tenant_available' });

    const passwordHash = await bcrypt.hash('DevAccess123!', 10);
    const created = await prisma.user.create({
      data: {
        tenantId: anyTenant.id,
        email: normalized,
        name: name && typeof name === 'string' ? name.trim() : 'Developer User',
        role: 'owner',
        isDeveloper: true,
        signupCompleted: true,
        passwordHash,
      },
      select: { id: true, email: true }
    });
    res.status(201).json({ ok: true, item: { id: created.id, email: created.email, created: true } });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: 'failed_to_add', detail: e?.message });
  }
});

export default router;
