// api/src/routes/automation-rules.ts
import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { z } from "zod";
import { send } from "../services/ai/openai";

const router = Router();

// ============================================================================
// Type Definitions & Schemas
// ============================================================================

const DateCalculationSchema = z.object({
  type: z.enum(['RELATIVE_TO_FIELD', 'FIXED_DATE']),
  fieldName: z.string().optional(), // e.g., 'deliveryDate', 'installationStartDate'
  offsetDays: z.number().optional(), // e.g., -20 for 20 days before
  fixedDate: z.string().optional(), // ISO date string if type is FIXED_DATE
});

const TaskActionSchema = z.object({
  type: z.literal('CREATE_TASK'),
  taskTitle: z.string(),
  taskDescription: z.string().optional(),
  taskType: z.enum(['MANUAL', 'COMMUNICATION', 'FOLLOW_UP', 'SCHEDULED', 'FORM', 'CHECKLIST']).default('MANUAL'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assignToUserId: z.string().optional(),
  assignToRole: z.string().optional(), // e.g., 'workshop_manager', 'project_owner'
  relatedTo: z.enum(['LEAD', 'PROJECT', 'QUOTE', 'OPPORTUNITY', 'OTHER']).default('OTHER'),
  // Optional workshop process code to link the task to (stored in task.meta.processCode)
  processCode: z.string().optional(),
  dueAtCalculation: DateCalculationSchema,
  formSchema: z.any().optional(),
  checklistItems: z.any().optional(),
  requiresSignature: z.boolean().optional(),
  // If the trigger field changes, reschedule this task
  rescheduleOnTriggerChange: z.boolean().default(true),
  // Unique key to identify the task instance (prevent duplicates)
  taskInstanceKey: z.string().optional(), // e.g., 'order_materials_{opportunityId}'
});

const TriggerSchema = z.object({
  type: z.enum(['FIELD_UPDATED', 'STATUS_CHANGED', 'RECORD_CREATED', 'DATE_REACHED']),
  entityType: z.enum(['LEAD', 'OPPORTUNITY', 'PROJECT', 'QUOTE']),
  fieldName: z.string().optional(), // for FIELD_UPDATED
  oldValue: z.any().optional(), // optional condition
  newValue: z.any().optional(), // optional condition
});

const ConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_null', 'is_null']),
  value: z.any().optional(),
});

const AutomationRuleSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
  trigger: TriggerSchema,
  conditions: z.array(ConditionSchema).optional(),
  actions: z.array(TaskActionSchema),
});

type AutomationRuleData = z.infer<typeof AutomationRuleSchema>;
type TaskAction = z.infer<typeof TaskActionSchema>;
type DateCalculation = z.infer<typeof DateCalculationSchema>;

// ============================================================================
// CRUD Endpoints
// ============================================================================

