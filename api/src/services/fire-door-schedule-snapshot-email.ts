import { prisma } from "../prisma";
import { sendEmailViaTenant } from "./email-sender";

const DEFAULT_LOCATIONS = [
  "ASSIGNED MJS",
  "RED FOLDER",
  "IN PROGRESS",
  "COMPLETE IN FACTORY",
  "N/A",
  "NOT LOOKED AT",
  "NO JOB ASSIGNED",
  "JOB IN DISPUTE / ISSUES",
  "CANCELLED",
];

const COLUMN_LABELS: Record<string, string> = {
  mjsNumber: "MJS",
  jobName: "Job Description",
  clientName: "Customer",
  netValue: "Net Value",
  poNumber: "PO",
  dateReceived: "Date Received",
  dateRequired: "Required",
  jobLocation: "Job Location",
  signOffStatus: "Sign Off Status",
  scheduledBy: "LAJ Scheduler",
  signOffDate: "Date Signed Off",
  leadTimeWeeks: "Lead Time (Weeks)",
  calculatedCompletionDate: "Calc Completion Date",
  workingDaysRemaining: "Approx Working Days Remaining",
  bomPercent: "BOM Progress",
  paperworkPercent: "Paperwork Progress",
  productionPercent: "Production Progress",
  blanksStatus: "Blanks Status",
  lippingsStatus: "Lippings Status",
  facingsStatus: "Facings Status",
  glassStatus: "Glass Status",
  cassettesStatus: "Cassettes Status",
  timbersStatus: "Timbers Status",
  ironmongeryStatus: "Ironmongery Status",
  doorPaperworkStatus: "Door Paperwork",
  finalCncSheetStatus: "Final CNC Sheet",
  finalChecksSheetStatus: "Final Checks Sheet",
  deliveryChecklistStatus: "Delivery Checklist",
  framesPaperworkStatus: "Frames Paperwork",
  paperworkComments: "Paperwork Comments",
  blanksCutPercent: "Blanks Cut %",
  edgebandPercent: "Edgeband %",
  calibratePercent: "Calibrate %",
  facingsPercent: "Facings %",
  finalCncPercent: "Final CNC %",
  finishPercent: "Finish %",
  sandPercent: "Sand %",
  sprayPercent: "Spray %",
  cutPercent: "Cut %",
  cncPercent: "CNC %",
  buildPercent: "Build %",
  overallProgress: "Progress",
  transportStatus: "Transport",
  doorSets: "Door Sets",
  leaves: "Leaves",
  delDateAgreedBy: "Del Date Agreed By",
  deliveryNotes: "Delivery Notes",
  bomNotes: "Notes",
};

function parseCommaEmails(input: unknown): string[] {
  if (typeof input !== "string") return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((e) => /.+@.+\..+/.test(e));
}

function uniqEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const v = String(e || "").trim().toLowerCase();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function normalizeNotificationConfig(raw: any): any {
  const n = raw && typeof raw === "object" ? raw : {};
  const notifications = Array.isArray(n.notifications) ? n.notifications : [];
  const snapshot = notifications.find((x: any) => x && x.key === "fireDoorScheduleSnapshot");
  // Backwards compatibility: if no row exists, fall back to legacy string field.
  if (snapshot) return snapshot;
  return {
    key: "fireDoorScheduleSnapshot",
    description: "Fire Door Schedule Snapshot",
    dayOfWeek: "MON",
    time: "09:00",
    frequency: "WEEKLY",
    toEmails: typeof n.fireDoorScheduleSnapshot === "string" ? n.fireDoorScheduleSnapshot : "",
    allUsers: false,
    userIds: [],
  };
}

function dayOfWeekLondon(d: Date): "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" {
  // Note: scheduler runs in Europe/London timezone; this mapping assumes d is already in that timezone.
  const map = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
  return map[d.getDay()];
}

function hhmm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isDueNow(config: any, now: Date): boolean {
  const freq = String(config?.frequency || "WEEKLY").toUpperCase();
  const time = String(config?.time || "09:00");
  if (time !== hhmm(now)) return false;
  if (freq === "DAILY") return true;
  const dow = String(config?.dayOfWeek || "MON").toUpperCase();
  return dow === dayOfWeekLondon(now);
}

