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

    // Handle task creation requests
    const taskCreationPattern = /create.*task|new.*task|add.*task|task.*for/i;
    if (taskCreationPattern.test(query)) {
      try {
        // Get users for name matching
        const users = await prisma.user.findMany({
          where: { tenantId: auth.tenantId },
          select: { id: true, name: true, email: true }
        });

        const systemPrompt = `You are a task creation assistant. Parse the user's request to create a task.

AVAILABLE USERS:
${users.map(u => `- ${u.id}: ${u.name} (${u.email})`).join('\n')}

USER REQUEST: "${query}"

Extract task details and return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Task title",
  "description": "Optional description",
  "type": "MANUAL",
  "priority": "MEDIUM",
  "assignedToUserId": "user-id-if-mentioned",
  "assignedToName": "User Name if mentioned",
  "dueDate": "YYYY-MM-DD if mentioned"
}

TASK TYPES: MANUAL, COMMUNICATION, FOLLOW_UP, SCHEDULED, FORM, CHECKLIST
PRIORITIES: LOW, MEDIUM, HIGH, URGENT

If no specific user is mentioned, omit assignedToUserId. If a user name is mentioned, match it to the user list above.`;

        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
          ],
          temperature: 0.2,
          max_tokens: 300
        });

        let taskData: any;
        try {
          let jsonText = resp.choices[0]?.message?.content?.trim() ?? '{}';
          if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
          }
          taskData = JSON.parse(jsonText);
        } catch {
          taskData = {
            title: query.replace(/create|new|add|task|for/gi, '').trim(),
            type: 'MANUAL',
            priority: 'MEDIUM'
          };
        }

        directAnswer = `I've prepared a task${taskData.assignedToName ? ` for ${taskData.assignedToName}` : ''}. Click below to review and create it.`;
        suggestedAction = {
          label: "Create Task",
          action: {
            type: 'modal' as const,
            target: '/tasks/center',
            params: {
              action: 'create',
              ...taskData
            }
          }
        };
      } catch (err) {
        console.error("Task creation parsing error:", err);
        directAnswer = "I can help you create a task. Please provide more details about what you'd like to create.";
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
      { keywords: ['setting', 'config', 'preference'], title: 'Settings', target: '/settings' },
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

    // Add specific setting shortcuts for common queries
    const settingShortcuts = [
      {
        keywords: ['company logo', 'update logo', 'change logo', 'upload logo'],
        title: 'Update Company Logo',
        description: 'Change your company logo in settings',
        target: '/settings'
      },
      {
        keywords: ['financial year', 'year end', 'financial year end'],
        title: 'Set Financial Year End',
        description: 'Configure your financial year-end date',
        target: '/settings'
      },
      {
        keywords: ['email template', 'automated email', 'email automation'],
        title: 'Email Templates',
        description: 'Customize automated email templates',
        target: '/settings'
      },
      {
        keywords: ['questionnaire', 'customer question', 'lead form'],
        title: 'Customer Questionnaires',
        description: 'Set up customer information gathering forms',
        target: '/settings'
      },
      {
        keywords: ['vat number', 'vat rate', 'tax setting'],
        title: 'VAT Configuration',
        description: 'Configure VAT rates and registration number',
        target: '/settings'
      },
      {
        keywords: ['email integration', 'gmail setup', 'outlook setup'],
        title: 'Email Integration',
        description: 'Connect Gmail or Outlook for email sync',
        target: '/settings'
      }
    ];

    for (const setting of settingShortcuts) {
      if (setting.keywords.some(keyword => searchQuery.includes(keyword))) {
        results.push({
          id: `setting-${setting.title.toLowerCase().replace(/\s+/g, '-')}`,
          type: 'setting',
          title: setting.title,
          description: setting.description,
          action: {
            type: 'navigate' as const,
            target: setting.target
          },
          score: 0.9
        });
      }
    }

    // Add user manual knowledge base for "how to" questions
    const userManualKnowledge = getUserManualKnowledge();
    const manualResponse = findManualAnswer(query, userManualKnowledge);
    
    if (manualResponse) {
      directAnswer = manualResponse.answer;
      if (manualResponse.action) {
        suggestedAction = manualResponse.action;
      }
    }

    // If no specific results but query looks like a question, use OpenAI with enhanced context
    if (results.length === 0 && !directAnswer && (query.includes('?') || query.includes('how') || query.includes('what') || query.includes('where') || query.includes('when') || query.includes('why'))) {
      try {
        const systemPrompt = `You are Joinery AI, an expert assistant for a joinery/carpentry CRM system. 

SYSTEM FEATURES:
- Leads Management: Track customer enquiries through stages (New Enquiry → Info Requested → Ready to Quote → Quote Sent → Won/Lost)
- Quote Builder: Create customer proposals, parse supplier PDFs, apply markup
- Supplier Integration: Request quotes, track deadlines, upload supplier documents
- Tasks & Follow-ups: Automated task creation, deadline tracking
- Analytics: Sales performance, lead conversion, source tracking
- Settings: Company details, financial year-end, VAT, email templates, questionnaires
- Workshop Integration: Production tracking, job scheduling
- Email Integration: Gmail/Outlook sync, automated lead creation
- CSV Import: Bulk lead import with field mapping

NAVIGATION PATHS:
- Company Logo: Settings → Company → Upload Logo
- Financial Year End: Settings → Financial → Year End Date  
- Email Templates: Settings → Email Templates
- Questionnaires: Settings → Questionnaires
- Lead Import: Leads → Import CSV
- Quote Creation: Leads → Select Lead → Move to Quote Builder
- Supplier Quotes: Lead → Request Supplier Quote
- Analytics: Dashboard → Analytics tab
- Tasks: Dashboard → Tasks tab

USER QUESTION: "${query}"

Provide a helpful, concise response in UK English. If it's about system functionality, give specific navigation steps. If asking for a setting location, provide the exact path.`;

        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
          ],
          temperature: 0.2,
          max_tokens: 200
        });

        directAnswer = resp.choices[0]?.message?.content?.trim() ?? "I'm not sure how to help with that.";
        
        // Extract suggested navigation from the response
        const navigationSuggestion = extractNavigationSuggestion(directAnswer);
        if (navigationSuggestion) {
          suggestedAction = navigationSuggestion;
        }
        
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

