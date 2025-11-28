// api/src/routes/automation-rules.ts
import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { z } from "zod";

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
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId) return res.status(400).json({ error: "Missing x-tenant-id" });

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
    const tenantId = req.headers["x-tenant-id"] as string;
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
    const tenantId = req.headers["x-tenant-id"] as string;
    const userId = req.headers["x-user-id"] as string;
    if (!tenantId) return res.status(400).json({ error: "Missing x-tenant-id" });

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
    const tenantId = req.headers["x-tenant-id"] as string;
    const userId = req.headers["x-user-id"] as string;
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
 * DELETE /automation-rules/:id
 * Delete an automation rule
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
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
