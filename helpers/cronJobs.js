import ChatSessions from "../models/chatSessions.js";

/***
 * expireInactiveSessions
 * Marks sessions inactive after 2 hours of no activity
 * Does not delete — preserves full conversation history
 */
const expireInactiveSessions = async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const result = await ChatSessions.updateMany(
      { active: true, lastActivityAt: { $lt: twoHoursAgo } },
      { $set: { active: false } }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Cron] Marked ${result.modifiedCount} session(s) inactive`);
    }
  } catch (err) {
    console.error("[Cron] expireInactiveSessions failed:", err.message);
  }
};

/***
 * startCronJobs
 * Call this once after DB connection is established
 * Add any future cron jobs here
 */
export const startCronJobs = () => {
  // run immediately on startup then every 15 minutes
  expireInactiveSessions();
  setInterval(expireInactiveSessions, 15 * 60 * 1000);

  console.log("[Cron] Jobs started");
};
