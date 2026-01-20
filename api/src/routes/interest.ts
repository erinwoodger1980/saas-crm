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

    const alreadyRegistered = !!existing;

    // Create interest registration (first time only)
    if (!alreadyRegistered) {
      await prisma.interestRegistration.create({
        data: {
          email: normalizedEmail,
          name: name || null,
          company: company || null,
          message: message || null,
        },
      });
      console.log(`📧 New interest registration: ${normalizedEmail}`);
    } else {
      console.log(`📧 Repeat interest submission (already registered): ${normalizedEmail}`);
    }

    // Find Erin Woodger tenant
    const erinTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { name: { contains: "Erin Woodger", mode: "insensitive" } },
          { slug: "erin-woodger" },
        ],
      },
    });

    let leadId: string | null = null;

    if (erinTenant) {
      console.log(`✅ Found Erin Woodger tenant: ${erinTenant.id} (name: ${erinTenant.name})`);
      
      // Find a user for lead creation
      let systemUser = await prisma.user.findFirst({
        where: {
          tenantId: erinTenant.id,
        },
      });

      if (!systemUser) {
        console.warn(`⚠️ No user found in Erin Woodger tenant (${erinTenant.id}) - skipping lead creation`);
      } else {
        console.log(`✅ Found user for lead creation: ${systemUser.email}`);
        try {
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

          leadId = lead.id;
          console.log(`✅ Created lead in Erin Woodger tenant: ${lead.id}`);
        } catch (leadError: any) {
          console.error(`⚠️ Failed to create lead:`, leadError.message);
          console.error(`⚠️ Lead creation error details:`, leadError);
        }
      }
    } else {
      console.warn(`⚠️ Erin Woodger tenant not found - checking available tenants`);
      // List available tenants for debugging
      try {
        const allTenants = await prisma.tenant.findMany({
          take: 10,
          select: { id: true, name: true, slug: true },
        });
        console.log(`Available tenants:`, allTenants.map(t => `${t.name} (${t.slug})`).join(", "));
      } catch (err: any) {
        console.error("Failed to list tenants:", err.message);
      }
    }

    // Send email notifications regardless of lead creation
    try {
      const calendlyUrl = process.env.CALENDLY_URL || process.env.NEXT_PUBLIC_CALENDLY_URL || "";

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
              
              ${leadId ? `<div class="detail"><span class="label">Lead ID:</span> ${leadId}</div>` : ''}
              
              <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <a href="https://www.joineryai.app/leads" style="color: #059669; text-decoration: none; font-weight: bold;">View in CRM →</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send to both email addresses and confirmation to user
      const emailPromises = [];
      
      try {
        emailPromises.push(
          sendAdminEmail({
            to: "erin@erinwoodger.com",
            subject: `New JoineryAI Interest: ${name || normalizedEmail}`,
            html: emailHtml,
          })
        );
        console.log("[interest] Queued email to erin@erinwoodger.com");
      } catch (err: any) {
        console.error("[interest] Failed to queue email to erin:", err.message);
      }
      
      try {
        emailPromises.push(
          sendAdminEmail({
            to: "naomi@erinwoodger.com",
            subject: `New JoineryAI Interest: ${name || normalizedEmail}`,
            html: emailHtml,
          })
        );
        console.log("[interest] Queued email to naomi@erinwoodger.com");
      } catch (err: any) {
        console.error("[interest] Failed to queue email to naomi:", err.message);
      }
      
      // Send confirmation email to the user
      if (!alreadyRegistered) {
        try {
          emailPromises.push(
            sendAdminEmail({
              to: normalizedEmail,
              from: "JoineryAI <hello@joineryai.app>",
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
                      <li>We'll be in touch with details about our March launch</li>
                      <li>You'll get special early-bird pricing as a member of this cohort</li>
                      <li>We'll arrange a time to walk you through how JoineryAI works for your business</li>
                    </ul>

                    ${calendlyUrl ? `
                      <p style="margin-top: 20px;">If you'd like to get your onboarding session booked in now, you can choose a time here:</p>
                      <p>
                        <a class="cta" href="${calendlyUrl}" target="_blank" rel="noopener noreferrer">Book onboarding session</a>
                      </p>
                    ` : ''}
                    
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
            })
          );
          console.log("[interest] Queued confirmation email to", normalizedEmail);
        } catch (err: any) {
          console.error("[interest] Failed to queue confirmation email:", err.message);
        }
      } else {
        console.log("[interest] Skipping confirmation email (already registered):", normalizedEmail);
      }

      // Wait for all emails
      if (emailPromises.length > 0) {
        const results = await Promise.allSettled(emailPromises);
        const succeeded = results.filter(r => r.status === "fulfilled").length;
        const failed = results.filter(r => r.status === "rejected").length;
        console.log(`[interest] Email results: ${succeeded} succeeded, ${failed} failed`);
        
        if (failed > 0) {
          results.forEach((result, idx) => {
            if (result.status === "rejected") {
              console.error(`[interest] Email ${idx} failed:`, result.reason?.message || result.reason);
            }
          });
        }
      }
    } catch (emailError: any) {
      console.error(`⚠️ Failed to send email notifications:`, emailError.message);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: alreadyRegistered ? "You're already on the waitlist!" : "Thanks for your interest! We'll be in touch soon.",
      email: normalizedEmail,
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
