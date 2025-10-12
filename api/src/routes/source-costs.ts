import { Router } from "express";
import { prisma } from "../prisma";
const router = Router();

function getAuth(req:any){return{tenantId:req.auth?.tenantId as string|undefined};}

/* GET /source-costs */
router.get("/",async(req,res)=>{
  const {tenantId}=getAuth(req); if(!tenantId) return res.status(401).json({error:"unauthorized"});
  const rows=await prisma.leadSourceCost.findMany({where:{tenantId},orderBy:{month:"desc"}});
  res.json(rows);
});

/* POST /source-costs (create or update) */
router.post("/",async(req,res)=>{
  const {tenantId}=getAuth(req); if(!tenantId) return res.status(401).json({error:"unauthorized"});
  const {source,month,spend,leads,conversions,scalable}=req.body||{};
  const m=new Date(month); m.setUTCDate(1); m.setUTCHours(0,0,0,0);
  const data={tenantId,source,month:m,spend:Number(spend||0),leads:Number(leads||0),conversions:Number(conversions||0),scalable:!!scalable};
  const row=await prisma.leadSourceCost.upsert({
    where:{tenantId_source_month:{tenantId,source,month:m}},
    update:data,
    create:data
  });
  res.json(row);
});

export default router;