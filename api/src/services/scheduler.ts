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

  // Weekly Fire Door Schedule Snapshot - Mondays at 9:00 AM (UK time)
  // 0 9 * * 1 = 9:00 AM Monday
  cron.schedule(
    "0 9 * * 1",
    async () => {
      console.log("[scheduler] Running weekly fire door schedule snapshot email job");
      try {
        await sendWeeklyFireDoorScheduleSnapshotEmails();
      } catch (error: any) {
        console.error("[scheduler] Weekly fire door snapshot job failed:", error?.message || error);
      }
    },
    {
      timezone: "Europe/London",
    }
  );

  console.log("[scheduler] ✅ Weekly fire door snapshot scheduled for Mondays at 9:00 AM UK time");
}

/**
 * Manually trigger daily digest (for testing)
 */
export async function triggerDailyDigestNow(): Promise<void> {
  console.log("[scheduler] Manually triggering daily task digest");
  await sendDailyDigestsToAllUsers();
}
