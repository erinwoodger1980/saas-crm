// api/src/services/scheduler.ts
import cron from "node-cron";
import { sendDailyDigestsToAllUsers } from "./task-digest";
import { sendWeeklyFireDoorScheduleSnapshotEmails } from "./fire-door-schedule-snapshot-email";

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduler(): void {
  console.log("[scheduler] Initializing scheduled jobs...");

  // Daily task digest - weekdays at 9:00 AM (UK time)
  // Cron format: minute hour day month weekday
  // 0 9 * * 1-5 = 9:00 AM Monday-Friday
  cron.schedule(
    "0 9 * * 1-5",
    async () => {
      console.log("[scheduler] Running daily task digest job");
      try {
        await sendDailyDigestsToAllUsers();
      } catch (error: any) {
        console.error("[scheduler] Daily digest job failed:", error.message);
      }
    },
    {
      timezone: "Europe/London", // UK timezone
    }
  );

  console.log("[scheduler] ✅ Daily task digest scheduled for weekdays at 9:00 AM UK time");

  // Fire Door Schedule Snapshot notifications
  // Runs every minute and checks tenant-configured day/time/frequency.
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        await sendWeeklyFireDoorScheduleSnapshotEmails(new Date());
      } catch (error: any) {
        console.error("[scheduler] Fire door snapshot job failed:", error?.message || error);
      }
    },
    {
      timezone: "Europe/London",
    }
  );

  console.log("[scheduler] ✅ Fire door snapshot notifications scheduled (every minute, Europe/London)");
}

/**
 * Manually trigger daily digest (for testing)
 */
export async function triggerDailyDigestNow(): Promise<void> {
  console.log("[scheduler] Manually triggering daily task digest");
  await sendDailyDigestsToAllUsers();
}