/**
 * GET /automation-rules
 * List all automation rules for the tenant
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const rules = await prisma.automationRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ items: rules, total: rules.length });
  } catch (error) {
    console.error("[AutomationRules GET] Error:", error);
    res.status(500).json({ error: "Failed to fetch automation rules" });
  }
});

/**
 * GET /automation-rules/:id
 * Get a single automation rule
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    const { id } = req.params;

    const rule = await prisma.automationRule.findFirst({
      where: { id, tenantId },
    });

    if (!rule) return res.status(404).json({ error: "Rule not found" });

    res.json(rule);
  } catch (error) {
    console.error("[AutomationRules GET/:id] Error:", error);
    res.status(500).json({ error: "Failed to fetch automation rule" });
  }
});

/**
 * POST /automation-rules
 * Create a new automation rule
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    const userId = (req as any).auth?.userId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const validated = AutomationRuleSchema.parse(req.body);

    const rule = await prisma.automationRule.create({
      data: {
        tenantId,
        name: validated.name,
        enabled: validated.enabled,
        trigger: validated.trigger as any,
        conditions: validated.conditions as any,
        actions: validated.actions as any,
        createdById: userId,
      },
    });

    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[AutomationRules POST] Error:", error);
    res.status(500).json({ error: "Failed to create automation rule" });
  }
});

/**
 * PATCH /automation-rules/:id
 * Update an automation rule
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    const userId = (req as any).auth?.userId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    const { id } = req.params;

    const existing = await prisma.automationRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) return res.status(404).json({ error: "Rule not found" });

    const validated = AutomationRuleSchema.partial().parse(req.body);

    const updated = await prisma.automationRule.update({
      where: { id },
      data: {
        ...validated,
        trigger: validated.trigger as any,
        conditions: validated.conditions as any,
        actions: validated.actions as any,
        updatedById: userId,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[AutomationRules PATCH] Error:", error);
    res.status(500).json({ error: "Failed to update automation rule" });
  }
});

/**
 * POST /automation-rules/generate
 * Generate an automation rule from natural language using AI
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: "Missing or invalid 'prompt' field" });
    }

    // Get available users for the tenant
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true },
    });

    const systemPrompt = `You are an automation assistant for a CRM system. Convert user requests into automation rules.

AVAILABLE ENTITIES:
- OPPORTUNITY: A potential sale/project
- LEAD: An incoming inquiry
- PROJECT: A won opportunity (in production)
- QUOTE: A price quote sent to customer

AVAILABLE TRIGGERS:
- FIELD_UPDATED: When a specific field changes
- STATUS_CHANGED: When record status changes
- RECORD_CREATED: When a new record is created
- DATE_REACHED: When a date is reached

AVAILABLE FIELDS BY ENTITY:
- OPPORTUNITY: deliveryDate, installationStartDate, stage, value, probability, customerName, contactEmail, contactPhone, status, paintOrderedAt, paintExpectedAt, paintReceivedAt, timbersOrderedAt, timbersExpectedAt, timbersReceivedAt, glassOrderedAt, glassExpectedAt, glassReceivedAt, ironmongeryOrderedAt, ironmongeryExpectedAt, ironmongeryReceivedAt
- LEAD: status, source, assignedTo, customerName, contactEmail, contactPhone, notes
- PROJECT: deliveryDate, installationStartDate, status, actualStartDate, actualEndDate, progress
- QUOTE: dateQuoteSent, dateQuoteExpires, totalValue, status, customerName

AVAILABLE TASK TYPES:
- MANUAL: Generic manual task
- COMMUNICATION: Phone call, email, meeting
- FOLLOW_UP: Follow up with customer
- SCHEDULED: Scheduled appointment
- FORM: Fill out a form
- CHECKLIST: Complete checklist items

TASK PRIORITIES:
- LOW: Not urgent
- MEDIUM: Normal priority (default)
- HIGH: Important
- URGENT: Critical/time-sensitive

AVAILABLE USERS:
${users.map(u => `- ${u.id}: ${u.name} (${u.email})`).join('\n')}

DUE DATE CALCULATION:
- For relative dates: use "RELATIVE_TO_FIELD" with fieldName and offsetDays (negative for before, positive for after)
  Example: 20 days before delivery = { type: "RELATIVE_TO_FIELD", fieldName: "deliveryDate", offsetDays: -20 }
- For fixed dates: use "FIXED_DATE" with fixedDate as ISO string

IMPORTANT RULES:
1. taskInstanceKey should be unique per automation to prevent duplicate tasks
   Format: "auto_{entityType}_{entityId}_description" (use lowercase entityType in the key)
   Example: "auto_OPPORTUNITY_{opportunityId}_order_materials"
2. rescheduleOnTriggerChange: true means if the trigger field changes again, update the task due date
3. Always include a clear, descriptive name for the rule
4. Use appropriate task types (MANUAL for ordering, COMMUNICATION for calls, etc.)
5. If user mentions assigning to someone, match their name/email to a user ID

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "name": "Descriptive rule name",
  "enabled": true,
  "trigger": {
    "type": "FIELD_UPDATED",
    "entityType": "OPPORTUNITY",
    "fieldName": "deliveryDate"
  },
  "actions": [{
    "type": "CREATE_TASK",
    "taskTitle": "Task name",
    "taskDescription": "Optional description",
    "taskType": "MANUAL",
    "priority": "MEDIUM",
    "assignToUserId": "user-id-or-omit",
    "relatedTo": "OPPORTUNITY",
    "dueAtCalculation": {
      "type": "RELATIVE_TO_FIELD",
      "fieldName": "deliveryDate",
      "offsetDays": -20
    },
    "rescheduleOnTriggerChange": true,
    "taskInstanceKey": "auto_OPPORTUNITY_{opportunityId}_unique_key"
  }]
}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: prompt },
    ];

    const result = await send("gpt-4o", messages, { temperature: 0.2, max_tokens: 2000 });
    
    // Parse the AI response
    let automationRule: any;
    try {
      // Remove markdown code blocks if present
      let jsonText = result.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
      }
      automationRule = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("[AutomationRules Generate] Failed to parse AI response:", result.text);
      return res.status(500).json({ error: "Failed to parse AI response", details: result.text.slice(0, 500) });
    }

    // Validate against schema
    try {
      const validated = AutomationRuleSchema.parse(automationRule);
      res.json({ 
        rule: validated,
        usage: result.usage,
        rawResponse: result.text 
      });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.error("[AutomationRules Generate] Validation failed:", validationError.errors);
        return res.status(400).json({ 
          error: "Generated rule failed validation", 
          details: validationError.errors,
          generated: automationRule 
        });
      }
      throw validationError;
    }
  } catch (error) {
    console.error("[AutomationRules Generate] Error:", error);
    res.status(500).json({ error: "Failed to generate automation rule" });
  }
});

/**
 * DELETE /automation-rules/:id
 * Delete an automation rule
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    const { id } = req.params;

    const existing = await prisma.automationRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) return res.status(404).json({ error: "Rule not found" });

    await prisma.automationRule.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error("[AutomationRules DELETE] Error:", error);
    res.status(500).json({ error: "Failed to delete automation rule" });
  }
});

// ============================================================================
// Automation Engine - Evaluate and Execute
// ============================================================================

/**
 * Calculate due date based on configuration
 */
