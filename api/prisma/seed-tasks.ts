// saas-crm/api/prisma/seed-tasks.ts
import "dotenv/config"; // ensure DATABASE_URL is loaded
import { prisma } from "../src/prisma"; // <-- use the shared Prisma instance
import bcrypt from "bcrypt";

/* ---------------- Helpers ---------------- */
async function ensureDemoTenantAndUsers() {
  // Prefer an existing tenant; otherwise create a demo one.
  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Demo Tenant",
        seatsOffice: 5,
        seatsWorkshop: 10,
        seatsDisplay: 2,
      },
    });
  }

  // Grab two users in this tenant; create if none exist
  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    take: 2,
    orderBy: { id: "asc" },
  });

  if (users.length >= 2) {
    return { tenant, users };
  }

  const hash = await bcrypt.hash("changeme123", 10);
  const createdUsers = await prisma.$transaction([
    prisma.user.upsert({
      where: { email: "owner@example.com" },
      update: {},
      create: {
        tenantId: tenant.id,
        email: "owner@example.com",
        name: "Owner User",
        role: "owner", // keep as-is to match your current schema
        passwordHash: hash,
        signupCompleted: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "sales@example.com" },
      update: {},
      create: {
        tenantId: tenant.id,
        email: "sales@example.com",
        name: "Sales User",
        role: "sales",
        passwordHash: hash,
        signupCompleted: true,
      },
    }),
  ]);

  return { tenant, users: createdUsers };
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/* ---------------- Seeds ---------------- */
async function seedAutomationRules(tenantId: string) {
  const rules = [
    {
      name: "Lead → READY_TO_QUOTE → Prepare Quote (+2d)",
      trigger: { type: "LEAD_STATUS_CHANGED", to: "READY_TO_QUOTE" },
      actions: {
        createTask: { title: "Prepare quote", relatedType: "LEAD" },
        assignRoles: [{ role: "OWNER", from: "SalesOwner" }],
        setDueInDays: 2,
        priority: "HIGH",
      },
    },
    {
      name: "QUOTE_SENT → Follow-up (+3d)",
      trigger: { type: "QUOTE_SENT" },
      actions: {
        createTask: { title: "Follow-up on quote", relatedType: "QUOTE" },
        assignRoles: [{ role: "OWNER", from: "SalesOwner" }],
        setDueInDays: 3,
        priority: "MEDIUM",
      },
    },
    {
      name: "EMAIL_RECEIVED from Lead (no open reply) → Reply today",
      trigger: { type: "EMAIL_RECEIVED", from: "LEAD" },
      actions: {
        createTask: { title: "Reply to client", relatedType: "EMAIL" },
        assignRoles: [{ role: "OWNER", from: "SalesOwner" }],
        dueToday: true,
        priority: "HIGH",
      },
    },
    {
      name: "QUESTIONNAIRE_SUBMITTED → Scope review (+1d)",
      trigger: { type: "QUESTIONNAIRE_SUBMITTED" },
      actions: {
        createTask: { title: "Scope review", relatedType: "QUESTIONNAIRE" },
        assignRoles: [{ role: "OWNER", from: "Estimator" }, { role: "FOLLOWER", from: "PM" }],
        setDueInDays: 1,
        priority: "MEDIUM",
      },
    },
    {
      name: "ESTIMATE_APPROVED → Raise PO / Confirm schedule (+1d)",
      trigger: { type: "ESTIMATE_APPROVED" },
      actions: {
        createTask: { title: "Raise PO / Confirm schedule", relatedType: "PROJECT" },
        assignRoles: [{ role: "OWNER", from: "Ops" }],
        setDueInDays: 1,
        priority: "HIGH",
      },
    },
  ];

  for (const r of rules) {
    const stableId = `${tenantId}:${r.name}`.replace(/\s+/g, "_").slice(0, 24);
    await prisma.automationRule.upsert({
      where: { id: stableId },
      update: {
        tenantId,
        name: r.name,
        trigger: r.trigger as any,
        actions: r.actions as any,
        enabled: true,
      },
      create: {
        id: stableId,
        tenantId,
        name: r.name,
        trigger: r.trigger as any,
        actions: r.actions as any,
        enabled: true,
      },
    });
  }
}

