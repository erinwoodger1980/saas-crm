import { prisma } from "../prisma";

type SupportedField = "blanksDateOrdered" | "doorPaperworkStatus";

interface LinkedFieldMeta {
  type: "fireDoorField";
  projectId: string;
  field: SupportedField;
}

function isLinkedFieldMeta(meta: any): meta is LinkedFieldMeta {
  return (
    meta &&
    typeof meta === "object" &&
    meta.type === "fireDoorField" &&
    typeof meta.projectId === "string" &&
    (meta.field === "blanksDateOrdered" || meta.field === "doorPaperworkStatus")
  );
}

export async function markLinkedProjectFieldFromTaskCompletion(params: {
  tenantId: string;
  taskId: string;
}): Promise<void> {
  const { tenantId, taskId } = params;

  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId },
    select: { meta: true },
  });
  if (!task) return;

  const meta = task.meta as any;
  if (!isLinkedFieldMeta(meta?.linkedField)) return;

  const { projectId, field } = meta.linkedField;

  try {
    if (field === "blanksDateOrdered") {
      await prisma.fireDoorScheduleProject.updateMany({
        where: { id: projectId, tenantId, OR: [{ blanksDateOrdered: null }, {}] },
        data: { blanksDateOrdered: new Date() },
      });
    } else if (field === "doorPaperworkStatus") {
      await prisma.fireDoorScheduleProject.updateMany({
        where: { id: projectId, tenantId },
        data: { doorPaperworkStatus: "Printed in Office" },
      });
    }
  } catch (e) {
    console.warn("[fire-door-link] Failed to update project field from task completion:", (e as any)?.message || e);
  }
}

export async function completeLinkedTasksForProjectFieldUpdate(params: {
  tenantId: string;
  projectId: string;
  changed: Partial<Record<SupportedField, any>>;
}): Promise<void> {
  const { tenantId, projectId, changed } = params;

  const now = new Date();

  const fieldsToCheck: SupportedField[] = [
    "blanksDateOrdered",
    "doorPaperworkStatus",
  ];

  for (const field of fieldsToCheck) {
    if (!(field in changed)) continue;

    // Only complete tasks when field has a meaningful value
    const val = (changed as any)[field];
    if (val === undefined || val === null || val === "") continue;

    try {
      await prisma.task.updateMany({
        where: {
          tenantId,
          status: { not: "DONE" as any },
          meta: {
            path: ["linkedField", "type"],
            equals: "fireDoorField",
          } as any,
          AND: [
            {
              meta: { path: ["linkedField", "projectId"], equals: projectId } as any,
            },
            {
              meta: { path: ["linkedField", "field"], equals: field } as any,
            },
          ],
        },
        data: {
          status: "DONE" as any,
          completedAt: now,
          autoCompleted: true,
        },
      });
    } catch (e) {
      console.warn("[fire-door-link] Failed to auto-complete linked tasks:", field, (e as any)?.message || e);
    }
  }
}
