// api/src/routes/interest.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { normalizeEmail } from "../lib/email";
import { sendAdminEmail } from "../services/email-notification";

const router = Router();

/**
 * POST /api/interest
 * Register interest for JoineryAI - creates lead in Erin Woodger tenant
 */
router.post("/", async (req, res) => {
  try {
    const { email, name, company, message } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = normalizeEmail(email) || email;

    // Check if already registered
    const existing = await prisma.interestRegistration.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.json({
        success: true,
        message: "You're already on the waitlist!",
      });
    }

    // Create interest registration
    await prisma.interestRegistration.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        company: company || null,
        message: message || null,
      },
    });

    console.log(`📧 New interest registration: ${normalizedEmail}`);

    // Find Erin Woodger tenant
    const erinTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { name: { contains: "Erin Woodger", mode: "insensitive" } },
          { slug: "erin-woodger" },
        ],
      },
    });

    if (erinTenant) {
      // Find or create a system user for lead creation
      let systemUser = await prisma.user.findFirst({
        where: {
          tenantId: erinTenant.id,
          email: { contains: "erin@erinwoodger.com", mode: "insensitive" },
        },
      });

      // Fallback to any admin user in the tenant
      if (!systemUser) {
        systemUser = await prisma.user.findFirst({
          where: {
            tenantId: erinTenant.id,
            role: "OWNER",
          },
        });
      }

      if (!systemUser) {
        console.warn(`⚠️ No user found in Erin Woodger tenant - skipping lead creation`);
      } else {
        // Create lead in Erin Woodger tenant
        const lead = await prisma.lead.create({
          data: {
            tenantId: erinTenant.id,
            createdById: systemUser.id,
            contactName: name || normalizedEmail,
            email: normalizedEmail,
            phone: null,
            status: "NEW",
            description: company 
              ? `[Website Interest] ${company} - ${message || 'Registered interest for March cohort'}`
              : `[Website Interest] ${message || 'Registered interest for March cohort'}`,
            custom: company ? { company, source: "JoineryAI Website Interest Form" } : { source: "JoineryAI Website Interest Form" },
          },
        });

        console.log(`✅ Created lead in Erin Woodger tenant: ${lead.id}`);

        // Send email notifications
        try {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .detail { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
                .label { font-weight: bold; color: #059669; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">🎯 New JoineryAI Interest Registration</h1>
                </div>
                <div class="content">
                  <p>A new potential client has registered their interest in JoineryAI:</p>
                  
                  <div class="detail">
                    <span class="label">Email:</span> ${normalizedEmail}
                  </div>
                  
                  ${name ? `<div class="detail"><span class="label">Name:</span> ${name}</div>` : ''}
                  
                  ${company ? `<div class="detail"><span class="label">Company:</span> ${company}</div>` : ''}
                  
                  ${message ? `<div class="detail"><span class="label">Message:</span> ${message}</div>` : ''}
                  
                  <div class="detail">
                    <span class="label">Lead ID:</span> ${lead.id}
                  </div>
                  
                  <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <a href="https://www.joineryai.app/leads" style="color: #059669; text-decoration: none; font-weight: bold;">View in CRM →</a>
                  </p>
                </div>
              </div>
            </body>
            </html>
          `;

          // Send to both email addresses
          await Promise.all([
            sendAdminEmail({
              to: "erin@erinwoodger.com",
              subject: `New JoineryAI Interest: ${name || normalizedEmail}`,
              html: emailHtml,
            }),
            sendAdminEmail({
              to: "naomi@erinwoodger.com",
              subject: `New JoineryAI Interest: ${name || normalizedEmail}`,
              html: emailHtml,
            }),
            // Send confirmation email to the user
            sendAdminEmail({
              to: normalizedEmail,
              subject: "Thank you for your interest in JoineryAI",
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                    .cta { display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
                    .cta:hover { background: #047857; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1 style="margin: 0;">Welcome to JoineryAI! 🎯</h1>
                    </div>
                    <div class="content">
                      <p>Hi ${name || 'there'},</p>
                      
                      <p>Thank you for registering your interest in JoineryAI! We're excited that you want to join our March cohort.</p>
                      
                      <p><strong>What's next?</strong></p>
                      <ul>
                        <li>We'll be in touch within the next few days with details about our March launch</li>
                        <li>You'll get special early-bird pricing as a member of this cohort</li>
                        <li>We'll arrange a time to walk you through how JoineryAI works for your business</li>
                      </ul>
                      
                      <p>In the meantime, feel free to explore:</p>
                      <ul>
                        <li><strong>How we quote:</strong> Automated quotes from supplier PDFs in minutes</li>
                        <li><strong>How we track leads:</strong> Email integration captures every inquiry automatically</li>
                        <li><strong>Real job costing:</strong> See exactly what you actually made on each job</li>
                        <li><strong>Workshop visibility:</strong> From timesheets to job board to live visibility</li>
                      </ul>
                      
                      <p>Questions? Just reply to this email and we'll help.</p>
                      
                      <p>Excited to work with you!</p>
                      <p><strong>The JoineryAI Team</strong></p>
                      
                      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999;">
                        This is a confirmation email for your JoineryAI interest registration.
                      </p>
                    </div>
                  </div>
                </body>
                </html>
              `,
            }),
          ]);

          console.log(`📧 Sent notifications to erin@erinwoodger.com and naomi@erinwoodger.com`);
        } catch (emailError: any) {
          console.error(`⚠️ Failed to send email notifications:`, emailError.message);
          // Don't fail the request if email fails
        }
      }
    } else {
      console.warn(`⚠️ Erin Woodger tenant not found - lead not created`);
    }

    res.json({
      success: true,
      message: "Thanks for your interest! We'll be in touch soon.",
    });
  } catch (error: any) {
    console.error("Failed to register interest:", error);
    res.status(500).json({ error: "Failed to register interest" });
  }
});

/**
 * GET /api/interest/count
 * Get count of interest registrations (public)
 */
router.get("/count", async (_req, res) => {
  try {
    const count = await prisma.interestRegistration.count();
    res.json({ count });
  } catch (error: any) {
    console.error("Failed to get interest count:", error);
    res.status(500).json({ error: "Failed to get count" });
  }
});

export default router;
