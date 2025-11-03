// api/src/routes/ai.ts
import { Router } from "express";
import { prisma } from "../prisma";
import openai from "../ai";

const r = Router();

type SumRow = { total: number | null };

interface SearchResult {
  id: string;
  type: 'lead' | 'opportunity' | 'task' | 'setting' | 'navigation';
  title: string;
  subtitle?: string;
  description?: string;
  action: {
    type: 'navigate' | 'modal' | 'function';
    target: string;
    params?: Record<string, any>;
  };
  score?: number;
}

interface SearchResponse {
  results: SearchResult[];
  directAnswer?: string;
  suggestedAction?: {
    label: string;
    action: SearchResult['action'];
  };
}

// AI-powered search endpoint
r.post("/search", async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { query } = req.body || {};
    if (!query || typeof query !== "string") {
      return res.json({ results: [], directAnswer: "Please enter a search query." });
    }

    const searchQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];
    let directAnswer = "";
    let suggestedAction: {
      label: string;
      action: SearchResult['action'];
    } | undefined = undefined;

    // Search leads by name, email, or contact info
    if (searchQuery.length > 2) {
      const leads = await prisma.lead.findMany({
        where: {
          tenantId: auth.tenantId,
          OR: [
            { contactName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 10,
        orderBy: { capturedAt: 'desc' }
      });

      for (const lead of leads) {
        results.push({
          id: lead.id,
          type: 'lead',
          title: lead.contactName || lead.email || 'Unnamed Lead',
          subtitle: lead.email || undefined,
          description: lead.description || `Lead created ${new Date(lead.capturedAt).toLocaleDateString()}`,
          action: {
            type: 'modal',
            target: '/leads',
            params: { leadId: lead.id, modal: 'lead' }
          },
          score: calculateRelevanceScore(query, [lead.contactName, lead.email, lead.description].filter((item): item is string => item !== null))
        });
      }
    }

    // Search opportunities
    if (searchQuery.length > 2) {
      const opportunities = await prisma.opportunity.findMany({
        where: {
          tenantId: auth.tenantId,
          OR: [
            { title: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: {
          lead: true
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      for (const opp of opportunities) {
        results.push({
          id: opp.id,
          type: 'opportunity',
          title: opp.title || 'Unnamed Opportunity',
          subtitle: opp.lead?.email || opp.lead?.contactName || undefined,
          description: `£${opp.valueGBP || 0} opportunity`,
          action: {
            type: 'navigate',
            target: `/dashboard?opportunityId=${opp.id}`
          },
          score: calculateRelevanceScore(query, [opp.title, opp.lead?.contactName].filter((item): item is string => item !== null))
        });
      }
    }

    // Search tasks
    if (searchQuery.length > 2) {
      const tasks = await prisma.task.findMany({
        where: {
          tenantId: auth.tenantId,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });

      for (const task of tasks) {
        results.push({
          id: task.id,
          type: 'task',
          title: task.title || 'Unnamed Task',
          subtitle: task.status === 'DONE' ? 'Completed' : 'Pending',
          description: task.description || `Task created ${new Date(task.createdAt).toLocaleDateString()}`,
          action: {
            type: 'navigate',
            target: `/dashboard?taskId=${task.id}`
          },
          score: calculateRelevanceScore(query, [task.title, task.description].filter((item): item is string => item !== null))
        });
      }
    }

    // Handle specific questions with OpenAI
    const questionPatterns = [
      { pattern: /how.*set.*year.*end/i, type: 'year-end-setting' },
      { pattern: /where.*settings/i, type: 'settings-navigation' },
      { pattern: /how.*add.*lead/i, type: 'add-lead' },
      { pattern: /how.*create.*opportunity/i, type: 'add-opportunity' },
      { pattern: /sales.*month|revenue.*month/i, type: 'sales-query' },
      { pattern: /show.*tasks|my.*tasks/i, type: 'tasks-navigation' },
      { pattern: /dashboard|overview/i, type: 'dashboard-navigation' }
    ];

    for (const { pattern, type } of questionPatterns) {
      if (pattern.test(query)) {
        switch (type) {
          case 'year-end-setting':
            directAnswer = "To set your year end, go to your business settings in the dashboard.";
            suggestedAction = {
              label: "Open Business Settings",
              action: {
                type: 'navigate' as const,
                target: '/dashboard?tab=settings&section=business'
              }
            };
            break;

          case 'settings-navigation':
            directAnswer = "You can find all settings in the dashboard settings section.";
            suggestedAction = {
              label: "Open Settings",
              action: {
                type: 'navigate' as const,
                target: '/dashboard?tab=settings'
              }
            };
            break;

          case 'add-lead':
            directAnswer = "You can add a new lead from the leads page or dashboard.";
            suggestedAction = {
              label: "Add New Lead",
              action: {
                type: 'navigate' as const,
                target: '/leads?action=add'
              }
            };
            break;

          case 'add-opportunity':
            directAnswer = "Create new opportunities from the dashboard or opportunities section.";
            suggestedAction = {
              label: "Add New Opportunity",
              action: {
                type: 'navigate' as const,
                target: '/dashboard?action=addOpportunity'
              }
            };
            break;

          case 'sales-query':
            const salesRows = await prisma.$queryRaw<SumRow[]>`
              SELECT SUM(COALESCE("valueGBP", 0)) AS total
              FROM "Opportunity"
              WHERE "tenantId" = ${auth.tenantId}
                AND "wonAt" IS NOT NULL
                AND date_trunc('month',"wonAt") = date_trunc('month', now())
            `;
            const total = salesRows?.[0]?.total ?? 0;
            directAnswer = `Your sales this month: £${total.toLocaleString()}`;
            suggestedAction = {
              label: "View Full Analytics",
              action: {
                type: 'navigate' as const,
                target: '/dashboard?tab=analytics'
              }
            };
            break;

          case 'tasks-navigation':
            directAnswer = "Here are your current tasks and to-dos.";
            suggestedAction = {
              label: "View All Tasks",
              action: {
                type: 'navigate' as const,
                target: '/dashboard?tab=tasks'
              }
            };
            break;

          case 'dashboard-navigation':
            directAnswer = "Taking you to your main dashboard overview.";
            suggestedAction = {
              label: "Open Dashboard",
              action: {
                type: 'navigate' as const,
                target: '/dashboard'
              }
            };
            break;
        }
        break;
      }
    }

    // Add navigation suggestions for common app sections
    const navigationSuggestions = [
      { keywords: ['lead', 'contact', 'customer'], title: 'Leads', target: '/leads' },
      { keywords: ['opportunity', 'deal', 'sale'], title: 'Opportunities', target: '/dashboard?tab=opportunities' },
      { keywords: ['task', 'todo', 'action'], title: 'Tasks', target: '/dashboard?tab=tasks' },
      { keywords: ['setting', 'config', 'preference'], title: 'Settings', target: '/dashboard?tab=settings' },
      { keywords: ['analytic', 'report', 'metric'], title: 'Analytics', target: '/dashboard?tab=analytics' },
      { keywords: ['quote', 'proposal', 'estimate'], title: 'Quotes', target: '/dashboard?tab=quotes' }
    ];

    for (const nav of navigationSuggestions) {
      if (nav.keywords.some(keyword => searchQuery.includes(keyword))) {
        results.push({
          id: `nav-${nav.title.toLowerCase()}`,
          type: 'navigation',
          title: nav.title,
          description: `Navigate to ${nav.title} section`,
          action: {
            type: 'navigate' as const,
            target: nav.target
          },
          score: 0.8
        });
      }
    }

    // If no specific results but query looks like a question, use OpenAI
    if (results.length === 0 && !directAnswer && (query.includes('?') || query.includes('how') || query.includes('what') || query.includes('where'))) {
      try {
        const system = `You are Joinery AI, an assistant for a CRM system. The user is asking: "${query}". 
        Provide a helpful, brief response in UK English. If the question is about CRM functionality, guide them appropriately.
        Available sections: Dashboard, Leads, Opportunities, Tasks, Analytics, Settings, Quotes.`;

        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: query }
          ],
          temperature: 0.3,
          max_tokens: 150
        });

        directAnswer = resp.choices[0]?.message?.content?.trim() ?? "I'm not sure how to help with that.";
      } catch (err) {
        console.error("OpenAI error:", err);
        directAnswer = "I'm having trouble processing that question. Try searching for specific leads, opportunities, or tasks.";
      }
    }

    // Sort results by relevance score
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    const response: SearchResponse = {
      results: results.slice(0, 8), // Limit to top 8 results
      directAnswer,
      suggestedAction
    };

    return res.json(response);
  } catch (err: any) {
    console.error("[/ai/search] error:", err);
    return res.status(500).json({ error: err?.message ?? "search error" });
  }
});

// Helper function to calculate relevance score
function calculateRelevanceScore(query: string, fields: string[]): number {
  const queryLower = query.toLowerCase();
  let score = 0;

  for (const field of fields) {
    if (!field) continue;
    const fieldLower = field.toLowerCase();
    
    // Exact match gets highest score
    if (fieldLower === queryLower) {
      score += 1.0;
    }
    // Starts with query gets high score
    else if (fieldLower.startsWith(queryLower)) {
      score += 0.8;
    }
    // Contains query gets medium score
    else if (fieldLower.includes(queryLower)) {
      score += 0.6;
    }
    // Word boundary match gets good score
    else if (new RegExp(`\\b${queryLower}\\b`).test(fieldLower)) {
      score += 0.7;
    }
  }

  return score;
}

r.post("/chat", async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { question } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.json({ answer: "Please ask a question." });
    }

    // Example quick metric: "sales this month?"
    if (/sales.*month/i.test(question)) {
      const rows = await prisma.$queryRaw<SumRow[]>`
        SELECT SUM(COALESCE("valueGBP", 0)) AS total
        FROM "Opportunity"
        WHERE "tenantId" = ${auth.tenantId}
          AND "wonAt" IS NOT NULL
          AND date_trunc('month',"wonAt") = date_trunc('month', now())
      `;
      const total = rows?.[0]?.total ?? 0;
      return res.json({ answer: `Sales this month: £${total}` });
    }

    // Fallback to OpenAI
    const system = "You are Joinery AI. Answer briefly in UK English.";
    const user = `Question: ${question}`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
    });

    const text = resp.choices[0]?.message?.content?.trim() ?? "No response.";
    return res.json({ answer: text });
  } catch (err: any) {
    console.error("[/ai/chat] error:", err);
    return res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

export default r;