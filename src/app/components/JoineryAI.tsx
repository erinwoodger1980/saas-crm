"use client";
import { useState } from "react";

export default function JoineryAI({ apiBase, jwt }:{ apiBase:string; jwt?: string }) {
  const [q,setQ] = useState("");
  const [log,setLog] = useState<{role:"you"|"ai", text:string}[]>([]);

  async function ask() {
    const question = q.trim();
    if(!question) return;
    setLog(l=>[...l,{role:"you",text:question}]);
    setQ("");
    const headers: Record<string, string> = { "Content-Type":"application/json" };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    const res = await fetch(`${apiBase}/ai/chat`, {
      method:"POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ question })
    });
    const j = await res.json();
    setLog(l=>[...l,{role:"ai", text: j.answer || "(no answer)"}]);
  }

  return (
    <div style={{border:"1px solid #e6e8ef",borderRadius:12,padding:12,background:"#fff"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <b>Joinery AI</b><small style={{color:"#6b7280"}}>Ask about sales, conversion, pipeline…</small>
      </div>
      <div style={{maxHeight:280, overflow:"auto", margin:"8px 0", padding:8, background:"#fafafa", borderRadius:8}}>
        {log.length===0 && <div style={{color:"#6b7280"}}>Try: “sales this month?”</div>}
        {log.map((m,i)=>(
          <div key={i} style={{margin:"6px 0"}}>
            <span style={{fontWeight:600}}>{m.role==="you"?"You":"Joinery AI"}: </span>
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex", gap:8}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Type a question…" style={{flex:1}}/>
        <button onClick={ask}>Ask</button>
      </div>
    </div>
  );
}
