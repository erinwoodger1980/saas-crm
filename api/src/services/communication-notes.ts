import { prisma } from "../prisma";

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function formatDateTime(dt: Date): string {
  // Simple, sortable, user-friendly (local time)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(
    dt.getMinutes()
  )}`;
}

function normalizeActorName(raw: string | null | undefined): string {
  if (!raw) return "";

  let name = String(raw);

  // Remove dev access marker(s) appended to impersonation users.
  name = name.replace(/\s*\(Dev Access\)\s*/gi, " ");

  // Collapse whitespace after removals.
  name = name.replace(/\s+/g, " ").trim();

  // Drop trailing role labels if they were appended to the name.
  // Keep this conservative: only remove a single known token at the end.
  name = name.replace(/\s+(admin|owner|developer)\b$/i, "").trim();

  return name;
}

export function formatCommunicationEntry(args: {
  completedAt: Date;
  actorName?: string | null;
  communicationType?: string | null;
  communicationDirection?: string | null;
  communicationChannel?: string | null;
  communicationNotes?: string | null;
  freeTextFallback?: string;
}): string {
  const when = formatDateTime(args.completedAt);
  const actorName = normalizeActorName(args.actorName);
  const notes = (args.communicationNotes || args.freeTextFallback || "").toString().trim();
  const actorBit = actorName ? ` — ${actorName}` : "";

  // Keep this intentionally compact for readability in the lead modal.
  return `${when}${actorBit}: ${notes}`.trim();
}

export async function prependLeadCommunicationNotes(args: {
  tenantId: string;
  leadId: string;
  entry: string;
}): Promise<{ updatedNotes: string } | null> {
  const { tenantId, leadId, entry } = args;
  const trimmed = String(entry || "").trim();
  if (!trimmed) return null;

  const lead = await prisma.lead.findFirst({
    where: { tenantId, id: leadId },
    select: { id: true, custom: true },
  });
  if (!lead) return null;

  const prevCustom = isObject(lead.custom) ? (lead.custom as Record<string, any>) : {};
  const prev = typeof prevCustom.communicationNotes === "string" ? prevCustom.communicationNotes : "";
  const next = prev ? `${trimmed}\n\n${prev}` : trimmed;

  await prisma.lead.update({
    where: { id: leadId },
    data: { custom: { ...(prevCustom as any), communicationNotes: next } as any },
  });

  return { updatedNotes: next };
}

async function resolveLeadIdFromTaskRelated(args: {
  tenantId: string;
  relatedType: string;
  relatedId: string | null;
}): Promise<string | null> {
  const { tenantId, relatedType, relatedId } = args;
  if (!relatedId) return null;

  if (relatedType === "LEAD") return relatedId;
  if (relatedType === "PROJECT") {
    const opp = await prisma.opportunity.findFirst({
      where: { tenantId, id: relatedId },
      select: { leadId: true },
    });
    return opp?.leadId ? String(opp.leadId) : null;
  }

  return null;
}

export async function ensureCommunicationTaskLoggedToLeadNotes(args: {
  tenantId: string;
  taskId: string;
}): Promise<{ logged: boolean; leadId?: string; updatedNotes?: string }>{
  const { tenantId, taskId } = args;

  const task = await prisma.task.findFirst({
    where: { tenantId, id: taskId },
    select: {
      id: true,
      taskType: true,
      status: true,
      completedAt: true,
      completedBy: true,
      createdById: true,
      relatedType: true,
      relatedId: true,
      meta: true,
      communicationType: true,
      communicationDirection: true,
      communicationChannel: true,
      communicationNotes: true,
      description: true,
    },
  });

  if (!task) return { logged: false };
  if (task.status !== ("DONE" as any) || !task.completedAt) return { logged: false };

  const meta = isObject(task.meta) ? (task.meta as Record<string, any>) : {};
  if (meta.communicationLoggedToLeadNotes === true) {
    return { logged: false };
  }

  // Only log tasks that are actually communications
  const isCommunication = task.taskType === ("COMMUNICATION" as any) || !!task.communicationType;
  if (!isCommunication) return { logged: false };

  const leadId = await resolveLeadIdFromTaskRelated({
    tenantId,
    relatedType: String(task.relatedType),
    relatedId: task.relatedId ? String(task.relatedId) : null,
  });
  if (!leadId) return { logged: false };

  const actorUserId = (task.completedBy as any) ?? (task.createdById as any) ?? null;
  const actor = actorUserId
    ? await prisma.user.findFirst({ where: { id: String(actorUserId) }, select: { name: true } })
    : null;
  const actorName = actor?.name ? String(actor.name).trim() : null;

  const entry = formatCommunicationEntry({
    completedAt: task.completedAt,
    actorName,
    communicationType: (task.communicationType as any) ?? null,
    communicationDirection: (task.communicationDirection as any) ?? null,
    communicationChannel: (task.communicationChannel as any) ?? null,
    communicationNotes: (task.communicationNotes as any) ?? task.description ?? null,
  });

  const updated = await prependLeadCommunicationNotes({ tenantId, leadId, entry });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      meta: {
        ...(meta as any),
        communicationLoggedToLeadNotes: true,
        communicationLoggedAt: new Date().toISOString(),
        communicationLoggedLeadId: leadId,
      } as any,
    },
  });

  return { logged: true, leadId, updatedNotes: updated?.updatedNotes };
}
