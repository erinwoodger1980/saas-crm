import { prisma } from "../prisma";

export type CompletionCondition =
  | { kind: "NON_NULL" }
  | { kind: "EQUALS"; value: any }
  | { kind: "DATE_SET" };

export type OnTaskCompleteAction =
  | { kind: "SET_NOW" }
  | { kind: "SET_VALUE"; value: any }
  | { kind: "SET_TRUE" };

export interface FieldLink {
  id: string;
  tenantId: string;
  model: string;
  fieldPath: string;
  label?: string | null;
  completionCondition?: CompletionCondition | null;
  onTaskComplete?: OnTaskCompleteAction | null;
}

function getModelUpdater(model: string) {
  switch (model) {
    case "Lead":
      return prisma.lead;
    case "Opportunity":
      return prisma.opportunity;
    case "Quote":
      return prisma.quote;
    case "FireDoorScheduleProject":
      return prisma.fireDoorScheduleProject as any;
    default:
      return null;
  }
}

function shouldCompleteFromCondition(cond: CompletionCondition | null | undefined, value: any): boolean {
  if (!cond) return false;
  if (cond.kind === "NON_NULL") return value !== null && value !== undefined && value !== "";
  if (cond.kind === "EQUALS") return value === (cond as any).value;
  if (cond.kind === "DATE_SET") return value instanceof Date || (!!value && !Number.isNaN(Date.parse(value)));
  return false;
}

function nextFieldValueFromAction(action: OnTaskCompleteAction | null | undefined): any {
  if (!action) return undefined;
  if (action.kind === "SET_NOW") return new Date();
  if (action.kind === "SET_VALUE") return (action as any).value;
  if (action.kind === "SET_TRUE") return true;
  return undefined;
}

export async function applyFieldLinkOnTaskComplete(params: {
  tenantId: string;
  taskId: string;
}): Promise<void> {
  const { tenantId, taskId } = params;

  const task = await prisma.task.findFirst({ where: { id: taskId, tenantId }, select: { meta: true } });
  const meta = (task?.meta as any) || {};
  const lf = meta.linkedField;
  if (!lf || lf.type !== "fieldLink" || !lf.linkId || !lf.recordId) return;

  const link = await (prisma as any).taskFieldLink.findFirst({ where: { id: lf.linkId, tenantId } });
  if (!link) return;

  const updater = getModelUpdater(link.model);
  if (!updater) return;

  const newVal = nextFieldValueFromAction(link.onTaskComplete || null);
  if (typeof newVal === "undefined") return; // no write-back action configured

  try {
    await updater.update({
      where: { id: lf.recordId },
      data: { [link.fieldPath]: newVal } as any,
    });
  } catch (e) {
    console.warn("[field-link] failed to apply onTaskComplete action:", (e as any)?.message || e);
  }
}

export async function completeTasksOnRecordChangeByLinks(params: {
  tenantId: string;
  model: string;
  recordId: string;
  changed: Record<string, any>;
  newRecord?: any;
}): Promise<void> {
  const { tenantId, model, recordId, changed, newRecord } = params;

  const links = await (prisma as any).taskFieldLink.findMany({ where: { tenantId, model } });
  if (!links?.length) return;

  const now = new Date();

  for (const link of links as FieldLink[]) {
    const field = link.fieldPath;
    if (!(field in changed)) continue;

    const val = changed[field];
    const ok = shouldCompleteFromCondition(link.completionCondition || null, val);
    if (!ok) continue;

    try {
      await prisma.task.updateMany({
        where: {
          tenantId,
          status: { not: "DONE" as any },
          meta: { path: ["linkedField", "type"], equals: "fieldLink" } as any,
          AND: [
            { meta: { path: ["linkedField", "linkId"], equals: link.id } as any },
            { meta: { path: ["linkedField", "recordId"], equals: recordId } as any },
          ],
        },
        data: { status: "DONE" as any, completedAt: now, autoCompleted: true },
      });
    } catch (e) {
      console.warn("[field-link] failed to auto-complete tasks for record change:", (e as any)?.message || e);
    }
  }
}
