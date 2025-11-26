// api/src/services/recurring-task-processor.ts
import { prisma } from "../prisma";

/**
 * Recurring Task Processor
 * 
 * Checks TaskTemplates with recurrence patterns and generates new Task instances
 * when the next scheduled occurrence is due.
 */

interface ProcessResult {
  processed: number;
  created: number;
  errors: number;
}

/**
 * Calculate next due date based on recurrence pattern
 */
function calculateNextDueDate(
  lastDueDate: Date,
  pattern: string,
  interval: number = 1
): Date {
  const next = new Date(lastDueDate);
  
  switch (pattern) {
    case "DAILY":
      next.setDate(next.getDate() + interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + (7 * interval));
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + interval);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + (3 * interval));
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      throw new Error(`Unknown recurrence pattern: ${pattern}`);
  }
  
  return next;
}

/**
 * Process all active recurring task templates and generate tasks
 */
export async function processRecurringTasks(): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: 0,
    created: 0,
    errors: 0,
  };

  try {
    const now = new Date();

    // Find all active task templates with recurrence patterns
    const templates = await prisma.taskTemplate.findMany({
      where: {
        isActive: true,
        taskType: "SCHEDULED",
        recurrencePattern: {
          not: null,
        },
      },
    });

    console.log(`[recurring-tasks] Found ${templates.length} active recurring templates`);

    for (const template of templates) {
      result.processed++;

      try {
        // Find the most recent task generated from this template
        const lastTask = await prisma.task.findFirst({
          where: {
            templateId: template.id,
            tenantId: template.tenantId,
          },
          orderBy: {
            nextDueAt: "desc",
          },
        });

        // Determine the next due date
        let nextDueDate: Date;
        
        if (lastTask && lastTask.nextDueAt) {
          // Use the nextDueAt from the last task
          nextDueDate = lastTask.nextDueAt;
        } else if (lastTask && lastTask.dueAt) {
          // Calculate from last task's dueAt
          nextDueDate = calculateNextDueDate(
            lastTask.dueAt,
            template.recurrencePattern!,
            template.recurrenceInterval || 1
          );
        } else {
          // First occurrence - create one now
          nextDueDate = now;
        }

        // Check if it's time to create a new task
        if (nextDueDate <= now) {
          // Calculate the subsequent next due date
          const subsequentNextDueDate = calculateNextDueDate(
            nextDueDate,
            template.recurrencePattern!,
            template.recurrenceInterval || 1
          );

          // Create the new task
          const newTask = await prisma.task.create({
            data: {
              tenantId: template.tenantId,
              templateId: template.id,
              taskType: template.taskType,
              title: template.defaultTitle,
              description: template.defaultDescription,
              priority: template.defaultPriority,
              relatedType: template.relatedType || "OTHER",
              status: "OPEN",
              dueAt: nextDueDate,
              nextDueAt: subsequentNextDueDate,
              formSchema: template.formSchema,
              requiresSignature: template.requiresSignature,
              checklistItems: template.checklistItems,
              assignees: template.defaultAssigneeIds?.length
                ? {
                    create: template.defaultAssigneeIds.map((userId) => ({
                      userId,
                      role: "OWNER",
                    })),
                  }
                : undefined,
            },
          });

          console.log(
            `[recurring-tasks] Created task ${newTask.id} from template ${template.id} (${template.name})`
          );

          result.created++;

          // Log activity
          await prisma.activityLog.create({
            data: {
              tenantId: template.tenantId,
              entity: "TASK",
              entityId: newTask.id,
              verb: "CREATED",
              data: {
                source: "recurring_template",
                templateId: template.id,
                templateName: template.name,
              } as any,
            },
          });

          // Create notifications for assignees
          if (template.defaultAssigneeIds?.length) {
            await prisma.notification.createMany({
              data: template.defaultAssigneeIds.map((userId) => ({
                tenantId: template.tenantId,
                userId,
                type: "MENTION" as any,
                payload: {
                  kind: "RECURRING_TASK",
                  taskId: newTask.id,
                  title: newTask.title,
                  dueAt: newTask.dueAt,
                } as any,
              })),
            });
          }
        }
      } catch (error: any) {
        console.error(
          `[recurring-tasks] Error processing template ${template.id}:`,
          error.message
        );
        result.errors++;
      }
    }

    console.log(
      `[recurring-tasks] Completed: ${result.created} tasks created, ${result.errors} errors`
    );
  } catch (error: any) {
    console.error("[recurring-tasks] Fatal error:", error.message);
    result.errors++;
  }

  return result;
}

/**
 * Start the recurring task processor with a specified interval
 * @param intervalMinutes - How often to check for tasks (default: 60 minutes)
 */
export function startRecurringTaskProcessor(intervalMinutes: number = 60): void {
  console.log(`[recurring-tasks] Starting processor (checking every ${intervalMinutes} minutes)`);

  // Run immediately on startup
  processRecurringTasks().catch((err) => {
    console.error("[recurring-tasks] Initial run failed:", err);
  });

  // Then run on interval
  setInterval(
    () => {
      processRecurringTasks().catch((err) => {
        console.error("[recurring-tasks] Interval run failed:", err);
      });
    },
    intervalMinutes * 60 * 1000
  );
}
