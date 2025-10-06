import { Router } from "express";
import { prisma } from "../prisma";
const r = Router();

r.get("/sales", async (req,res)=>{
  const a=(req as any).auth; if(!a) return res.status(401).json({error:"unauthorized"});
  const rows:any[] = await prisma.$queryRawUnsafe(
    `SELECT date_trunc('month',"wonAt") AS month, SUM(COALESCE("valueGBP",0)) AS total
     FROM "Opportunity" WHERE "tenantId"='${a.tenantId}' AND "wonAt" IS NOT NULL
     GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
  res.json(rows);
});

export default r;