function calculateDueDate(
  calculation: DateCalculation,
  entity: any
): Date | null {
  if (calculation.type === 'FIXED_DATE' && calculation.fixedDate) {
    return new Date(calculation.fixedDate);
  }

  if (calculation.type === 'RELATIVE_TO_FIELD' && calculation.fieldName) {
    const fieldValue = entity[calculation.fieldName];
    if (!fieldValue) return null;

    const baseDate = new Date(fieldValue);
    if (isNaN(baseDate.getTime())) return null;

    const offsetDays = calculation.offsetDays || 0;
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + offsetDays);
    return dueDate;
  }

  return null;
}

/**
 * Evaluate conditions against an entity
 */
function evaluateConditions(
  conditions: any[] | null | undefined,
  entity: any
): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((condition) => {
    const fieldValue = entity[condition.field];

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'not_null':
        return fieldValue != null && fieldValue !== '';
      case 'is_null':
        return fieldValue == null || fieldValue === '';
      default:
        return false;
    }
  });
}

/**
 * Execute automation rules for a given entity update
 * This is the main function called from entity update hooks
 */
export async function evaluateAutomationRules(params: {
  tenantId: string;
  entityType: 'LEAD' | 'OPPORTUNITY' | 'PROJECT' | 'QUOTE';
  entityId: string;
  entity: any;
  changedFields?: string[];
  oldValues?: Record<string, any>;
  userId?: string;
}): Promise<void> {
  const { tenantId, entityType, entityId, entity, changedFields, oldValues, userId } = params;

  try {
    // Fetch all enabled automation rules for this tenant
    const rules = await prisma.automationRule.findMany({
      where: {
        tenantId,
        enabled: true,
      },
    });

    console.log(`[Automation] Evaluating ${rules.length} rules for ${entityType}:${entityId}`);

    for (const rule of rules) {
      const trigger = rule.trigger as any;

      // Check if trigger matches
      if (trigger.entityType !== entityType) continue;

      let triggerMatches = false;

      switch (trigger.type) {
        case 'FIELD_UPDATED':
          if (changedFields && trigger.fieldName && changedFields.includes(trigger.fieldName)) {
            triggerMatches = true;
          }
          break;

        case 'STATUS_CHANGED':
          if (changedFields && changedFields.includes('status')) {
            triggerMatches = true;
          }
          break;

        case 'RECORD_CREATED':
          // This would be triggered on create, not update
          // Handle separately in create hooks
          break;

        default:
          break;
      }

      if (!triggerMatches) continue;

      // Evaluate conditions
      const conditionsMet = evaluateConditions(rule.conditions as any, entity);
      if (!conditionsMet) {
        console.log(`[Automation] Rule "${rule.name}" conditions not met`);
        continue;
      }

      console.log(`[Automation] Executing rule: ${rule.name}`);

      // Execute actions
      const actions = rule.actions as TaskAction[];
      for (const action of actions) {
        if (action.type === 'CREATE_TASK') {
          await executeCreateTaskAction({
            action,
            entity,
            entityType,
            entityId,
            tenantId,
            userId: action.assignToUserId || userId,
            triggeredByField: trigger.fieldName,
            oldFieldValue: oldValues?.[trigger.fieldName],
          });
        }
      }
    }
  } catch (error) {
    console.error('[Automation] Error evaluating rules:', error);
  }
}

