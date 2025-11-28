// api/src/services/task-digest.ts
import { prisma } from "../prisma";
import OpenAI from "openai";
import { env } from "../env";
import { sendAdminEmail } from "./email-notification";

interface TaskDigest {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date | null;
  priority: string;
  status: string;
  taskType: string;
  relatedType: string;
  relatedId: string | null;
  link: string;
}

/**
 * Generate AI-formatted task digest email for a user
 */
export async function sendDailyTaskDigest(userId: string): Promise<void> {
  // Get user details
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      tenantId: true,
      tenant: {
        select: { name: true, slug: true },
      },
    },
  });

  if (!user || !user.email) {
    console.log(`[task-digest] User ${userId} not found or has no email`);
    return;
  }

  // Get tasks assigned to this user for next 7 days
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      tenantId: user.tenantId,
      assignees: {
        some: { userId },
      },
      status: {
        in: ["OPEN", "IN_PROGRESS", "BLOCKED"],
      },
      OR: [
        {
          dueAt: {
            gte: now,
            lte: sevenDaysFromNow,
          },
        },
        {
          dueAt: null, // Include tasks without due dates
        },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      dueAt: true,
      priority: true,
      status: true,
      taskType: true,
      relatedType: true,
      relatedId: true,
    },
    orderBy: [
      { dueAt: "asc" },
      { priority: "desc" },
    ],
    take: 50, // Limit to prevent overwhelming emails
  });

  if (tasks.length === 0) {
    console.log(`[task-digest] No tasks for user ${userId}, skipping email`);
    return;
  }

  // Build app URLs for each task
  const baseUrl = env.WEB_URL || "https://app.joineryai.app";
  const tasksWithLinks: TaskDigest[] = tasks.map((task) => ({
    ...task,
    link: `${baseUrl}/tasks?id=${task.id}`,
  }));

  // Generate AI summary
  const aiSummary = await generateTaskSummary(tasksWithLinks, user.name || "there");

  // Build HTML email
  const html = buildTaskDigestEmail({
    userName: user.name || "there",
    tenantName: user.tenant.name,
    tasks: tasksWithLinks,
    aiSummary,
    baseUrl,
  });

  // Send email
  await sendAdminEmail({
    to: user.email,
    subject: `Your tasks for the next 7 days - ${user.tenant.name}`,
    html,
  });

  console.log(`[task-digest] Sent daily digest to ${user.email} with ${tasks.length} tasks`);
}

/**
 * Generate AI summary of tasks using OpenAI
 */
async function generateTaskSummary(tasks: TaskDigest[], userName: string): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    return generateFallbackSummary(tasks, userName);
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Group tasks by priority and due date
  const overdue = tasks.filter((t) => t.dueAt && new Date(t.dueAt) < new Date());
  const today = tasks.filter((t) => {
    if (!t.dueAt) return false;
    const due = new Date(t.dueAt);
    const now = new Date();
    return due.toDateString() === now.toDateString();
  });
  const upcoming = tasks.filter((t) => !overdue.includes(t) && !today.includes(t));

  const prompt = `You are writing a friendly, motivating daily task summary for ${userName}. 

They have:
- ${overdue.length} overdue tasks
- ${today.length} tasks due today
- ${upcoming.length} upcoming tasks

Key tasks:
${tasks
  .slice(0, 10)
  .map(
    (t, i) =>
      `${i + 1}. ${t.title} - ${t.priority} priority, ${t.dueAt ? `due ${formatDateShort(new Date(t.dueAt))}` : "no due date"}`
  )
  .join("\n")}

Write a brief (2-3 sentences) encouraging summary that:
1. Acknowledges their workload professionally
2. Highlights the most urgent items
3. Offers a positive, actionable perspective

Keep it concise, friendly, and motivating. Don't use bullet points.`;

  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL_FAST || "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that writes brief, motivating task summaries. Be encouraging but realistic.",
        },
        { role: "user", content: prompt },
      ],
    });

    return response.choices[0]?.message?.content || generateFallbackSummary(tasks, userName);
  } catch (error) {
    console.error("[task-digest] OpenAI error:", error);
    return generateFallbackSummary(tasks, userName);
  }
}

/**
 * Fallback summary if AI is unavailable
 */
function generateFallbackSummary(tasks: TaskDigest[], userName: string): string {
  const high = tasks.filter((t) => t.priority === "HIGH").length;
  const overdue = tasks.filter((t) => t.dueAt && new Date(t.dueAt) < new Date()).length;

  if (overdue > 0) {
    return `Hi ${userName}, you have ${tasks.length} tasks coming up, including ${overdue} overdue items that need attention. Let's tackle the most urgent ones first!`;
  } else if (high > 0) {
    return `Hi ${userName}, you have ${tasks.length} tasks on your list for the next week, with ${high} high-priority items. Great job staying on top of things!`;
  } else {
    return `Hi ${userName}, you have ${tasks.length} tasks lined up for the next week. You're doing great—let's keep the momentum going!`;
  }
}

