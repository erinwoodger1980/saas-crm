import { prisma } from "../src/prisma";
import { applyFieldLinkOnTaskComplete, completeTasksOnRecordChangeByLinks } from "../src/services/field-link";

async function main() {
  console.log("[prod-test] Starting Field ↔ Task Link production test");

  // 1) Find an existing tenant and user
  const tenant = await prisma.tenant.findFirst({ where: { slug: { not: "demo" } } });
  if (!tenant) throw new Error("No tenant found");
  console.log(`[prod-test] Using tenant: ${tenant.name} (${tenant.id})`);

  const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
  if (!user) throw new Error("No user found for this tenant");
  console.log(`[prod-test] Using user: ${user.email} (${user.id})`);

  // 2) Find an existing Lead under this tenant
  let lead = await prisma.lead.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });
  if (!lead) {
    console.log("[prod-test] No lead found; creating one for test");
    lead = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        createdById: user.id,
        contactName: "Field Link Production Test Lead",
        status: "NEW" as any,
        custom: {},
      },
    });
  }
  console.log(`[prod-test] Using lead: ${lead.contactName} (${lead.id})`);

  // 3) Create Link A: complete tasks when deliveryDate becomes NON_NULL
  const linkA = await (prisma as any).taskFieldLink.create({
    data: {
      tenantId: tenant.id,
      model: "Lead",
      fieldPath: "deliveryDate",
      label: "Prod Test: Lead.deliveryDate triggers task done",
      completionCondition: { kind: "NON_NULL" },
    },
  });
  console.log(`[prod-test] Created linkA (${linkA.id}) for deliveryDate NON_NULL`);

  // 4) Create a task referencing linkA and the lead
  const taskA = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      title: "Prod Test: auto-complete on deliveryDate",
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
  console.log(`[prod-test] Created taskA (${taskA.id})`);

  // 5) Update Lead.custom.deliveryDate and invoke completion logic
  const newDelivery = new Date();
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { custom: { ...(lead.custom as any), deliveryDate: newDelivery.toISOString().slice(0, 10) } as any },
  });
  console.log(`[prod-test] Updated Lead.custom.deliveryDate to ${(updatedLead.custom as any).deliveryDate}`);

  await completeTasksOnRecordChangeByLinks({
    tenantId: tenant.id,
    model: "Lead",
    recordId: lead.id,
    changed: { deliveryDate: (updatedLead.custom as any)?.deliveryDate },
    newRecord: updatedLead,
  });

  const taskAAfter = await prisma.task.findUnique({ where: { id: taskA.id } });
  if ((taskAAfter as any)?.status !== "DONE") {
    throw new Error(`FAIL: taskA not completed. Status=${(taskAAfter as any)?.status}`);
  }
  console.log("[prod-test] ✅ PASS: Link completion (Lead.deliveryDate NON_NULL) auto-completed taskA.");

  // 6) Create Link B: on task complete, set Lead.dateQuoteSent = now
  const linkB = await (prisma as any).taskFieldLink.create({
    data: {
      tenantId: tenant.id,
      model: "Lead",
      fieldPath: "dateQuoteSent",
      label: "Prod Test: Task complete sets dateQuoteSent",
      onTaskComplete: { kind: "SET_NOW" },
    },
  });
  console.log(`[prod-test] Created linkB (${linkB.id}) for dateQuoteSent write-back`);

  const taskB = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      title: "Prod Test: write-back on complete",
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
  console.log(`[prod-test] Created taskB (${taskB.id})`);

  // Simulate completing the task -> apply write-back
  await prisma.task.update({ where: { id: taskB.id }, data: { status: "DONE" as any, completedAt: new Date() } });
  console.log("[prod-test] Marked taskB as DONE");

  await applyFieldLinkOnTaskComplete({ tenantId: tenant.id, taskId: taskB.id });
  console.log("[prod-test] Applied field write-back for taskB");

  const leadAfter = await prisma.lead.findUnique({ where: { id: lead.id }, select: { dateQuoteSent: true } });
  if (!leadAfter?.dateQuoteSent) {
    throw new Error("FAIL: dateQuoteSent was not set by task completion write-back");
  }
  console.log(`[prod-test] ✅ PASS: Task completion write-back set Lead.dateQuoteSent to ${leadAfter.dateQuoteSent}`);

  console.log("[prod-test] 🎉 SUCCESS: Field ↔ Task links working end-to-end in production");

  // Cleanup: delete the test resources
  console.log("[prod-test] Cleaning up test entities...");
  await prisma.task.deleteMany({ where: { id: { in: [taskA.id, taskB.id] } } });
  await (prisma as any).taskFieldLink.deleteMany({ where: { id: { in: [linkA.id, linkB.id] } } });
  console.log("[prod-test] Cleanup complete");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[prod-test] ❌ ERROR:", err?.message || err);
    process.exit(1);
  });
