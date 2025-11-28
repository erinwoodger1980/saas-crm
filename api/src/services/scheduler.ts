// api/src/services/scheduler.ts
import cron from "node-cron";
import { sendDailyDigestsToAllUsers } from "./task-digest";

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduler(): void {
  console.log("[scheduler] Initializing scheduled jobs...");

  // Daily task digest - weekdays at 9:00 AM (UK time)
  // Cron format: minute hour day month weekday
  // 0 9 * * 1-5 = 9:00 AM Monday-Friday
  const dailyDigestSchedule = cron.schedule(
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

  // Optional: Manual trigger endpoint for testing
  // This allows testing without waiting for 9am
  return {
    dailyDigest: dailyDigestSchedule,
  };
}

/**
 * Manually trigger daily digest (for testing)
 */
export async function triggerDailyDigestNow(): Promise<void> {
  console.log("[scheduler] Manually triggering daily task digest");
  await sendDailyDigestsToAllUsers();
}