/**
 * Execute a CREATE_TASK action
 */
async function executeCreateTaskAction(params: {
  action: TaskAction;
  entity: any;
  entityType: string;
  entityId: string;
  tenantId: string;
  userId?: string;
  triggeredByField?: string;
  oldFieldValue?: any;
}): Promise<void> {
  const { action, entity, entityType, entityId, tenantId, userId, triggeredByField, oldFieldValue } = params;

  try {
    // Generate unique task instance key
    const instanceKey = action.taskInstanceKey
      ? action.taskInstanceKey.replace(/\{(\w+)\}/g, (_, field) => entity[field] || '')
      : `auto_${entityType}_${entityId}_${action.taskTitle.replace(/\s+/g, '_')}`;

    // Check if this task already exists
    const existingTask = await prisma.task.findFirst({
      where: {
        tenantId,
        relatedType: entityType as any,
        relatedId: entityId,
        meta: {
          path: ['automationInstanceKey'],
          equals: instanceKey,
        },
        status: { not: 'CANCELLED' },
      },
    });

    // Calculate due date
    const dueAt = calculateDueDate(action.dueAtCalculation, entity);

    if (existingTask) {
      // If rescheduleOnTriggerChange is true and the due date has changed, update the task
      if (action.rescheduleOnTriggerChange && dueAt) {
        const existingDueAt = existingTask.dueAt ? new Date(existingTask.dueAt).getTime() : null;
        const newDueAt = dueAt.getTime();

        if (existingDueAt !== newDueAt) {
          console.log(`[Automation] Rescheduling task ${existingTask.id} from ${existingDueAt} to ${newDueAt}`);

          await prisma.task.update({
            where: { id: existingTask.id },
            data: {
              dueAt,
              meta: {
                ...((existingTask.meta as any) || {}),
                rescheduledAt: new Date().toISOString(),
                rescheduledFrom: existingTask.dueAt,
                rescheduleTrigger: triggeredByField,
              },
            },
          });
        }
      }
      return; // Task already exists, don't create duplicate
    }

    // Determine assignee
    const assigneeUserId = action.assignToUserId || userId;
    const assignees = assigneeUserId ? [{ userId: assigneeUserId, role: 'OWNER' as const }] : [];

    // Create the task
    const task = await prisma.task.create({
      data: {
        tenantId,
        title: action.taskTitle,
        description: action.taskDescription || `Automatically created for ${entityType}`,
        taskType: action.taskType,
        priority: action.priority,
        relatedType: entityType as any,
        relatedId: entityId,
        status: 'OPEN',
        dueAt,
        autocreated: true,
        formSchema: action.formSchema,
        checklistItems: action.checklistItems,
        requiresSignature: action.requiresSignature,
        meta: {
          automationInstanceKey: instanceKey,
          automationTriggeredBy: triggeredByField,
          automationTriggerValue: entity[triggeredByField || ''],
          createdByAutomation: true,
          ...(action.processCode ? { processCode: action.processCode } : {}),
        },
        assignees: assignees.length > 0 ? {
          create: assignees,
        } : undefined,
      },
    });

    console.log(`[Automation] Created task ${task.id}: ${task.title}`);
  } catch (error) {
    console.error('[Automation] Error creating task:', error);
  }
}

export default router;
