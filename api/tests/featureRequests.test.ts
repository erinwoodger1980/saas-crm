import express from "express";
import request from "supertest";

jest.mock("@prisma/client", () => ({
  FeatureCategory: { OTHER: "OTHER" },
  FeatureStatus: {
    OPEN: "OPEN",
    IN_PROGRESS: "IN_PROGRESS",
    READY_FOR_REVIEW: "READY_FOR_REVIEW",
    FAILED: "FAILED",
    APPROVED: "APPROVED",
  },
}));

const storedRequests: any[] = [];
let lastId = 0;
let storedSingle: any = null;

jest.mock("../src/prisma", () => ({
  prisma: {
    featureRequest: {
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: `fr_${++lastId}`,
          ...data,
          status: data.status || "OPEN",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        storedSingle = created;
        storedRequests.push(created);
        return created;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        if (where?.tenantId) {
          return storedRequests.filter((r) => r.tenantId === where.tenantId);
        }
        return storedRequests;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (storedSingle && storedSingle.id === where.id) return storedSingle;
        return storedRequests.find((r) => r.id === where.id) || null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        if (storedSingle && storedSingle.id === where.id) {
          storedSingle = { ...storedSingle, ...data };
          return storedSingle;
        }
        const idx = storedRequests.findIndex((r) => r.id === where.id);
        if (idx >= 0) {
          storedRequests[idx] = { ...storedRequests[idx], ...data };
          return storedRequests[idx];
        }
        throw new Error("not_found");
      }),
    },
  },
}));

jest.mock("../src/routes/ai/codex", () => ({
  buildPrompt: jest.fn(async () => "prompt"),
  callOpenAI: jest.fn(async () => "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n+test"),
  validateAndApplyDiff: jest.fn(async () => ({ worktreePath: "/tmp", cleanup: async () => {} })),
  runChecks: jest.fn(async () => ({ ok: true, results: [] })),
  createBranchAndPR: jest.fn(async () => ({ url: "https://example.com/pr/1" })),
  pushAppliedBranch: jest.fn(() => {}),
}));

import featureRequestsRouter from "../src/routes/featureRequests";

function makeApp(auth: any) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.auth = auth;
    next();
  });
  app.use(featureRequestsRouter);
  return app;
}

describe("Feature Requests API", () => {
  beforeEach(() => {
    storedRequests.length = 0;
    storedSingle = null;
    lastId = 0;
  });

  it("creates feature request with defaults", async () => {
    const app = makeApp({ tenantId: "t1", userId: "u1", role: "user" });
    const res = await request(app)
      .post("/feature-requests")
      .send({ tenantId: "t1", title: "Need calendar", description: "Add calendar view" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OPEN");
    expect(res.body.createdByUserId).toBe("u1");
    expect(res.body.category).toBe("OTHER");
  });

  it("rejects cross-tenant access", async () => {
    const app = makeApp({ tenantId: "t1", userId: "u1", role: "user" });
    const res = await request(app)
      .post("/feature-requests")
      .send({ tenantId: "t2", title: "Nope", description: "wrong tenant" });
    expect(res.status).toBe(403);
  });

  it("runs AI and stores patch", async () => {
    const app = makeApp({ tenantId: "t1", userId: "admin1", role: "admin" });
    const createRes = await request(app)
      .post("/feature-requests")
      .send({ tenantId: "t1", title: "AI", description: "Do ai" });
    expect(createRes.status).toBe(200);
    const id = createRes.body.id;

    const runRes = await request(app)
      .post(`/admin/feature-requests/${id}/run-ai`)
      .send({ taskKey: "ads-lp-prod" });
    expect(runRes.status).toBe(200);
    expect(runRes.body.status).toBe("READY_FOR_REVIEW");
    expect(runRes.body.patchText).toContain("diff --git");
  });
});
