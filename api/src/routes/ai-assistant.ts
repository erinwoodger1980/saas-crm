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

    const [lateTasks, dueTodayTasks, completedTodayTasks, totalTasks, recentCompletions] = await Promise.all([
      prisma.task.count({
        where: {
          tenantId,
          dueAt: { lt: startOfDay },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      }),
      prisma.task.count({
        where: {
          tenantId,
          dueAt: { gte: startOfDay, lte: endOfDay },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      }),
      prisma.task.count({
        where: {
          tenantId,
          status: "DONE",
          completedAt: { gte: startOfDay },
        },
      }),
      prisma.task.count({
        where: {
          tenantId,
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      }),
      prisma.task.findMany({
        where: {
          tenantId,
          status: "DONE",
          completedAt: { not: null },
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
    const prompt = `You are a supportive, empowering virtual assistant for a workshop/joinery business owner. Your role is to create emotional anchors, rituals, and make the user feel special and in control.

Context:
- User's name: ${firstName}
- Day: ${context.dayOfWeek}
- Time: ${hour}:00
- Late tasks: ${lateTasks}
- Due today: ${dueTodayTasks}
- Completed today: ${completedTodayTasks}
- Total active: ${totalTasks}
- Recent completions: ${context.recentCompletions || "None yet"}

Create a short, inspiring message (1-2 sentences max, under 80 characters) that:
1. Makes them feel chosen, not sold to
2. Creates ritual (Monday morning check-ins, Friday wraps, etc.)
3. Celebrates achievements
4. Acknowledges challenges with encouragement
5. Makes them feel like they have an invisible assistant
6. Uses phrases like "Most workshops never track like this. You do."

Examples:
- "Monday Morning Check-in, ${firstName}. Let's plan a great week."
- "You've completed ${completedTodayTasks} tasks today. You're on fire!"
- "${lateTasks} tasks need attention. You've got this, ${firstName}!"
- "Friday Wrap. You've moved your business forward this week!"
- "Most workshops never track like this. You do. That's progress."

Respond with ONLY the message text, no explanations or markdown.`;

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

    // Fallback default message
    return res.json({
      type: "encouragement",
      message: `You're on top of things, ${firstName}. Most workshops never track like this.`,
      icon: "Zap",
      color: "from-purple-500 to-pink-500",
    });
  } catch (error: any) {
    console.error("[AI Assistant] Error:", error);
    res.status(500).json({ error: "Failed to generate insight" });
  }
});

export default router;
