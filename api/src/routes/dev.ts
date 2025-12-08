import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { env } from "../env";
import dayjs from "dayjs";

const router = Router();
// Copy workshop processes from a template tenant to all tenants (idempotent)
router.post("/workshop-processes/sync-from-template", requireDeveloper, async (req: any, res) => {
  try {
    const templateSlug = (req.body?.templateSlug as string) || process.env.TEMPLATE_TENANT_SLUG || 'wealden-joinery';
    const template = await prisma.tenant.findFirst({ where: { slug: templateSlug } });
    if (!template) return res.status(404).json({ error: "template_tenant_not_found" });

    const defs = await prisma.workshopProcessDefinition.findMany({ where: { tenantId: template.id } });
    if (!defs.length) return res.json({ ok: true, message: "no_template_processes" });

    const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
    let created = 0, skipped = 0;
    for (const t of tenants) {
      if (t.id === template.id) continue; // skip template itself
      for (const d of defs) {
        try {
          await prisma.workshopProcessDefinition.create({
            data: {
              tenantId: t.id,
              code: d.code,
              name: d.name,
              sortOrder: d.sortOrder ?? 0,
              requiredByDefault: d.requiredByDefault ?? true,
              estimatedHours: d.estimatedHours,
              isColorKey: d.isColorKey ?? false,
              assignmentGroup: d.assignmentGroup || null,
            }
          });
          created++;
        } catch (e: any) {
          if (e?.code === 'P2002') { skipped++; } else throw e;
        }
      }
    }
    res.json({ ok: true, created, skipped, template: templateSlug });
  } catch (e: any) {
    console.error("[dev sync processes] failed:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// Copy processes from a specific tenant to another (idempotent)
router.post("/workshop-processes/copy", requireDeveloper, async (req: any, res) => {
  try {
    const { fromSlug, toSlug, fromName, toName, replace } = req.body || {};
    const fromTenant = fromSlug
      ? await prisma.tenant.findFirst({ where: { slug: fromSlug } })
      : await prisma.tenant.findFirst({ where: { name: fromName } });
    const toTenant = toSlug
      ? await prisma.tenant.findFirst({ where: { slug: toSlug } })
      : await prisma.tenant.findFirst({ where: { name: toName } });

    if (!fromTenant) return res.status(404).json({ error: "from_tenant_not_found" });
    if (!toTenant) return res.status(404).json({ error: "to_tenant_not_found" });
    if (fromTenant.id === toTenant.id) return res.status(400).json({ error: "same_tenant" });

    const defs = await prisma.workshopProcessDefinition.findMany({ where: { tenantId: fromTenant.id } });
    let created = 0, updated = 0, skipped = 0;
    for (const d of defs) {
      const existing = await prisma.workshopProcessDefinition.findFirst({ where: { tenantId: toTenant.id, code: d.code } });
      if (!existing) {
        await prisma.workshopProcessDefinition.create({
          data: {
            tenantId: toTenant.id,
            code: d.code,
            name: d.name,
            sortOrder: d.sortOrder ?? 0,
            requiredByDefault: d.requiredByDefault ?? true,
            estimatedHours: d.estimatedHours,
            isColorKey: d.isColorKey ?? false,
            assignmentGroup: d.assignmentGroup || null,
          }
        });
        created++;
      } else if (replace) {
        await prisma.workshopProcessDefinition.update({
          where: { id: existing.id },
          data: {
            name: d.name,
            sortOrder: d.sortOrder ?? 0,
            requiredByDefault: d.requiredByDefault ?? true,
            estimatedHours: d.estimatedHours,
            isColorKey: d.isColorKey ?? false,
            assignmentGroup: d.assignmentGroup || null,
          }
        });
        updated++;
      } else {
        skipped++;
      }
    }
    res.json({ ok: true, from: fromSlug || fromName, to: toSlug || toName, created, updated, skipped });
  } catch (e: any) {
    console.error("[dev copy processes] failed:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// Middleware to require developer role
function requireDeveloper(req: any, res: any, next: any) {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Check if user is a developer
  prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { isDeveloper: true, role: true }
  }).then(user => {
    if (!user?.isDeveloper) {
      return res.status(403).json({ error: "Developer access required" });
    }
    next();
  }).catch(err => {
    console.error("Developer auth check failed:", err);
    res.status(500).json({ error: "Auth check failed" });
  });
}

// ==============================
// Tenant Management (Developer Only)
// ==============================

// Get all tenants
router.get("/tenants", requireDeveloper, async (req: any, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            leads: true,
            opportunities: true,
            feedbacks: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ ok: true, tenants });
  } catch (error: any) {
    console.error("Failed to fetch tenants:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get tenant details
router.get("/tenants/:id", requireDeveloper, async (req: any, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            signupCompleted: true
          }
        },
        _count: {
          select: {
            leads: true,
            opportunities: true,
            quotes: true,
            feedbacks: true,
            tasks: true,
            emailMessages: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({ ok: true, tenant });
  } catch (error: any) {
    console.error("Failed to fetch tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// Impersonate tenant (login as tenant owner for troubleshooting)
router.post("/tenants/:id/impersonate", requireDeveloper, async (req: any, res) => {
  try {
    const jwt = require("jsonwebtoken");
    const bcrypt = require("bcrypt");
    const jwtSecret = process.env.APP_JWT_SECRET || process.env.JWT_SECRET || "fallback-secret";
    
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id }
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Get the current developer's email
    const developer = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { email: true, name: true }
    });

    if (!developer) {
      return res.status(404).json({ error: "Developer user not found" });
    }

    // Create or find a developer user for this tenant
    // Use a unique email per tenant to avoid unique constraint errors
    const devEmail = `dev+${tenant.slug}@joineryai.app`;
    
    let devUser = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: devEmail
      }
    });

    const devPassword = 'DevAccess123!';

    if (!devUser) {
      // Create a developer user for this tenant with a known password
      devUser = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: devEmail,
          name: `${developer.name || 'Developer'} (Dev Access)`,
          role: 'owner', // Give them owner access for full visibility
          isDeveloper: true,
          signupCompleted: true,
          passwordHash: await bcrypt.hash(devPassword, 10)
        }
      });
      console.log(`[IMPERSONATE] Created developer user ${devEmail} for tenant ${tenant.name} with password: ${devPassword}`);
    } else {
      // Always reset password to known value so manual login works even if originally random
      await prisma.user.update({
        where: { id: devUser.id },
        data: { passwordHash: await bcrypt.hash(devPassword, 10) }
      });
      console.log(`[IMPERSONATE] Refreshed password for existing dev user ${devEmail} (tenant ${tenant.slug})`);
    }
    
    // Create JWT token for the developer user in this tenant
    const token = jwt.sign(
      {
        userId: devUser.id,
        tenantId: tenant.id,
        role: devUser.role,
        impersonating: true,
        impersonatedBy: req.auth.userId
      },
      jwtSecret,
      { expiresIn: "8h" }
    );

    console.log(`[IMPERSONATE] Developer ${req.auth.userId} logging in as ${devUser.email} (${devUser.id}) for tenant ${tenant.name} (${tenant.id})`);
    console.log(`[IMPERSONATE] JWT payload:`, {
      userId: devUser.id,
      tenantId: tenant.id,
      role: devUser.role,
      impersonating: true
    });

    res.json({ 
      ok: true, 
      token,
      user: {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
        role: devUser.role
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      }
    });
  } catch (error: any) {
    console.error("Failed to impersonate tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mark user as setup complete
router.post("/users/:userId/complete", requireDeveloper, async (req: any, res) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { signupCompleted: true }
    });

    res.json({ 
      ok: true,
      message: "User marked as setup complete"
    });
  } catch (error: any) {
    console.error("Failed to mark user complete:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete tenant (for test/demo tenants only)
router.delete("/tenants/:id", requireDeveloper, async (req: any, res) => {
  try {
    const tenantId = req.params.id;
    
    // First check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            leads: true,
            opportunities: true,
            quotes: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Delete all related records in transaction
    await prisma.$transaction(async (tx) => {
      // Delete in order of foreign key dependencies
      
      // Email and messaging
      await tx.emailIngest.deleteMany({ where: { tenantId } });
      await tx.emailMessage.deleteMany({ where: { tenantId } });
      await tx.emailThread.deleteMany({ where: { tenantId } });
      
      // Connections
      await tx.gmailTenantConnection.deleteMany({ where: { tenantId } });
      await tx.gmailUserConnection.deleteMany({ where: { tenantId } });
      await tx.ms365TenantConnection.deleteMany({ where: { tenantId } });
      await tx.ms365UserConnection.deleteMany({ where: { tenantId } });
      
      // Quotes and suppliers
      await tx.supplierQuoteRequest.deleteMany({ where: { tenantId } });
      await tx.supplier.deleteMany({ where: { tenantId } });
      await tx.uploadedFile.deleteMany({ where: { tenantId } });
      await tx.quote.deleteMany({ where: { tenantId } });
      
      // Opportunities and leads
      await tx.opportunity.deleteMany({ where: { tenantId } });
      await tx.leadFieldDef.deleteMany({ where: { tenantId } });
      await tx.lead.deleteMany({ where: { tenantId } });
      
      // Tasks and feedback
      await tx.task.deleteMany({ where: { tenantId } });
      await tx.feedback.deleteMany({ where: { tenantId } });
      
      // Automation and notifications
      await tx.automationRule.deleteMany({ where: { tenantId } });
      await tx.notification.deleteMany({ where: { tenantId } });
      await tx.streak.deleteMany({ where: { tenantId } });
      await tx.activityLog.deleteMany({ where: { tenantId } });
      await tx.userPreference.deleteMany({ where: { tenantId } });
      
      // Training and ML
      await tx.trainingEvent.deleteMany({ where: { tenantId } });
      await tx.trainingInsights.deleteMany({ where: { tenantId } });
      await tx.modelOverride.deleteMany({ where: { tenantId } });
      
      // Follow-ups
      await tx.followUpTemplate.deleteMany({ where: { tenantId } });
      await tx.followUpEvent.deleteMany({ where: { tenantId } });
      
      // Workshop
      await tx.projectProcessAssignment.deleteMany({ where: { tenantId } });
      await tx.workshopProcessDefinition.deleteMany({ where: { tenantId } });
      await tx.processPlan.deleteMany({ where: { tenantId } });
      await tx.timeEntry.deleteMany({ where: { tenantId } });
      await tx.holiday.deleteMany({ where: { tenantId } });
      await tx.target.deleteMany({ where: { tenantId } });
      
      // SEO and Ads
      await tx.sourceSpend.deleteMany({ where: { tenantId } });
      await tx.keywordPerformance.deleteMany({ where: { tenantId } });
      await tx.keywordSuggestion.deleteMany({ where: { tenantId } });
      
      // Landing page
      await tx.landingTenant.deleteMany({ where: { tenantId } });
      
      // Feature requests
      await tx.featureRequest.deleteMany({ where: { tenantId } });
      
      // Finally delete users and tenant
      await tx.user.deleteMany({ where: { tenantId } });
      await tx.tenant.delete({ where: { id: tenantId } });
    });

    res.json({ 
      ok: true, 
      message: `Tenant ${tenant.name} and all related data deleted successfully`,
      deletedCounts: tenant._count
    });
  } catch (error: any) {
    console.error("Failed to delete tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Feedback Management (Developer Only)
// ==============================

// Get all feedback across tenants
router.get("/feedback", requireDeveloper, async (req: any, res) => {
  try {
    const { status, priority, category, tenantId } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (tenantId) where.tenantId = tenantId;

    const feedbacks = await prisma.feedback.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, slug: true }
        },
        user: {
          select: { id: true, email: true, name: true }
        },
        resolvedBy: {
          select: { id: true, email: true, name: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({ ok: true, feedbacks });
  } catch (error: any) {
    console.error("Failed to fetch feedback:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update feedback
router.patch("/feedback/:id", requireDeveloper, async (req: any, res) => {
  try {
    const { status, priority, category, devNotes, devResponse, devScreenshotUrls, linkedTaskId } = req.body;
    
    const feedback = await prisma.feedback.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(category && { category }),
        ...(devNotes !== undefined && { devNotes }),
        ...(devResponse !== undefined && { devResponse }),
        ...(devScreenshotUrls !== undefined && { devScreenshotUrls }),
        ...(linkedTaskId !== undefined && { linkedTaskId }),
        ...(status === 'COMPLETED' && { resolvedAt: new Date(), resolvedById: req.auth.userId })
      },
      include: {
        tenant: { select: { name: true, slug: true } },
        user: { select: { email: true, name: true } }
      }
    });

    res.json({ ok: true, feedback });
  } catch (error: any) {
    console.error("Failed to update feedback:", error);
    res.status(500).json({ error: error.message });
  }
});

// Send email notification about feedback response
router.post("/feedback/:id/notify", requireDeveloper, async (req: any, res) => {
  try {
    const { recipientUserId } = req.body || {};
    const feedback = await prisma.feedback.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: { select: { name: true, slug: true } },
        user: { select: { email: true, name: true, id: true } }
      }
    });

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    let recipientUser = feedback.user;
    if (recipientUserId && (!feedback.user || recipientUserId !== feedback.user.id)) {
      // Fetch the selected recipient user
      recipientUser = await prisma.user.findUnique({
        where: { id: recipientUserId },
        select: { id: true, email: true, name: true }
      });
    }

    if (!recipientUser?.email) {
      return res.status(400).json({ error: "Recipient user has no email address" });
    }

    // Construct feedback URL
    const feedbackUrl = `${process.env.WEB_URL || 'https://joineryai.app'}/feedback?highlight=${feedback.id}`;

    // Build email content
    let emailHtml = `
      <h2>Update on Your Feedback</h2>
      <p>Hi ${recipientUser.name || 'there'},</p>
      <p>We've updated the feedback you submitted for <strong>${feedback.feature}</strong>.</p>
    `;

    if (feedback.devResponse) {
      emailHtml += `
        <h3>Developer Response:</h3>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
          ${feedback.devResponse.replace(/\n/g, '<br>')}
        </div>
      `;
    }

    // Process screenshots - convert base64 to attachments
    const attachments: any[] = [];
    if (feedback.devScreenshotUrls && feedback.devScreenshotUrls.length > 0) {
      emailHtml += `<h3>Screenshots attached (${feedback.devScreenshotUrls.length} image(s)):</h3>`;
      
      feedback.devScreenshotUrls.forEach((dataUrl: string, idx: number) => {
        if (dataUrl.startsWith('data:')) {
          // Extract mime type and base64 content
          const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const extension = mimeType.split('/')[1] || 'png';
            
            attachments.push({
              filename: `screenshot-${idx + 1}.${extension}`,
              content: base64Data,
              contentType: mimeType
            });
            
            // Reference attachment in HTML using cid
            emailHtml += `<p>${idx + 1}. <img src="cid:screenshot-${idx + 1}.${extension}" alt="Screenshot ${idx + 1}" style="max-width: 600px; border: 1px solid #ddd; border-radius: 5px; margin: 10px 0; display: block;" /></p>`;
          }
        }
      });
    }

    emailHtml += `
      <p><strong>Current Status:</strong> ${feedback.status}</p>
      <p><a href="${feedbackUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">View Your Feedback</a></p>
      <p style="color: #666; font-size: 0.9em; margin-top: 20px;">Thank you for helping us improve!</p>
    `;

    // Send email using resend
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const emailPayload: any = {
      from: process.env.EMAIL_FROM || 'JoineryAI <noreply@joineryai.app>',
      to: recipientUser.email,
      subject: `Update on your feedback: ${feedback.feature}`,
      html: emailHtml
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    await resend.emails.send(emailPayload);

    // Mark as notified
    await prisma.feedback.update({
      where: { id: req.params.id },
      data: { emailNotificationSent: true }
    });

    res.json({ ok: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("Failed to send feedback notification:", error);
    res.status(500).json({ error: error.message });
  }
});

// Upload screenshot for feedback
router.post("/feedback/upload-screenshot", requireDeveloper, async (req: any, res) => {
  try {
    const base64 = req.body?.screenshot as string;
    if (!base64 || !base64.startsWith("data:")) {
      return res.status(400).json({ error: "Invalid screenshot data" });
    }

    // Base64 data URLs are already in the correct format to send back
    // They can be used directly as img src attributes
    res.json({ ok: true, url: base64 });
  } catch (error: any) {
    console.error("Failed to upload screenshot:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add screenshot URL to feedback
router.post("/feedback/:id/add-screenshot", requireDeveloper, async (req: any, res) => {
  try {
    const screenshotUrl = req.body?.screenshotUrl as string;
    if (!screenshotUrl) {
      return res.status(400).json({ error: "Screenshot URL required" });
    }

    const feedback = await prisma.feedback.findUnique({
      where: { id: req.params.id }
    });

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    const urls = feedback.devScreenshotUrls || [];
    if (!urls.includes(screenshotUrl)) {
      urls.push(screenshotUrl);
    }

    const updated = await prisma.feedback.update({
      where: { id: req.params.id },
      data: { devScreenshotUrls: urls },
      include: {
        tenant: { select: { name: true, slug: true } },
        user: { select: { email: true, name: true } }
      }
    });

    res.json({ ok: true, feedback: updated });
  } catch (error: any) {
    console.error("Failed to add screenshot:", error);
    res.status(500).json({ error: error.message });
  }
});

// Remove screenshot URL from feedback
router.post("/feedback/:id/remove-screenshot", requireDeveloper, async (req: any, res) => {
  try {
    const screenshotUrl = req.body?.screenshotUrl as string;
    if (!screenshotUrl) {
      return res.status(400).json({ error: "Screenshot URL required" });
    }

    const feedback = await prisma.feedback.findUnique({
      where: { id: req.params.id }
    });

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    const urls = (feedback.devScreenshotUrls || []).filter(url => url !== screenshotUrl);

    const updated = await prisma.feedback.update({
      where: { id: req.params.id },
      data: { devScreenshotUrls: urls },
      include: {
        tenant: { select: { name: true, slug: true } },
        user: { select: { email: true, name: true } }
      }
    });

    res.json({ ok: true, feedback: updated });
  } catch (error: any) {
    console.error("Failed to remove screenshot:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Dev Task Management (Developer Only)
// ==============================

// Get all dev tasks
router.get("/tasks", requireDeveloper, async (req: any, res) => {
  try {
    const { status, sprint, priority } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (sprint) where.sprint = sprint;
    if (priority) where.priority = priority;

    const tasks = await prisma.devTask.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({ ok: true, tasks });
  } catch (error: any) {
    console.error("Failed to fetch dev tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create dev task
router.post("/tasks", requireDeveloper, async (req: any, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      type,
      category,
      sprint,
      estimatedHours,
      assignee,
      scheduledDate,
      feedbackIds,
      tenantIds,
      notes
    } = req.body;

    const task = await prisma.devTask.create({
      data: {
        title,
        description,
        status: status || 'BACKLOG',
        priority: priority || 'MEDIUM',
        type: type || 'DEVELOPMENT',
        category,
        sprint,
        estimatedHours,
        assignee,
        scheduledDate,
        feedbackIds: feedbackIds || [],
        tenantIds: tenantIds || [],
        notes
      }
    });

    res.json({ ok: true, task });
  } catch (error: any) {
    console.error("Failed to create dev task:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update dev task
router.patch("/tasks/:id", requireDeveloper, async (req: any, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      type,
      category,
      sprint,
      estimatedHours,
      actualHours,
      assignee,
      scheduledDate,
      feedbackIds,
      tenantIds,
      notes
    } = req.body;

    const task = await prisma.devTask.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { 
          status,
          ...(status === 'DONE' && { completedAt: new Date() })
        }),
        ...(priority && { priority }),
        ...(type && { type }),
        ...(category && { category }),
        ...(sprint !== undefined && { sprint }),
        ...(estimatedHours !== undefined && { estimatedHours }),
        ...(actualHours !== undefined && { actualHours }),
        ...(assignee !== undefined && { assignee }),
        ...(scheduledDate !== undefined && { scheduledDate }),
        ...(feedbackIds && { feedbackIds }),
        ...(tenantIds && { tenantIds }),
        ...(notes !== undefined && { notes })
      }
    });

    res.json({ ok: true, task });
  } catch (error: any) {
    console.error("Failed to update dev task:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete dev task
router.delete("/tasks/:id", requireDeveloper, async (req: any, res) => {
  try {
    await prisma.devTask.delete({
      where: { id: req.params.id }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to delete dev task:", error);
    res.status(500).json({ error: error.message });
  }
});

// Link feedback to task
router.post("/tasks/:id/feedbacks", requireDeveloper, async (req: any, res) => {
  try {
    const { feedbackIds } = req.body;
    if (!Array.isArray(feedbackIds) || feedbackIds.length === 0) {
      return res.status(400).json({ error: "feedbackIds array required" });
    }

    // Create links for each feedback
    const links = await Promise.all(
      feedbackIds.map(feedbackId =>
        prisma.devTaskFeedback.upsert({
          where: {
            devTaskId_feedbackId: {
              devTaskId: req.params.id,
              feedbackId
            }
          },
          create: {
            devTaskId: req.params.id,
            feedbackId
          },
          update: {}
        })
      )
    );

    res.json({ ok: true, links });
  } catch (error: any) {
    console.error("Failed to link feedbacks:", error);
    res.status(500).json({ error: error.message });
  }
});

// Unlink feedback from task
router.delete("/tasks/:id/feedbacks/:feedbackId", requireDeveloper, async (req: any, res) => {
  try {
    await prisma.devTaskFeedback.delete({
      where: {
        devTaskId_feedbackId: {
          devTaskId: req.params.id,
          feedbackId: req.params.feedbackId
        }
      }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to unlink feedback:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get developer statistics
router.get("/stats", requireDeveloper, async (req: any, res) => {
  try {
    const { period, startDate, endDate, developerId, type } = req.query;
    
    // Get all developers
    const developers = await prisma.user.findMany({
      where: { isDeveloper: true },
      select: {
        id: true,
        email: true,
        name: true,
        isDeveloper: true
      }
    });

    // Build date filter
    const dateFilter: any = {};
    if (period === 'day' && startDate) {
      dateFilter.startedAt = {
        gte: new Date(startDate as string),
        lt: new Date(new Date(startDate as string).getTime() + 24 * 60 * 60 * 1000)
      };
    } else if (period === 'week' && startDate) {
      const weekEnd = new Date(startDate as string);
      weekEnd.setDate(weekEnd.getDate() + 7);
      dateFilter.startedAt = { gte: new Date(startDate as string), lt: weekEnd };
    } else if (period === 'month' && startDate) {
      const monthStart = new Date(startDate as string);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      dateFilter.startedAt = { gte: monthStart, lt: monthEnd };
    } else if (period === 'year' && startDate) {
      const yearStart = new Date(startDate as string);
      const yearEnd = new Date(yearStart.getFullYear() + 1, 0, 1);
      dateFilter.startedAt = { gte: yearStart, lt: yearEnd };
    } else if (startDate && endDate) {
      dateFilter.startedAt = { gte: new Date(startDate as string), lte: new Date(endDate as string) };
    }

    // Get time entries with task info
    const timeEntries = await prisma.devTimeEntry.findMany({
      where: {
        ...(developerId && { userId: developerId as string }),
        ...dateFilter
      },
      include: {
        devTask: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            priority: true,
            assignee: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    // Calculate stats per developer per type
    const statsByDeveloper: any = {};
    
    developers.forEach(dev => {
      statsByDeveloper[dev.id] = {
        developer: dev,
        totalHours: 0,
        byType: {},
        taskCount: new Set(),
        completedTasks: 0
      };
    });

    // Process time entries
    timeEntries.forEach(entry => {
      if (!entry.endedAt || !entry.durationMs) return;
      
      const hours = entry.durationMs / (1000 * 60 * 60);
      const devId = entry.userId;
      const taskType = entry.devTask?.type || 'OTHER';
      
      if (statsByDeveloper[devId]) {
        statsByDeveloper[devId].totalHours += hours;
        statsByDeveloper[devId].taskCount.add(entry.devTaskId);
        
        if (!statsByDeveloper[devId].byType[taskType]) {
          statsByDeveloper[devId].byType[taskType] = {
            hours: 0,
            tasks: new Set()
          };
        }
        
        statsByDeveloper[devId].byType[taskType].hours += hours;
        statsByDeveloper[devId].byType[taskType].tasks.add(entry.devTaskId);
        
        if (entry.devTask?.status === 'DONE') {
          statsByDeveloper[devId].completedTasks++;
        }
      }
    });

    // Format output
    const stats = Object.values(statsByDeveloper).map((stat: any) => {
      const byType: any = {};
      Object.entries(stat.byType).forEach(([type, data]: [string, any]) => {
        byType[type] = {
          hours: Math.round(data.hours * 100) / 100,
          taskCount: data.tasks.size
        };
      });
      
      return {
        developer: stat.developer,
        totalHours: Math.round(stat.totalHours * 100) / 100,
        taskCount: stat.taskCount.size,
        completedTasks: stat.completedTasks,
        byType
      };
    });

    res.json({ ok: true, stats, period: period || 'all' });
  } catch (error: any) {
    console.error("Failed to fetch dev stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Dev Task Time Tracking (Developer Only)
// ==============================

// Get active timer for current user
router.get("/timer/active", requireDeveloper, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const activeTimer = await prisma.devTimeEntry.findFirst({
      where: {
        userId,
        endedAt: null
      },
      include: {
        devTask: true
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json({ ok: true, timer: activeTimer });
  } catch (error: any) {
    console.error("Failed to get active timer:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start timer for a dev task
router.post("/timer/start", requireDeveloper, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const { devTaskId, notes } = req.body;
    if (!devTaskId) return res.status(400).json({ error: "devTaskId required" });

    // Stop any active timer first
    const activeTimer = await prisma.devTimeEntry.findFirst({
      where: {
        userId,
        endedAt: null
      }
    });

    if (activeTimer) {
      const endedAt = new Date();
      const durationMs = endedAt.getTime() - new Date(activeTimer.startedAt).getTime();
      await prisma.devTimeEntry.update({
        where: { id: activeTimer.id },
        data: {
          endedAt,
          durationMs
        }
      });
    }

    // Start new timer
    const timer = await prisma.devTimeEntry.create({
      data: {
        devTaskId,
        userId,
        notes,
        startedAt: new Date()
      },
      include: {
        devTask: true
      }
    });

    res.json({ ok: true, timer });
  } catch (error: any) {
    console.error("Failed to start timer:", error);
    res.status(500).json({ error: error.message });
  }
});

// Stop active timer
router.post("/timer/stop", requireDeveloper, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const { notes } = req.body;

    const activeTimer = await prisma.devTimeEntry.findFirst({
      where: {
        userId,
        endedAt: null
      }
    });

    if (!activeTimer) {
      return res.status(404).json({ error: "no_active_timer" });
    }

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - new Date(activeTimer.startedAt).getTime();

    const timer = await prisma.devTimeEntry.update({
      where: { id: activeTimer.id },
      data: {
        endedAt,
        durationMs,
        ...(notes && { notes })
      },
      include: {
        devTask: true
      }
    });

    // Update task's actualHours
    const totalMs = await prisma.devTimeEntry.aggregate({
      where: { devTaskId: timer.devTaskId },
      _sum: { durationMs: true }
    });
    
    const totalHours = (totalMs._sum.durationMs || 0) / (1000 * 60 * 60);
    await prisma.devTask.update({
      where: { id: timer.devTaskId },
      data: { actualHours: totalHours }
    });

    res.json({ ok: true, timer });
  } catch (error: any) {
    console.error("Failed to stop timer:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get time entries for a task
router.get("/tasks/:id/time-entries", requireDeveloper, async (req: any, res) => {
  try {
    const entries = await prisma.devTimeEntry.findMany({
      where: {
        devTaskId: req.params.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json({ ok: true, entries });
  } catch (error: any) {
    console.error("Failed to get time entries:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get time entries summary (for dashboard)
router.get("/time-entries/summary", requireDeveloper, async (req: any, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    const where: any = {};
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = new Date(startDate as string);
      if (endDate) where.startedAt.lte = new Date(endDate as string);
    }

    const entries = await prisma.devTimeEntry.findMany({
      where,
      include: {
        devTask: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    // Group by task
    const byTask = entries.reduce((acc: any, entry) => {
      const taskId = entry.devTaskId;
      if (!acc[taskId]) {
        acc[taskId] = {
          task: entry.devTask,
          entries: [],
          totalMs: 0,
          totalHours: 0
        };
      }
      acc[taskId].entries.push(entry);
      acc[taskId].totalMs += entry.durationMs || 0;
      acc[taskId].totalHours = acc[taskId].totalMs / (1000 * 60 * 60);
      return acc;
    }, {});

    // Group by user
    const byUser = entries.reduce((acc: any, entry) => {
      const userId = entry.userId;
      if (!acc[userId]) {
        acc[userId] = {
          user: entry.user,
          entries: [],
          totalMs: 0,
          totalHours: 0
        };
      }
      acc[userId].entries.push(entry);
      acc[userId].totalMs += entry.durationMs || 0;
      acc[userId].totalHours = acc[userId].totalMs / (1000 * 60 * 60);
      return acc;
    }, {});

    res.json({ 
      ok: true, 
      entries,
      byTask: Object.values(byTask),
      byUser: Object.values(byUser),
      totalMs: entries.reduce((sum, e) => sum + (e.durationMs || 0), 0),
      totalHours: entries.reduce((sum, e) => sum + (e.durationMs || 0), 0) / (1000 * 60 * 60)
    });
  } catch (error: any) {
    console.error("Failed to get time summary:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Calendar Scheduling (Developer Only)
// ==============================

// Get day schedules for a month
router.get("/calendar/schedules", requireDeveloper, async (req: any, res) => {
  try {
    const { month } = req.query;
    const date = month ? new Date(month as string) : new Date();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = endOfMonth.toISOString().split('T')[0];

    const schedules = await prisma.devDaySchedule.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    });

    res.json({ ok: true, schedules });
  } catch (error: any) {
    console.error("Failed to get schedules:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create or update day schedule
router.post("/calendar/schedules", requireDeveloper, async (req: any, res) => {
  try {
    const { date, isWorkDay, availableHours, notes } = req.body;
    if (!date) return res.status(400).json({ error: "date required" });

    const schedule = await prisma.devDaySchedule.upsert({
      where: { date },
      create: {
        date,
        isWorkDay: isWorkDay ?? true,
        availableHours: availableHours ?? 8,
        notes
      },
      update: {
        isWorkDay: isWorkDay ?? true,
        availableHours: availableHours ?? 8,
        notes
      }
    });

    res.json({ ok: true, schedule });
  } catch (error: any) {
    console.error("Failed to save schedule:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get task assignments for a month
router.get("/calendar/assignments", requireDeveloper, async (req: any, res) => {
  try {
    const { month } = req.query;
    const date = month ? new Date(month as string) : new Date();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = endOfMonth.toISOString().split('T')[0];

    const assignments = await prisma.devTaskAssignment.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        devTask: true
      },
      orderBy: { date: 'asc' }
    });

    res.json({ ok: true, assignments });
  } catch (error: any) {
    console.error("Failed to get assignments:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create task assignment
router.post("/calendar/assignments", requireDeveloper, async (req: any, res) => {
  try {
    const { devTaskId, date, allocatedHours } = req.body;
    if (!devTaskId || !date) {
      return res.status(400).json({ error: "devTaskId and date required" });
    }

    const assignment = await prisma.devTaskAssignment.create({
      data: {
        devTaskId,
        date,
        allocatedHours: allocatedHours || 1
      },
      include: {
        devTask: true
      }
    });

    res.json({ ok: true, assignment });
  } catch (error: any) {
    console.error("Failed to create assignment:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete task assignment
router.delete("/calendar/assignments/:id", requireDeveloper, async (req: any, res) => {
  try {
    await prisma.devTaskAssignment.delete({
      where: { id: req.params.id }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to delete assignment:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// ML Training Status (Developer Only)
// ==============================

// Get ML training status for all tenants
router.get("/ml/status", requireDeveloper, async (req: any, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true
      }
    });

    const statuses = await Promise.all(
      tenants.map(async (tenant) => {
        const [insights, events, leadCount, emailCount] = await Promise.all([
          prisma.trainingInsights.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            take: 1
          }),
          prisma.trainingEvent.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            take: 5
          }),
          prisma.lead.count({
            where: { tenantId: tenant.id }
          }),
          prisma.emailMessage.count({
            where: { tenantId: tenant.id }
          })
        ]);

        return {
          tenant,
          latestInsight: insights[0] || null,
          recentEvents: events,
          dataStats: {
            leadCount,
            emailCount
          }
        };
      })
    );

    res.json({ ok: true, statuses });
  } catch (error: any) {
    console.error("Failed to fetch ML status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed ML status for specific tenant
router.get("/ml/status/:tenantId", requireDeveloper, async (req: any, res) => {
  try {
    const { tenantId } = req.params;

    const [tenant, insights, events, overrides, leadCount, emailCount, opportunityCount] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true }
      }),
      prisma.trainingInsights.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.trainingEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.modelOverride.findMany({
        where: { tenantId }
      }),
      prisma.lead.count({ where: { tenantId } }),
      prisma.emailMessage.count({ where: { tenantId } }),
      prisma.opportunity.count({ where: { tenantId } })
    ]);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({
      ok: true,
      tenant,
      insights,
      events,
      overrides,
      dataStats: {
        leadCount,
        emailCount,
        opportunityCount
      }
    });
  } catch (error: any) {
    console.error("Failed to fetch ML status for tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger ML training for specific tenant
router.post("/ml/train/:tenantId", requireDeveloper, async (req: any, res) => {
  // Declare timeout before try so it's visible in catch
  const timeoutMs = Number(process.env.ML_TRAIN_TIMEOUT_MS || 30000);
  try {
    const { tenantId } = req.params;
    const ML_API_URL = (process.env.ML_API_URL || process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000").replace(/\/$/, "");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${ML_API_URL}/train/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ML training failed: ${errorText}`);
    }

    const result = await response.json();
    return res.json({ ok: true, result, timeoutMs });
  } catch (error: any) {
    console.error("Failed to trigger ML training:", error);
    const isAbort = /AbortError/i.test(error?.name || "") || /aborted/i.test(error?.message || "");
    if (isAbort) {
      return res.status(504).json({ error: "ml_training_timeout", timeoutMs });
    }
    return res.status(500).json({ error: error.message, timeoutMs });
  }
});

// List ML samples (developer cross-tenant view)
// GET /dev/ml/samples?tenantId=...&status=...&limit=...
router.get('/ml/samples', requireDeveloper, async (req: any, res) => {
  try {
    const tenantId = typeof req.query.tenantId === 'string' && req.query.tenantId.trim() ? req.query.tenantId.trim() : undefined;
    const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : undefined;
    const status = statusRaw && ['PENDING','APPROVED','REJECTED'].includes(statusRaw) ? statusRaw : undefined;
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 200), 500));

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;

    const itemsRaw = await prisma.mLTrainingSample.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        tenantId: true,
        messageId: true,
        attachmentId: true,
        url: true,
        quotedAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        sourceType: true,
        quoteId: true,
        fileId: true,
        confidence: true,
        estimatedTotal: true,
        textChars: true,
        currency: true,
        filename: true,
      }
    });

    // Map to UI shape, ensuring nulls for missing enrichment data
    const items = itemsRaw.map(i => ({
      ...i,
      confidence: typeof i.confidence === 'number' ? i.confidence : null,
      estimatedTotal: typeof i.estimatedTotal === 'number' ? i.estimatedTotal : null,
      textChars: typeof i.textChars === 'number' ? i.textChars : null,
      currency: i.currency || null,
      filename: i.filename || null,
    }));

    // Attach tenant slugs/names for display
    const distinctTenantIds = Array.from(new Set(items.map(i => i.tenantId)));
    const tenants = distinctTenantIds.length ? await prisma.tenant.findMany({
      where: { id: { in: distinctTenantIds } },
      select: { id: true, name: true, slug: true }
    }) : [];
    const tenantMap = new Map(tenants.map(t => [t.id, t]));
    
    // Generate signed URLs for manual uploads (fileId present)
    // IMPORTANT: Always use the API service host, not the web app host.
    // Rely on the incoming request host (this route runs on the API service) so we don't accidentally pick the web domain.
    const requestHost = (req.get('host') || '').replace(/\/$/, '').trim();
    const API_BASE = requestHost ? `https://${requestHost}` : (process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "") || 'https://api.joineryai.app');
    const enriched = items.map(i => {
      let signedUrl = i.url; // Default to stored URL (for email samples)
      if (i.fileId) {
        // Generate signed URL for manual uploads
        const token = jwt.sign({ t: i.tenantId, f: i.fileId }, env.APP_JWT_SECRET, { expiresIn: '24h' });
        signedUrl = `${API_BASE}/files/${encodeURIComponent(i.fileId)}?jwt=${encodeURIComponent(token)}`;
      }
      return {
        ...i,
        url: signedUrl,
        tenant: tenantMap.get(i.tenantId) || null
      };
    });

    res.json({ ok: true, count: enriched.length, items: enriched });
  } catch (e: any) {
    console.error('[dev/ml/samples] failed:', e?.message || e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /dev/ml/samples/:id/status  { status: 'PENDING'|'APPROVED'|'REJECTED' }
// Developer override for MLTrainingSample status (no tenant ownership restriction).
router.patch('/ml/samples/:id/status', requireDeveloper, async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body ?? {};
    if (!status || !['PENDING','APPROVED','REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    // Ensure sample exists first
    const existing = await prisma.mLTrainingSample.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'not_found' });

    const updated = await prisma.mLTrainingSample.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        tenantId: true,
        messageId: true,
        attachmentId: true,
        url: true,
        quotedAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        sourceType: true,
        quoteId: true,
        fileId: true,
        confidence: true,
        estimatedTotal: true,
        textChars: true,
        currency: true,
        filename: true,
      }
    });

    return res.json({ ok: true, sample: updated });
  } catch (e: any) {
    console.error('[dev/ml/samples/:id/status] failed:', e?.message || e);
    if (e?.code === 'P2025') return res.status(404).json({ error: 'not_found' });
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /dev/ml/summary - ML sample health statistics
router.get('/ml/summary', requireDeveloper, async (req: any, res) => {
  try {
    const total = await prisma.mLTrainingSample.count();
    const withEnrichment = await prisma.mLTrainingSample.count({
      where: {
        OR: [
          { textChars: { not: null } },
          { estimatedTotal: { not: null } },
          { confidence: { not: null } },
        ]
      }
    });
    const byStatus = await prisma.mLTrainingSample.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    const bySource = await prisma.mLTrainingSample.groupBy({
      by: ['sourceType'],
      _count: { id: true }
    });
    return res.json({
      ok: true,
      total,
      withEnrichment,
      enrichmentRate: total > 0 ? Math.round((withEnrichment / total) * 100) : 0,
      byStatus: byStatus.map(g => ({ status: g.status, count: g._count.id })),
      bySource: bySource.map(g => ({ source: g.sourceType, count: g._count.id })),
    });
  } catch (e: any) {
    console.error('[dev/ml/summary] failed:', e?.message || e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /dev/ml/samples/:id/extract - local PDF extraction with line items
router.get('/ml/samples/:id/extract', requireDeveloper, async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const sample = await prisma.mLTrainingSample.findUnique({
      where: { id },
      select: { id: true, fileId: true, tenantId: true }
    });
    if (!sample) return res.status(404).json({ error: 'not_found' });
    if (!sample.fileId) return res.status(400).json({ error: 'no_file' });
    const file = await prisma.uploadedFile.findUnique({
      where: { id: sample.fileId },
      select: { path: true, name: true }
    });
    if (!file) return res.status(404).json({ error: 'file_missing' });
    const absPath = require('path').isAbsolute(file.path) ? file.path : require('path').join(process.cwd(), file.path);
    const { extractQuoteFromPdf } = require('../lib/pdf/extractQuote');
    const stats = await extractQuoteFromPdf(absPath);
    return res.json({ ok: true, sampleId: id, filename: file.name, stats });
  } catch (e: any) {
    console.error('[dev/ml/samples/:id/extract] failed:', e?.message || e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ==============================
// System Stats (Developer Only)
// ==============================

router.get("/stats", requireDeveloper, async (req: any, res) => {
  try {
    const [
      tenantCount,
      userCount,
      leadCount,
      opportunityCount,
      feedbackCount,
      devTaskCount
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.lead.count(),
      prisma.opportunity.count(),
      prisma.feedback.count({ where: { status: { not: 'COMPLETED' } } }),
      prisma.devTask.count({ where: { status: { not: 'DONE' } } })
    ]);

    const recentActivity = await prisma.lead.findMany({
      take: 10,
      orderBy: { capturedAt: 'desc' },
      include: {
        tenant: { select: { name: true } }
      }
    });

    res.json({
      ok: true,
      stats: {
        tenantCount,
        userCount,
        leadCount,
        opportunityCount,
        feedbackCount,
        devTaskCount
      },
      recentActivity
    });
  } catch (error: any) {
    console.error("Failed to fetch stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Database Operations (Developer Only)
// ==============================

router.post("/db/migrate", requireDeveloper, async (req: any, res) => {
  try {
    // This would trigger Prisma migrations
    // For now, just return a placeholder
    res.json({ 
      ok: true, 
      message: "Run migrations using: cd api && npx prisma migrate deploy" 
    });
  } catch (error: any) {
    console.error("Migration failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Seed Data (Keep existing endpoint)
// ==============================

router.post("/seed-data", async (req, res) => {
  const a = (req as any).auth; if (!a) return res.status(401).json({ error: "unauthorized" });

  // 3 leads
  const leads = await prisma.$transaction([
    prisma.lead.create({ data: { tenantId: a.tenantId, createdById: a.userId, contactName: "Acme Windows", email: "acme@example.com", status: "READY_TO_QUOTE" } }),
    prisma.lead.create({ data: { tenantId: a.tenantId, createdById: a.userId, contactName: "Wealden Joinery", email: "wealden@example.com", status: "QUOTE_SENT" } }),
    prisma.lead.create({ data: { tenantId: a.tenantId, createdById: a.userId, contactName: "Landmark Timber", email: "landmark@example.com", status: "INFO_REQUESTED" } }),
  ]);

  // 3 opportunities (2 won this month, 1 open)
  const now = dayjs();
  await prisma.opportunity.create({
    data: { tenantId: a.tenantId, leadId: leads[0].id, title: "Sash Windows (10 units)", valueGBP: 18000, stage: "WON", wonAt: now.subtract(2, "day").toDate() }
  });
  await prisma.opportunity.create({
    data: { tenantId: a.tenantId, leadId: leads[1].id, title: "Doors & Frames (6 units)", valueGBP: 12500, stage: "WON", wonAt: now.subtract(10, "day").toDate() }
  });
  await prisma.opportunity.create({
    data: { tenantId: a.tenantId, leadId: leads[2].id, title: "Shopfit Counter", valueGBP: 9500, stage: "NEGOTIATE" }
  });

  res.json({ ok: true, leads: leads.map(l=>l.id) });
});

export default router;