async function seedTasksNotificationsStreaks(
  tenantId: string,
  users: { id: string; email: string }[]
) {
  const [u1, u2] = users;

  const tasksData = [
    {
      title: "Prepare quote",
      status: "OPEN",
      priority: "HIGH",
      dueAt: daysFromNow(-1),
      assignees: [{ userId: u1.id, role: "OWNER" }],
      meta: { seed: true },
      relatedType: "LEAD",
    },
    {
      title: "Reply to client",
      status: "OPEN",
      priority: "HIGH",
      dueAt: daysFromNow(0),
      assignees: [{ userId: u1.id, role: "OWNER" }],
      meta: { seed: true },
      relatedType: "EMAIL",
    },
    {
      title: "Follow-up on quote",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueAt: daysFromNow(2),
      assignees: [{ userId: u2.id, role: "OWNER" }],
      meta: { seed: true },
      relatedType: "QUOTE",
      startedAt: new Date(),
    },
    {
      title: "Scope review",
      status: "DONE",
      priority: "MEDIUM",
      dueAt: daysFromNow(-2),
      assignees: [{ userId: u2.id, role: "OWNER" }, { userId: u1.id, role: "FOLLOWER" }],
      meta: { seed: true },
      relatedType: "QUESTIONNAIRE",
      completedAt: new Date(),
    },
    {
      title: "Raise PO / Confirm schedule",
      status: "BLOCKED",
      priority: "HIGH",
      dueAt: daysFromNow(1),
      assignees: [{ userId: u1.id, role: "OWNER" }],
      meta: { seed: true, blockedOn: "Awaiting final measurements" },
      relatedType: "PROJECT",
    },
    {
      title: "Workshop handoff",
      status: "OPEN",
      priority: "LOW",
      dueAt: daysFromNow(4),
      assignees: [{ userId: u2.id, role: "OWNER" }],
      meta: { seed: true },
      relatedType: "WORKSHOP",
    },
  ] as const;

  for (const t of tasksData) {
    await prisma.task.create({
      data: {
        tenantId,
        title: t.title,
        status: t.status as any,
        priority: t.priority as any,
        dueAt: t.dueAt,
        startedAt: (t as any).startedAt ?? undefined,
        completedAt: (t as any).completedAt ?? undefined,
        meta: t.meta as any,
        relatedType: t.relatedType as any,
        autocreated: true,
        assignees: {
          create: t.assignees.map(a => ({ userId: a.userId, role: a.role as any })),
        },
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        tenantId,
        userId: u1.id,
        type: "TASK_ASSIGNED" as any,
        payload: { message: "You’ve been assigned: Prepare quote", seed: true } as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        userId: u1.id,
        type: "TASK_DUE_SOON" as any,
        payload: { message: "Reply to client is due today", seed: true } as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        userId: u1.id,
        type: "STREAK" as any,
        payload: { message: "Streak +1 — nice!", seed: true } as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  await prisma.streak.upsert({
    where: { tenantId_userId: { tenantId, userId: u1.id } },
    update: { dayCount: 3, lastActivityDate: new Date() },
    create: { tenantId, userId: u1.id, dayCount: 3, lastActivityDate: new Date() },
  });
}

/* ---------------- Main ---------------- */
async function main() {
  console.log(
    "⏳ Starting seed… (DATABASE_URL present: " + Boolean(process.env.DATABASE_URL) + ")"
  );
  const { tenant, users } = await ensureDemoTenantAndUsers();
  await seedAutomationRules(tenant.id);
  await seedTasksNotificationsStreaks(tenant.id, users as any);
  // Add questionnaire for Spittlywood tenant
  const spittlywoodTenant = await prisma.tenant.findFirst({ where: { name: { contains: "Spittlywood", mode: "insensitive" } } });
  if (spittlywoodTenant) {
    const { initializeTenantWithSeedData } = await import("../src/services/seed-template");
    await initializeTenantWithSeedData(spittlywoodTenant.id);
    console.log("✓ Questionnaire seeded for Spittlywood tenant");
  }
  console.log("✅ Seed complete:");
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`  Users: ${users.map(u => `${u.email}`).join(", ")}`);
  console.log("  + 5 rules, 6 tasks, 3 notifications, streak=3");
}

main()
  .catch((e) => {
    console.error("❌ Seed FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("ℹ️ Prisma disconnected");
  });
