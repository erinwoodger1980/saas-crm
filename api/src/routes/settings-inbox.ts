import { Router } from "express";
import { prisma } from "../prisma";
import cron from "node-cron";
import { gmailImport } from "../services/gmail";   // you already have this helper
import { getAccessTokenForTenant } from "../services/gmail";

const router = Router();
const TENANT_INTERVALS: Record<string, NodeJS.Timeout> = {};

function getAuth(req:any){return{tenantId:req.auth?.tenantId as string|undefined};}

/**
 * GET  /settings/inbox
 * returns {enabled:boolean, lastRun:Date|null}
 */
router.get("/",async(req,res)=>{
  const {tenantId}=getAuth(req); if(!tenantId) return res.status(401).json({error:"unauthorized"});
  const s = await prisma.tenantSettings.findUnique({where:{tenantId}});
  res.json({enabled:!!(s as any)?.inboxWatchEnabled,lastRun:(s as any)?.inboxLastRun??null});
});

/**
 * POST /settings/inbox/toggle
 * body:{enabled:boolean}
 */
router.post("/toggle",async(req,res)=>{
  const {tenantId}=getAuth(req); if(!tenantId) return res.status(401).json({error:"unauthorized"});
  const enabled=!!req.body?.enabled;

  await prisma.tenantSettings.update({
    where:{tenantId},
    data:{inboxWatchEnabled:enabled,inboxLastRun:null}
  });

  if(enabled){
    if(TENANT_INTERVALS[tenantId]) clearInterval(TENANT_INTERVALS[tenantId]);
    TENANT_INTERVALS[tenantId]=setInterval(async()=>{
      try{
        const token=await getAccessTokenForTenant(tenantId);
        await gmailImport(token,{max:20});
        await prisma.tenantSettings.update({where:{tenantId},data:{inboxLastRun:new Date()}});
      }catch(e){console.error("[inbox-watch]",e);}
    },10*60*1000); // every 10 min
  }else if(TENANT_INTERVALS[tenantId]){
    clearInterval(TENANT_INTERVALS[tenantId]); delete TENANT_INTERVALS[tenantId];
  }
  res.json({ok:true,enabled});
});

export default router;