"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function SourceCosts() {
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({source:"",month:"",spend:"",leads:"",conversions:"",scalable:true});

  async function load(){
    setLoading(true);
    const data=await apiFetch<any[]>("/source-costs");
    setRows(data); setLoading(false);
  }
  useEffect(()=>{load();},[]);

  async function save(){
    await apiFetch("/source-costs",{method:"POST",json:form});
    setForm({source:"",month:"",spend:"",leads:"",conversions:"",scalable:true});
    setAdding(false); load();
  }

  if(loading) return <div>Loading costs…</div>;
  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex justify-between mb-3">
        <h2 className="font-medium">Lead Source Costs</h2>
        <Button variant="outline" onClick={()=>setAdding(!adding)}>
          {adding?"Cancel":"Add Month"}
        </Button>
      </div>

      {adding && (
        <div className="grid grid-cols-6 gap-2 mb-3 text-sm">
          {["source","month","spend","leads","conversions"].map(k=>(
            <input key={k} placeholder={k}
              className="input" value={(form as any)[k]}
              onChange={e=>setForm({...form,[k]:e.target.value})}/>
          ))}
          <label className="flex items-center text-xs gap-1">
            <input type="checkbox" checked={form.scalable}
              onChange={e=>setForm({...form,scalable:e.target.checked})}/>Scalable
          </label>
          <Button onClick={save}>Save</Button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th>Source</th><th>Month</th><th>Spend</th><th>Leads</th><th>Sales</th>
            <th>CPL</th><th>CPS</th><th>ROI</th><th>Scalable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=>{
            const cpl=r.leads? r.spend/r.leads:0;
            const cps=r.conversions? r.spend/r.conversions:0;
            const roi=r.conversions? (r.leads? (r.conversions/r.leads*100).toFixed(0)+"%" :""):"";
            return (
              <tr key={r.id} className="border-b last:border-0">
                <td>{r.source}</td>
                <td>{new Date(r.month).toLocaleDateString("en-GB",{month:"short",year:"numeric"})}</td>
                <td>£{r.spend.toFixed(0)}</td>
                <td>{r.leads}</td>
                <td>{r.conversions}</td>
                <td>£{cpl.toFixed(0)}</td>
                <td>£{cps.toFixed(0)}</td>
                <td>{roi}</td>
                <td>{r.scalable?"✅":"🚫"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}