import { Router } from "express";
import { prisma } from "../prisma"; // ✅ make prisma available

const router = Router();

/**
 * GET /gmail/connection
 * Returns the GmailTenantConnection (if it exists) for the current tenant.
 */
router.get("/connection", async (req, res) => {
  const auth = (req as any).auth;
  if (!auth?.tenantId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const connection = await prisma.gmailTenantConnection.findUnique({
      where: { tenantId: auth.tenantId },
    });
    res.json({ ok: true, connection });
  } catch (err: any) {
    console.error("[gmail] connection error:", err);
    res.status(500).json({ error: err.message || "unknown error" });
  }
});

export default router;
