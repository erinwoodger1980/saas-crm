import { prisma } from "../src/prisma";
import { applyFieldLinkOnTaskComplete, completeTasksOnRecordChangeByLinks } from "../src/services/field-link";

async function main() {
  const nowTag = new Date().toISOString().replace(/[:.]/g, "-");
  console.log("[smoke] starting field-link smoke test at", nowTag);

  // 1) Create an isolated tenant + user
  const tenant = await prisma.tenant.create({ data: { name: `FieldLinkSmokeTest ${nowTag}`, slug: `fld-link-${Date.now().toString(36)}` } });
  const user = await prisma.user.create({ data: { tenantId: tenant.id, email: `smoke+${Date.now()}@test.local`, role: "owner" } as any });

  // 2) Create a Lead under this tenant
  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      createdById: user.id,
      contactName: "Smoke Test Lead",
      status: "NEW" as any,
      custom: {},
    },
  });

  // 3) Link A: complete tasks when deliveryDate becomes NON_NULL
  const linkA = await (prisma as any).taskFieldLink.create({
    data: {
      tenantId: tenant.id,
      model: "Lead",
      fieldPath: "deliveryDate",
      label: "Lead deliveryDate triggers task done",
      completionCondition: { kind: "NON_NULL" },
    },
  });

  // 4) Create a task referencing linkA and the lead record
  const taskA = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      title: "Smoke: auto-complete on deliveryDate",
      relatedType: "LEAD" as any,
      relatedId: lead.id,
      status: "OPEN" as any,
      meta: {
        linkedField: {
          type: "fieldLink",
          linkId: linkA.id,
          recordId: lead.id,
        },
      } as any,
    },
  });

  // 5) Update Lead.custom.deliveryDate, then invoke completion logic
  const newDelivery = new Date();
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { custom: { deliveryDate: newDelivery.toISOString().slice(0, 10) } as any },
  });
  await completeTasksOnRecordChangeByLinks({
    tenantId: tenant.id,
    model: "Lead",
    recordId: lead.id,
    changed: { deliveryDate: (updatedLead.custom as any)?.deliveryDate },
    newRecord: updatedLead,
  });

  const taskAAfter = await prisma.task.findUnique({ where: { id: taskA.id } });
  if ((taskAAfter as any)?.status !== "DONE") {
    throw new Error(`Smoke FAIL: taskA not completed. Status=${(taskAAfter as any)?.status}`);
  }
  console.log("[smoke] PASS: Link completion (Lead.deliveryDate NON_NULL) auto-completed the task.");

  // 6) Link B: on task complete, set Lead.dateQuoteSent = now
  const linkB = await (prisma as any).taskFieldLink.create({
    data: {
      tenantId: tenant.id,
      model: "Lead",
      fieldPath: "dateQuoteSent",
      label: "Task complete sets dateQuoteSent",
      onTaskComplete: { kind: "SET_NOW" },
    },
  });

  const taskB = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      title: "Smoke: write-back on complete",
      relatedType: "LEAD" as any,
      relatedId: lead.id,
      status: "OPEN" as any,
      meta: {
        linkedField: {
          type: "fieldLink",
          linkId: linkB.id,
          recordId: lead.id,
        },
      } as any,
    },
  });

  // Simulate completing the task -> apply write-back
  await prisma.task.update({ where: { id: taskB.id }, data: { status: "DONE" as any, completedAt: new Date() } });
  await applyFieldLinkOnTaskComplete({ tenantId: tenant.id, taskId: taskB.id });

  const leadAfter = await prisma.lead.findUnique({ where: { id: lead.id }, select: { dateQuoteSent: true } });
  if (!leadAfter?.dateQuoteSent) {
    throw new Error("Smoke FAIL: dateQuoteSent was not set by task completion write-back");
  }
  console.log("[smoke] PASS: Task completion write-back set Lead.dateQuoteSent");

  console.log("[smoke] SUCCESS: Field ↔ Task links working end-to-end");

  // Cleanup created rows to avoid polluting production DB
  try {
    await prisma.task.deleteMany({ where: { tenantId: tenant.id } });
    await (prisma as any).taskFieldLink.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.lead.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    console.log("[smoke] Cleanup complete");
  } catch (e) {
    console.warn("[smoke] Cleanup warning:", (e as any)?.message || e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[smoke] ERROR:", err?.message || err);
    process.exit(1);
  });