// User manual knowledge base
function getUserManualKnowledge() {
  return [
    {
      keywords: ['company logo', 'update logo', 'change logo', 'upload logo', 'logo'],
      question: 'How do I update my company logo?',
      answer: 'To update your company logo, go to Settings → Company → Upload Logo. Select your image file (PNG or JPG recommended) and save changes.',
      action: {
        label: 'Go to Company Settings',
        action: {
          type: 'navigate' as const,
          target: '/settings'
        }
      }
    },
    {
      keywords: ['financial year', 'year end', 'financial year end', 'set year end'],
      question: 'How do I set my financial year end?',
      answer: 'To set your financial year end, go to Settings → Financial → Year End Date. Select your year-end date and save changes.',
      action: {
        label: 'Go to Financial Settings',
        action: {
          type: 'navigate' as const,
          target: '/settings'
        }
      }
    },
    {
      keywords: ['email templates', 'customize email', 'automated emails', 'email automation'],
      question: 'How do I customize email templates?',
      answer: 'To customize email templates, go to Settings → Email Templates. You can edit templates for different automated emails like follow-ups, quotes, and customer communications.',
      action: {
        label: 'Go to Email Settings',
        action: {
          type: 'navigate' as const,
          target: '/settings'
        }
      }
    },
    {
      keywords: ['questionnaire', 'customer questions', 'lead questionnaire', 'information gathering'],
      question: 'How do I set up customer questionnaires?',
      answer: 'To create customer questionnaires, go to Settings → Questionnaires. Add questions for information gathering, set required vs optional fields, and save your template.',
      action: {
        label: 'Go to Questionnaire Settings',
        action: {
          type: 'navigate' as const,
          target: '/settings'
        }
      }
    },
    {
      keywords: ['import leads', 'csv import', 'bulk import', 'upload leads', 'spreadsheet'],
      question: 'How do I import leads from a CSV file?',
      answer: 'To import leads, go to Leads → Import CSV. Upload your CSV file, map columns to lead fields, and import leads in bulk.',
      action: {
        label: 'Go to Leads',
        action: {
          type: 'navigate' as const,
          target: '/leads'
        }
      }
    },
    {
      keywords: ['create quote', 'quote builder', 'customer proposal', 'estimate'],
      question: 'How do I create a quote for a customer?',
      answer: 'To create a quote, go to Leads → Select your lead → Move to Quote Builder. Add line items, set markup, and generate a PDF proposal.',
      action: {
        label: 'Go to Leads',
        action: {
          type: 'navigate' as const,
          target: '/leads'
        }
      }
    },
    {
      keywords: ['supplier quote', 'supplier pdf', 'parse pdf', 'extract pricing'],
      question: 'How do I parse supplier PDF quotes?',
      answer: 'Upload supplier PDFs in the Quote Builder, then click "Parse supplier PDFs" to automatically extract line items and pricing.',
      action: {
        label: 'Learn More About Quotes',
        action: {
          type: 'navigate' as const,
          target: '/dashboard?tab=quotes'
        }
      }
    },
    {
      keywords: ['vat number', 'vat rate', 'tax settings', 'vat configuration'],
      question: 'How do I set up VAT?',
      answer: 'To configure VAT, go to Settings → Financial. Set your VAT rate (usually 20% in UK), add your VAT registration number, and configure display preferences.',
      action: {
        label: 'Go to Financial Settings',
        action: {
          type: 'navigate' as const,
          target: '/settings'
        }
      }
    },
    {
      keywords: ['lead stages', 'lead status', 'lead pipeline', 'lead management'],
      question: 'What are the different lead stages?',
      answer: 'Lead stages are: New Enquiry → Info Requested → Ready to Quote → Quote Sent → Won/Lost. You can also mark leads as Disqualified or Rejected.',
      action: {
        label: 'View Leads',
        action: {
          type: 'navigate' as const,
          target: '/leads'
        }
      }
    },
    {
      keywords: ['email integration', 'gmail setup', 'outlook setup', 'email sync'],
      question: 'How do I connect my email?',
      answer: 'To connect email, go to Settings → Email Integration. Connect your Gmail or Outlook account and authorize access for email tracking and automatic lead creation.',
      action: {
        label: 'Go to Email Settings',
        action: {
          type: 'navigate' as const,
          target: '/settings'
        }
      }
    },
    {
      keywords: ['analytics', 'reports', 'sales performance', 'conversion rates'],
      question: 'How do I view my business analytics?',
      answer: 'View analytics on your Dashboard or go to the Analytics section. Track sales pipeline, lead conversion, source performance, and revenue metrics.',
      action: {
        label: 'View Analytics',
        action: {
          type: 'navigate' as const,
          target: '/dashboard?tab=analytics'
        }
      }
    },
    {
      keywords: ['tasks', 'follow up', 'todo', 'reminders'],
      question: 'How do I manage tasks and follow-ups?',
      answer: 'Tasks are automatically created for lead actions, or you can create manual tasks. View and manage them on your Dashboard → Tasks or in the dedicated Tasks section.',
      action: {
        label: 'View Tasks',
        action: {
          type: 'navigate' as const,
          target: '/dashboard?tab=tasks'
        }
      }
    }
  ];
}

