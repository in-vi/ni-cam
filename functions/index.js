// functions/index.js — Nivaan Tracker Push Scheduler
// Deploys as a Firebase Cloud Function (2nd gen) on Cloud Scheduler.
// Runs every 5 minutes, checks which routine task is coming up,
// and sends an FCM push notification to all registered device tokens.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// ── Routine timetable (keep in sync with index.html) ────────────────────────
const ROUTINE = [
    { id: 0,  time: "06:00", task: "Wake Up" },
    { id: 1,  time: "07:30", task: "Breakfast + Milk 1" },
    { id: 2,  time: "09:30", task: "Nap 1" },
    { id: 3,  time: "12:00", task: "Lunch" },
    { id: 4,  time: "14:30", task: "Nap 2" },
    { id: 5,  time: "16:30", task: "Milk Feed 2" },
    { id: 9,  time: "17:45", task: "Evening Snack" },
    { id: 6,  time: "19:00", task: "Dinner" },
    { id: 7,  time: "20:30", task: "Bed Prep + Milk 3" },
    { id: 8,  time: "21:00", task: "Night Sleep" },
];

// ── Timezone for Hyderabad ───────────────────────────────────────────────────
const TIMEZONE = "Asia/Kolkata";

// Converts "HH:MM" → total minutes since midnight
function toMins(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}

// Returns current HH:MM in a given IANA timezone
function nowInTZ(tz) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(new Date()).replace(",", "").trim(); // "HH:MM"
}

// ── Main scheduled function ──────────────────────────────────────────────────
exports.sendRoutineNotifications = onSchedule(
    {
        schedule: "every 5 minutes",
        timeZone: TIMEZONE,
        region: "asia-south1", // Mumbai — closest to Hyderabad
    },
    async () => {
        const db = getFirestore();
        const messaging = getMessaging();

        const nowHHMM = nowInTZ(TIMEZONE);
        const nowMins = toMins(nowHHMM);

        // Today's date key, e.g. "2026-05-02"
        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: TIMEZONE,
            year: "numeric", month: "2-digit", day: "2-digit"
        }).format(new Date());

        // Find the next uncompleted task that starts within the next 5 minutes
        const routineSnap = await db.collection("routines").doc(today).get();
        const checks = routineSnap.data()?.checks || {};

        const upcomingTask = ROUTINE.find(item => {
            if (checks[item.id]) return false; // Already marked done — skip
            const taskMins = toMins(item.time);
            const diff = taskMins - nowMins;
            return diff > 0 && diff <= 5; // Coming up in 1–5 minutes
        });

        if (!upcomingTask) {
            console.log(`[${nowHHMM}] No upcoming tasks in next 5 min.`);
            return;
        }

        console.log(`[${nowHHMM}] Alerting for task: ${upcomingTask.task}`);

        // Load all registered FCM tokens (one per device, max ~2 for this app)
        const tokensSnap = await db.collection("fcm_tokens").get();
        const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);

        if (!tokens.length) {
            console.warn("No FCM tokens registered. Open the app on each device to register.");
            return;
        }

        const diffMins = toMins(upcomingTask.time) - nowMins;
        const timeText = diffMins === 1 ? "1 minute" : `${diffMins} minutes`;

        const message = {
            notification: {
                title: `⏰ Up next: ${upcomingTask.task}`,
                body: `Starting in ${timeText} (${upcomingTask.time.replace(/^0/, "").replace(":",":")})`,
            },
            data: {
                taskId: String(upcomingTask.id),
                taskName: upcomingTask.task,
            },
            // iOS-specific: required for background delivery on iOS 16.4+ PWA
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        "content-available": 1,
                    }
                }
            },
            tokens, // Multicast to both devices at once
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`Sent to ${tokens.length} device(s). Success: ${response.successCount}, Fail: ${response.failureCount}`);

        // Clean up any stale/invalid tokens automatically
        const staleTokenDocs = [];
        response.responses.forEach((res, i) => {
            if (!res.success) {
                const code = res.error?.code;
                if (
                    code === "messaging/invalid-registration-token" ||
                    code === "messaging/registration-token-not-registered"
                ) {
                    staleTokenDocs.push(tokensSnap.docs[i].ref);
                    console.warn(`Removing stale token for device ${i}`);
                }
            }
        });

        if (staleTokenDocs.length) {
            await Promise.all(staleTokenDocs.map(ref => ref.delete()));
        }
    }
);