async function resolveRecipientEmails(tenantId: string, config: any): Promise<string[]> {
  const manual = parseCommaEmails(config?.toEmails);

  const allUsers = !!config?.allUsers;
  const userIds: string[] = Array.isArray(config?.userIds) ? config.userIds.map((x: any) => String(x)) : [];

  let userEmails: string[] = [];
  if (allUsers) {
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { email: true },
    });
    userEmails = users.map((u) => u.email).filter(Boolean) as any;
  } else if (userIds.length) {
    const users = await prisma.user.findMany({
      where: { tenantId, id: { in: userIds } },
      select: { email: true },
    });
    userEmails = users.map((u) => u.email).filter(Boolean) as any;
  }

  return uniqEmails([...manual, ...userEmails]);
}

function formatValue(field: string, value: any): string {
  if (value == null) return "";
  if (field === "netValue") {
    const num = Number(value);
    if (Number.isFinite(num)) return `£${num.toFixed(2)}`;
    return String(value);
  }
  if (field.toLowerCase().includes("date")) {
    try {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-GB");
    } catch {
      // fall through
    }
  }
  if (field.toLowerCase().includes("percent") || field === "overallProgress") {
    const num = Number(value);
    if (Number.isFinite(num)) return `${Math.round(num)}%`;
  }
  return String(value);
}

function resolveSnapshotColumns(tenantColumnConfig: any): string[] {
  const cfg = tenantColumnConfig?.SNAPSHOT;
  if (Array.isArray(cfg) && cfg.length > 0) {
    return cfg.filter((c: any) => c && c.visible).map((c: any) => String(c.field)).filter(Boolean);
  }

  // Default snapshot columns mirrors the Production tab defaults in the web UI.
  return [
    "mjsNumber",
    "clientName",
    "jobName",
    "blanksCutPercent",
    "edgebandPercent",
    "calibratePercent",
    "facingsPercent",
    "finalCncPercent",
    "finishPercent",
    "sandPercent",
    "sprayPercent",
    "cutPercent",
    "cncPercent",
    "buildPercent",
    "overallProgress",
    "transportStatus",
    "doorSets",
    "leaves",
    "deliveryNotes",
  ];
}

function buildHtmlTable(columns: string[], rows: Array<Record<string, any>>): string {
  const safeCols = columns.filter(Boolean);

  const ths = safeCols
    .map((c) => `<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;background:#f8fafc;font-size:12px;">${escapeHtml(COLUMN_LABELS[c] || c)}</th>`)
    .join("");

  const trs = rows
    .map((row) => {
      const tds = safeCols
        .map((c) => `<td style="padding:8px;border-bottom:1px solid #f1f5f9;font-size:12px;vertical-align:top;">${escapeHtml(formatValue(c, (row as any)[c]))}</td>`)
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `
<table style="width:100%;border-collapse:collapse;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
  <thead><tr>${ths}</tr></thead>
  <tbody>${trs}</tbody>
</table>`;
}

function escapeHtml(input: any): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendWeeklyFireDoorScheduleSnapshotEmails(now: Date = new Date()): Promise<void> {
  const tenants = await prisma.tenantSettings.findMany({
    where: { isFireDoorManufacturer: true },
    select: {
      tenantId: true,
      brandName: true,
      notificationEmails: true,
      fireDoorScheduleColumnConfig: true,
    },
  });

  for (const t of tenants) {
    try {
      const snapshotCfg = normalizeNotificationConfig((t.notificationEmails || {}) as any);
      if (!isDueNow(snapshotCfg, now)) continue;
      const toList = await resolveRecipientEmails(t.tenantId, snapshotCfg);
      if (toList.length === 0) continue;

      const columns = resolveSnapshotColumns(t.fireDoorScheduleColumnConfig);

      const projects = await prisma.fireDoorScheduleProject.findMany({
        where: {
          tenantId: t.tenantId,
          OR: [
            { jobLocation: { in: DEFAULT_LOCATIONS } },
            { jobLocation: null },
          ],
        },
        orderBy: { dateRequired: "asc" },
        take: 1000,
      });

      const html = `
<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
  <p style="margin:0 0 12px 0;font-size:14px;">Weekly Fire Door Schedule Snapshot for <strong>${escapeHtml(t.brandName || "")}</strong></p>
  ${buildHtmlTable(columns, projects as any)}
  <p style="margin:12px 0 0 0;font-size:12px;color:#64748b;">Sent automatically based on your Notification Emails settings.</p>
</div>`;

      await sendEmailViaTenant(t.tenantId, {
        to: toList.join(", "),
        subject: `Fire Door Schedule Snapshot — ${new Date().toLocaleDateString("en-GB")}`,
        body: "Weekly Fire Door Schedule Snapshot",
        html,
      });
    } catch (e: any) {
      console.error("[fire-door-schedule-snapshot-email] Failed for tenant", t.tenantId, e?.message || e);
    }
  }
}