/**
 * Build HTML email for task digest
 */
function buildTaskDigestEmail(params: {
  userName: string;
  tenantName: string;
  tasks: TaskDigest[];
  aiSummary: string;
  baseUrl: string;
}): string {
  const now = new Date();

  // Group tasks by due date
  const overdue = params.tasks.filter((t) => t.dueAt && new Date(t.dueAt) < now);
  const today = params.tasks.filter((t) => {
    if (!t.dueAt) return false;
    const due = new Date(t.dueAt);
    return due.toDateString() === now.toDateString();
  });
  const tomorrow = params.tasks.filter((t) => {
    if (!t.dueAt) return false;
    const due = new Date(t.dueAt);
    const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return due.toDateString() === tom.toDateString();
  });
  const thisWeek = params.tasks.filter(
    (t) => !overdue.includes(t) && !today.includes(t) && !tomorrow.includes(t)
  );

  const sections = [
    { title: "⚠️ Overdue", tasks: overdue, color: "#dc2626" },
    { title: "📅 Due Today", tasks: today, color: "#ea580c" },
    { title: "🗓️ Due Tomorrow", tasks: tomorrow, color: "#f59e0b" },
    { title: "📆 This Week", tasks: thisWeek, color: "#3b82f6" },
  ].filter((s) => s.tasks.length > 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 650px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
    .summary { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px 30px; margin: 0; font-size: 15px; line-height: 1.7; color: #1e40af; }
    .content { padding: 30px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid; display: flex; align-items: center; gap: 8px; }
    .task { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; transition: all 0.2s; }
    .task:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
    .task-title { font-weight: 600; font-size: 16px; margin-bottom: 6px; color: #111827; }
    .task-title a { color: #111827; text-decoration: none; }
    .task-title a:hover { color: #3b82f6; }
    .task-meta { display: flex; gap: 15px; flex-wrap: wrap; font-size: 13px; color: #6b7280; margin-top: 8px; }
    .task-meta-item { display: flex; align-items: center; gap: 5px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-high { background: #fee2e2; color: #991b1b; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low { background: #dbeafe; color: #1e40af; }
    .cta { text-align: center; padding: 30px; background: #f9fafb; }
    .cta-button { display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; transition: background 0.2s; }
    .cta-button:hover { background: #2563eb; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>☀️ Good Morning, ${params.userName}!</h1>
      <p>${params.tenantName}</p>
    </div>
    
    <div class="summary">
      ${params.aiSummary}
    </div>
    
    <div class="content">
      ${sections
        .map(
          (section) => `
        <div class="section">
          <div class="section-title" style="border-color: ${section.color}; color: ${section.color};">
            <span>${section.title}</span>
            <span style="font-size: 14px; font-weight: 400; color: #6b7280;">(${section.tasks.length})</span>
          </div>
          ${section.tasks
            .map(
              (task) => `
            <div class="task">
              <div class="task-title">
                <a href="${task.link}">${escapeHtml(task.title)}</a>
              </div>
              ${task.description ? `<div style="font-size: 14px; color: #6b7280; margin-top: 4px;">${escapeHtml(task.description.slice(0, 120))}${task.description.length > 120 ? "..." : ""}</div>` : ""}
              <div class="task-meta">
                <span class="task-meta-item">
                  <span class="badge ${task.priority === "HIGH" ? "badge-high" : task.priority === "MEDIUM" ? "badge-medium" : "badge-low"}">
                    ${task.priority}
                  </span>
                </span>
                ${task.dueAt ? `<span class="task-meta-item">📅 ${formatDate(new Date(task.dueAt))}</span>` : ""}
                <span class="task-meta-item">🏷️ ${formatTaskType(task.taskType)}</span>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      `
        )
        .join("")}
    </div>
    
    <div class="cta">
      <a href="${params.baseUrl}/tasks" class="cta-button">View All Tasks</a>
    </div>
    
    <div class="footer">
      <p>This is your automated daily task digest from JoineryAI</p>
      <p>Sent on ${formatDateTime(now)}</p>
    </div>
  </div>
</body>
</html>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function formatTaskType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Send digests to all active users
 */
export async function sendDailyDigestsToAllUsers(): Promise<void> {
  console.log("[task-digest] Starting daily digest send for all users");

  // Get all users with email addresses
  const users = await prisma.user.findMany({
    where: {
      email: { not: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  console.log(`[task-digest] Found ${users.length} users with email addresses`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      await sendDailyTaskDigest(user.id);
      successCount++;
      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`[task-digest] Failed to send digest to ${user.email}:`, error.message);
      errorCount++;
    }
  }

  console.log(
    `[task-digest] Daily digest complete: ${successCount} sent, ${errorCount} errors`
  );
}
