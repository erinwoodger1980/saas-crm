import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";
import OpenAI from "openai";
import { env } from "../env";

const router = Router();
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// GET /ai/assistant-insight - Generate personalized AI insight
router.get("/assistant-insight", requireAuth, async (req, res) => {
  try {
    const { tenantId, userId } = req.auth!;

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, name: true },
    });

    const firstName = user?.firstName || user?.name?.split(' ')[0] || "there";

    // Get task statistics
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Scope insight to the current user's tasks to match UI expectations
    const assigneeScope = userId ? { assignees: { some: { userId } } } : {};

    const [lateTasks, dueTodayTasks, completedTodayTasks, totalTasks, recentCompletions] = await Promise.all([
      prisma.task.count({
        where: {
          tenantId,
          status: { notIn: ["DONE", "CANCELLED"] },
          dueAt: { lt: startOfDay },
          ...assigneeScope,
        },
      }),
      prisma.task.count({
        where: {
          tenantId,
          status: { notIn: ["DONE", "CANCELLED"] },
          dueAt: { gte: startOfDay, lte: endOfDay },
          ...assigneeScope,
        },
      }),
      prisma.task.count({
        where: {
          tenantId,
          status: "DONE",
          completedAt: { gte: startOfDay },
          ...(userId ? { assignees: { some: { userId } } } : {}),
        },
      }),
      prisma.task.count({
        where: {
          tenantId,
          status: { notIn: ["DONE", "CANCELLED"] },
          ...assigneeScope,
        },
      }),
      prisma.task.findMany({
        where: {
          tenantId,
          status: "DONE",
          completedAt: { not: null },
          ...(userId ? { assignees: { some: { userId } } } : {}),
        },
        orderBy: { completedAt: "desc" },
        take: 5,
        select: { title: true, completedAt: true },
      }),
    ]);

    // Get day of week
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    // Build context for OpenAI
    const context = {
      firstName,
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek],
      hour,
      lateTasks,
      dueTodayTasks,
      completedTodayTasks,
      totalTasks,
      recentCompletions: recentCompletions.map((t: any) => t.title).join(", "),
    };

    // Generate AI insight
    const prompt = `You are a brief, intelligent assistant for a workshop/joinery business. Analyze the task data and create a concise, actionable insight.

Current status:
- User: ${firstName}
- Day: ${context.dayOfWeek}, ${hour}:00
- Late tasks: ${lateTasks}
- Due today: ${dueTodayTasks}
- Completed today: ${completedTodayTasks}
- Total active: ${totalTasks}
- Recent: ${context.recentCompletions || "none"}

Create a SHORT message (under 70 characters) that:
- States the most important fact from the data
- Is supportive but professional
- Focuses on actionable information
- Uses actual numbers, not generic phrases

Good examples:
- "${completedTodayTasks} tasks completed. ${dueTodayTasks} more to go today."
- "${lateTasks} overdue tasks need attention."
- "Monday morning. ${totalTasks} active tasks this week."
- "All clear. ${completedTodayTasks} tasks done today."

Bad examples (avoid these):
- "You're amazing!" (too generic)
- "Most workshops never..." (cliché platitude)
- Anything without specific numbers

Respond with ONLY the message, no quotes or explanations.`;

    try {
      const completion = await openai.chat.completions.create({
        model: env.OPENAI_MODEL_FAST,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.8,
      });

      const message = completion.choices[0]?.message?.content?.trim() || null;

      if (message) {
        // Determine type and color based on content
        let type: "celebration" | "encouragement" | "reminder" | "achievement" | "ritual" = "encouragement";
        let icon = "Sparkles";
        let color = "from-blue-500 to-indigo-500";

        if (message.toLowerCase().includes("monday") || message.toLowerCase().includes("friday")) {
          type = "ritual";
          icon = "Coffee";
          color = "from-amber-500 to-orange-500";
        } else if (lateTasks > 0) {
          type = "reminder";
          icon = "Clock";
          color = "from-orange-500 to-red-500";
        } else if (completedTodayTasks > 0 && message.toLowerCase().includes("completed")) {
          type = "achievement";
          icon = "TrendingUp";
          color = "from-emerald-500 to-teal-500";
        } else if (message.toLowerCase().includes("fire") || message.toLowerCase().includes("amazing")) {
          type = "celebration";
          icon = "Heart";
          color = "from-pink-500 to-rose-500";
        }

        return res.json({ type, message, icon, color });
      }
    } catch (aiError) {
      console.error("[AI Assistant] OpenAI error:", aiError);
      // Fall through to default response
    }

    // Fallback default message based on actual data
    let fallbackMessage = "All systems running.";
    let fallbackIcon = "CheckCircle2";
    let fallbackColor = "from-emerald-500 to-teal-500";
    
    if (lateTasks > 0) {
      fallbackMessage = `${lateTasks} ${lateTasks === 1 ? 'task' : 'tasks'} overdue.`;
      fallbackIcon = "Clock";
      fallbackColor = "from-orange-500 to-red-500";
    } else if (dueTodayTasks > 0) {
      fallbackMessage = `${dueTodayTasks} ${dueTodayTasks === 1 ? 'task' : 'tasks'} due today.`;
      fallbackIcon = "Target";
      fallbackColor = "from-blue-500 to-indigo-500";
    } else if (completedTodayTasks > 0) {
      fallbackMessage = `${completedTodayTasks} tasks completed today.`;
      fallbackIcon = "TrendingUp";
      fallbackColor = "from-emerald-500 to-teal-500";
    } else if (totalTasks > 0) {
      fallbackMessage = `${totalTasks} active ${totalTasks === 1 ? 'task' : 'tasks'}.`;
      fallbackIcon = "Zap";
      fallbackColor = "from-purple-500 to-pink-500";
    }
    
    return res.json({
      type: "encouragement",
      message: fallbackMessage,
      icon: fallbackIcon,
      color: fallbackColor,
    });
  } catch (error: any) {
    console.error("[AI Assistant] Error:", error);
    res.status(500).json({ error: "Failed to generate insight" });
  }
});

export default router;