// Find matching answer from user manual
function findManualAnswer(query: string, knowledge: any[]) {
  const queryLower = query.toLowerCase();
  
  for (const item of knowledge) {
    for (const keyword of item.keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        return {
          answer: item.answer,
          action: item.action
        };
      }
    }
  }
  
  return null;
}

// Extract navigation suggestions from AI responses
function extractNavigationSuggestion(response: string) {
  const navigationPatterns = [
    { pattern: /settings.*company/i, target: '/settings', label: 'Go to Settings' },
    { pattern: /settings.*financial/i, target: '/settings', label: 'Go to Financial Settings' },
    { pattern: /settings.*email/i, target: '/settings', label: 'Go to Email Settings' },
    { pattern: /settings/i, target: '/settings', label: 'Go to Settings' },
    { pattern: /leads.*import|import.*leads/i, target: '/leads', label: 'Go to Leads' },
    { pattern: /leads/i, target: '/leads', label: 'Go to Leads' },
    { pattern: /dashboard.*analytics|analytics/i, target: '/dashboard?tab=analytics', label: 'View Analytics' },
    { pattern: /dashboard.*tasks|tasks/i, target: '/dashboard?tab=tasks', label: 'View Tasks' },
    { pattern: /quote.*builder|quotes/i, target: '/dashboard?tab=quotes', label: 'View Quotes' },
    { pattern: /dashboard/i, target: '/dashboard', label: 'Go to Dashboard' }
  ];
  
  for (const pattern of navigationPatterns) {
    if (pattern.pattern.test(response)) {
      return {
        label: pattern.label,
        action: {
          type: 'navigate' as const,
          target: pattern.target
        }
      };
    }
  }
  
  return null;
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