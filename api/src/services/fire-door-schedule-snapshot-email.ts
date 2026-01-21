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

export async function sendWeeklyFireDoorScheduleSnapshotEmails(): Promise<void> {
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
      const notificationEmails = (t.notificationEmails || {}) as any;
      const toList = parseCommaEmails(notificationEmails.fireDoorScheduleSnapshot);
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
  <p style="margin:12px 0 0 0;font-size:12px;color:#64748b;">Sent automatically every Monday at 9am.</p>
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
