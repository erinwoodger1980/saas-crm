// api/src/services/automation.ts
import { prisma } from "../prisma";
import type { AutomationRule } from "@prisma/client";

export type AppEvent =
  | { type: "LEAD_STATUS_CHANGED"; tenantId: string; leadId: string; to: string; actorId?: string }
  | { type: "QUOTE_SENT"; tenantId: string; quoteId: string; actorId?: string }
  | { type: "EMAIL_RECEIVED"; tenantId: string; leadId?: string; opportunityId?: string; actorId?: string }
  | { type: "QUESTIONNAIRE_SUBMITTED"; tenantId: string; leadId: string; actorId?: string }
  | { type: "ESTIMATE_APPROVED"; tenantId: string; projectId: string; actorId?: string };

function roleToUserId(_tenantId: string, from: string): string | undefined {
  // Minimal stub: map symbolic roles to someone deterministic.
  // Replace with your own tenant role mapping.
  // e.g., query TenantSettings or Users with role field.
  switch (from) {
    case "SalesOwner":
      return undefined; // let UI/ingest supply an explicit assignee later
    case "Estimator":
      return undefined;
    case "PM":
      return undefined;
    case "Ops":
      return undefined;
    default:
      return undefined;
  }
}

export async function applyRulesForEvent(evt: AppEvent) {
  // 1) Load enabled rules for this tenant
  const rules = await prisma.automationRule.findMany({
    where: { tenantId: evt.tenantId, enabled: true },
  });

  // 2) Match event to rules naively (JSON trigger match)
  const matched = rules.filter((r) => {
    const trig = (r.trigger as any) || {};
    if (trig.type !== evt.type) return false;
    if (evt.type === "LEAD_STATUS_CHANGED" && trig.to && trig.to !== (evt as any).to) return false;
    if (evt.type === "EMAIL_RECEIVED" && trig.from && trig.from !== "LEAD") return false;
    return true;
  });

  const createdTaskIds: string[] = [];

  // 3) For each matched rule, create a task per the actions
  for (const r of matched) {
    const actions = (r.actions as any) || {};
    const createTask = actions.createTask as { title: string; relatedType: string } | undefined;
    if (!createTask) continue;

    const dueAt = (() => {
      if (actions.dueToday) return new Date();
      if (typeof actions.setDueInDays === "number") {
        const d = new Date();
        d.setDate(d.getDate() + actions.setDueInDays);
        return d;
      }
      return undefined;
    })();

    // Infer relatedId from event
    const relatedId =
      (evt as any).leadId ||
      (evt as any).quoteId ||
      (evt as any).projectId ||
      undefined;

    const task = await prisma.task.create({
      data: {
        tenantId: evt.tenantId,
        title: createTask.title,
        relatedType: (createTask.relatedType || "OTHER") as any,
        relatedId,
        status: "OPEN",
        priority: (actions.priority || "MEDIUM") as any,
        dueAt,
        autocreated: true,
        createdById: evt.actorId,
        meta: { ruleId: r.id, sourceEvent: evt.type } as any,
      },
    });

    // Assign owners from action hints if resolvable
    const assignRoles = (actions.assignRoles as Array<{ role: "OWNER" | "FOLLOWER"; from: string }>) || [];
    if (assignRoles.length) {
      await prisma.taskAssignee.createMany({
        data: assignRoles
          .map((a) => {
            const uid = roleToUserId(evt.tenantId, a.from);
            return uid ? { taskId: task.id, userId: uid, role: a.role } : null;
          })
          .filter(Boolean) as any[],
      });
    }

    await prisma.activityLog.create({
      data: {
        tenantId: evt.tenantId,
        entity: "TASK",
        entityId: task.id,
        verb: "CREATED",
        actorId: evt.actorId,
        data: { byRule: r.name } as any,
      },
    });

    createdTaskIds.push(task.id);
  }

  return { matchedRuleCount: matched.length, createdTaskIds };
}