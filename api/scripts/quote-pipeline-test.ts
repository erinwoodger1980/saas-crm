import { prisma } from "../src/prisma";

type ApiResponse<T> = {
  ok: boolean;
  status: number;
  json: T;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, json };
}

async function run(): Promise<void> {
  const apiBase =
    (process.env.API_BASE ||
      process.env.APP_API_URL ||
      process.env.API_URL ||
      `http://localhost:${process.env.PORT || 4000}`)?.replace(/\/$/, "");

  if (!apiBase) {
    throw new Error("API_BASE not configured.");
  }

  const tenant = await prisma.tenant.findFirst({
    where: process.env.TENANT_SLUG ? { slug: process.env.TENANT_SLUG } : undefined,
    orderBy: { createdAt: "asc" },
  });
  if (!tenant) {
    throw new Error("No tenant found. Seed a tenant before running this script.");
  }

  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      contactName: "Quote Pipeline Test",
      email: "quote-pipeline@example.com",
      phone: "01234 567890",
      address: "1 Test Street, London",
      description: "Pipeline integration test lead",
      status: "READY_TO_QUOTE",
      custom: {
        projectType: "Timber windows",
        siteAddress: "2 Sample Road, London",
        notes: "Client wants oak finish",
      } as any,
    },
  });

  const quote = await prisma.quote.create({
    data: {
      tenantId: tenant.id,
      leadId: lead.id,
      title: "Pipeline Test Quote",
      currency: "GBP",
      status: "DRAFT",
      meta: {
        issueDate: new Date().toISOString(),
      } as any,
    },
  });

  let questionnaire = await prisma.questionnaire.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!questionnaire) {
    questionnaire = await prisma.questionnaire.create({
      data: {
        tenantId: tenant.id,
        name: "Pipeline Test Questionnaire",
        introHtml: "<p>Test questionnaire for quote pipeline.</p>",
      },
    });
  }

  let field = await prisma.questionnaireField.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!field) {
    field = await prisma.questionnaireField.create({
      data: {
        tenantId: tenant.id,
        key: "project_summary",
        label: "Project Summary",
        type: "text",
      },
    });
  }

  await prisma.questionnaireResponse.create({
    data: {
      tenantId: tenant.id,
      questionnaireId: questionnaire.id,
      quoteId: quote.id,
      answers: {
        create: [
          {
            fieldId: field.id,
            value: "Client wants timber windows, oak finish, and fast delivery.",
          },
        ],
      },
    },
  });

  await prisma.quoteLine.createMany({
    data: [
      {
        quoteId: quote.id,
        description: "Timber casement window",
        qty: 2,
        unitPrice: 850,
        currency: "GBP",
        lineTotalGBP: 1700,
        meta: { source: "pipeline-test" } as any,
      },
      {
        quoteId: quote.id,
        description: "Installation labour",
        qty: 1,
        unitPrice: 600,
        currency: "GBP",
        lineTotalGBP: 600,
        meta: { source: "pipeline-test" } as any,
      },
    ],
  });

  const headers = { "Content-Type": "application/json", "x-tenant-id": tenant.id };

  console.log("🧾 Quote created:", { quoteId: quote.id, tenantId: tenant.id, leadId: lead.id });

  const priceResp = await fetchJson<any>(`${apiBase}/quotes/${quote.id}/price`, {
    method: "POST",
    headers,
    body: JSON.stringify({ method: "margin", margin: 0.3 }),
  });

  if (!priceResp.ok) {
    throw new Error(`Pricing failed (${priceResp.status}): ${JSON.stringify(priceResp.json)}`);
  }

  console.log("✅ Pricing complete:", priceResp.json);

  const pdfResp = await fetchJson<any>(`${apiBase}/quotes/${quote.id}/render-pdf`, {
    method: "POST",
    headers,
  });

  if (!pdfResp.ok) {
    throw new Error(`PDF generation failed (${pdfResp.status}): ${JSON.stringify(pdfResp.json)}`);
  }

  console.log("✅ PDF generated:", pdfResp.json);

  const emailResp = await fetchJson<any>(`${apiBase}/quotes/${quote.id}/send-email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ to: lead.email, includeAttachment: true, dryRun: true }),
  });

  if (!emailResp.ok) {
    throw new Error(`Email payload failed (${emailResp.status}): ${JSON.stringify(emailResp.json)}`);
  }

  console.log("✅ Email payload prepared (dry run):", emailResp.json);
}

run()
  .then(() => {
    console.log("🎉 Quote pipeline test complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Quote pipeline test failed:", err);
    process.exit(1);
  });
