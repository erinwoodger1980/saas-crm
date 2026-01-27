// api/src/routes/network.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();
const db = prisma as any;

function getAuth(req: any) {
  const tenantId = req.auth?.tenantId as string | undefined;
  const userId = req.auth?.userId as string | undefined;
  if (!tenantId || !userId) return null;
  return { tenantId, userId };
}

function getNetworkSlug(input?: unknown) {
  const fallback = process.env.TJN_NETWORK_SLUG || "the-joinery-network";
  const slug = typeof input === "string" && input.trim() ? input.trim() : process.env.TJN_NETWORK_SLUG || "the-joinery-network";
  return slug;
}

async function getNetworkBySlug(slug: string) {
  return db.network.findUnique({ where: { slug } });
}

async function getNetworkOwnerAssignees(networkTenantId: string) {
  const users = (await db.user.findMany({
    where: {
      tenantId: networkTenantId,
      OR: [
        { role: { in: ["owner", "admin"] } },
        { isOwner: true },
        { isDeveloper: true },
      ],
    },
    select: { id: true },
  })) as Array<{ id: string }>;
  const ids: string[] = [];
  for (const u of users) ids.push(String(u.id));
  return ids;
}

router.post("/authorisation/request", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const slug = getNetworkSlug(req.body?.networkSlug);
    const network = await getNetworkBySlug(slug);
    if (!network) return res.status(404).json({ error: "network_not_found" });

    if (network.tenantId === auth.tenantId) {
      return res.status(400).json({ error: "cannot_request_own_network" });
    }

    const [tenant, existing] = await Promise.all([
      db.tenant.findUnique({ where: { id: auth.tenantId }, select: { id: true, name: true, slug: true } }),
      db.networkMember.findUnique({
        where: {
          networkId_tenantId: {
            networkId: network.id,
            tenantId: auth.tenantId,
          },
        },
      }),
    ]);

    let member = existing;
    if (existing && existing.status === "AUTHORISED") {
      return res.json({ ok: true, status: existing.status, member: existing });
    }

    if (existing?.status === "AUTHORISED") {
      return res.json({ ok: true, member: existing });
    }

    if (existing) {
      member = await db.networkMember.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          requestedByUserId: auth.userId,
          requestedAt: new Date(),
          approvedByUserId: null,
          approvedAt: null,
          revokedAt: null,
        },
      });
    } else {
      member = await db.networkMember.create({
        data: {
          networkId: network.id,
          tenantId: auth.tenantId,
          status: "PENDING",
          requestedByUserId: auth.userId,
          requestedAt: new Date(),
          approvedByUserId: null,
          approvedAt: null,
          revokedAt: null,
        },
      });
    }

    if (!member.taskId) {
      const assigneeIds: string[] = await getNetworkOwnerAssignees(network.tenantId);
      const task = await db.task.create({
        data: {
          tenantId: network.tenantId,
          title: `TJN Authorisation request: ${tenant?.name || auth.tenantId}`,
          description: `Tenant ${tenant?.name || auth.tenantId} (${tenant?.slug || auth.tenantId}) requested TJN authorisation.`,
          relatedType: "OTHER",
          status: "OPEN",
          priority: "MEDIUM",
          meta: {
            networkMemberId: member.id,
            requestingTenantId: auth.tenantId,
            requestingTenantName: tenant?.name,
            requestingTenantSlug: tenant?.slug,
            requestingUserId: auth.userId,
          },
          assignees: assigneeIds.length
            ? {
                create: assigneeIds.reduce((list: Array<{ userId: string; role: string }>, userId) => {
                  list.push({ userId: String(userId), role: "OWNER" });
                  return list;
                }, []),
              }
            : undefined,
        },
      });

      member = await db.networkMember.update({
        where: { id: member.id },
        data: { taskId: task.id },
      });
    }

    return res.json({ ok: true, member });
  } catch (e: any) {
    console.error("[/network/authorisation/request] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.get("/authorisation/me", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const slug = getNetworkSlug(req.query?.networkSlug);
    const network = await getNetworkBySlug(slug);
    if (!network) return res.status(404).json({ error: "network_not_found" });

    const member = await db.networkMember.findUnique({
      where: {
        networkId_tenantId: { networkId: network.id, tenantId: auth.tenantId },
      },
    });

    return res.json({ ok: true, member });
  } catch (e: any) {
    console.error("[/network/authorisation/me] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.get("/authorisation/requests", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const slug = getNetworkSlug(req.query?.networkSlug);
    const network = await getNetworkBySlug(slug);
    if (!network) return res.status(404).json({ error: "network_not_found" });

    if (network.tenantId !== auth.tenantId) {
      return res.status(403).json({ error: "forbidden" });
    }

    const status = typeof req.query?.status === "string" ? req.query.status : undefined;
    const items = await db.networkMember.findMany({
      where: {
        networkId: network.id,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        requestedBy: { select: { id: true, email: true, name: true } },
        approvedBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: [{ requestedAt: "desc" }],
    });

    return res.json({ ok: true, items });
  } catch (e: any) {
    console.error("[/network/authorisation/requests] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/authorisation/:id/approve", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const member = await db.networkMember.findUnique({ where: { id: String(req.params.id) } });
    if (!member) return res.status(404).json({ error: "not_found" });

    const network = await db.network.findUnique({ where: { id: member.networkId } });
    if (!network) return res.status(404).json({ error: "network_not_found" });

    if (network.tenantId !== auth.tenantId) {
      return res.status(403).json({ error: "forbidden" });
    }

    const updated = await db.networkMember.update({
      where: { id: member.id },
      data: {
        status: "AUTHORISED",
        approvedByUserId: auth.userId,
        approvedAt: new Date(),
      },
    });

    if (member.taskId) {
      await db.task.update({
        where: { id: member.taskId },
        data: { status: "DONE", completedAt: new Date() },
      });
    }

    return res.json({ ok: true, member: updated });
  } catch (e: any) {
    console.error("[/network/authorisation/:id/approve] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/authorisation/:id/reject", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const member = await db.networkMember.findUnique({ where: { id: String(req.params.id) } });
    if (!member) return res.status(404).json({ error: "not_found" });

    const network = await db.network.findUnique({ where: { id: member.networkId } });
    if (!network) return res.status(404).json({ error: "network_not_found" });

    if (network.tenantId !== auth.tenantId) {
      return res.status(403).json({ error: "forbidden" });
    }

    const updated = await db.networkMember.update({
      where: { id: member.id },
      data: {
        status: "REJECTED",
        approvedByUserId: auth.userId,
        approvedAt: new Date(),
      },
    });

    if (member.taskId) {
      await db.task.update({
        where: { id: member.taskId },
        data: { status: "DONE", completedAt: new Date() },
      });
    }

    return res.json({ ok: true, member: updated });
  } catch (e: any) {
    console.error("[/network/authorisation/:id/reject] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
