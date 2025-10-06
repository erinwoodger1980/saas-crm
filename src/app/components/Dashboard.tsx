"use client";
import useSWR from "swr";

export default function Dashboard({ apiBase, jwt }:{ apiBase:string; jwt:string }) {
  const fetcher = (u:string)=>fetch(u,{headers:{Authorization:`Bearer ${jwt}`}}).then(r=>r.json());
  const { data: sales } = useSWR(`${apiBase}/reports/sales`, fetcher);

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
      <div style={{border:"1px solid #eee",borderRadius:8,padding:10,background:"#fff"}}>
        <b>Sales (last 12 months)</b>
        <ul style={{marginTop:6}}>
          {(sales||[]).map((r:any)=>(
            <li key={r.month}>
              {new Date(r.month).toLocaleDateString(undefined,{month:"short",year:"numeric"})}
              : £{Number(r.total).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
