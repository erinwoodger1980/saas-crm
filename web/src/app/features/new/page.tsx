"use client";
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function NewFeaturePage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [allowedFiles, setAllowedFiles] = useState('');
  const [priority, setPriority] = useState(2);
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      const me = await apiFetch<any>('/auth/me');
      const tenantId = me?.tenantId;
      const payload = {
        tenantId,
        title,
        description,
        category,
        allowedFiles: allowedFiles ? allowedFiles.split('\n').map(s=>s.trim()).filter(Boolean) : undefined,
        priority
      };
      await apiFetch<any>('/feature-requests', { method: 'POST', json: payload });
      setMsg('Request submitted');
    } catch (e: any) {
      setMsg(e?.message || 'Failed');
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Request a Feature</h1>
      {msg && <div className="mb-4 text-sm text-blue-700">{msg}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input className="w-full border rounded px-3 py-2" value={title} onChange={e=>setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea className="w-full border rounded px-3 py-2 h-32" value={description} onChange={e=>setDescription(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Category</label>
            <select className="w-full border rounded px-3 py-2" value={category} onChange={e=>setCategory(e.target.value)}>
              <option>OTHER</option>
              <option>UI</option>
              <option>COPY</option>
              <option>PRICING</option>
              <option>ANALYTICS</option>
              <option>INTEGRATION</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Priority (1–3)</label>
            <input type="number" min={1} max={3} className="w-full border rounded px-3 py-2" value={priority} onChange={e=>setPriority(parseInt(e.target.value||'2'))} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Allowed files (globs, one per line, optional)</label>
          <textarea className="w-full border rounded px-3 py-2 h-24" value={allowedFiles} onChange={e=>setAllowedFiles(e.target.value)} placeholder="web/src/app/**\napi/src/routes/**" />
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded">Submit</button>
      </form>
    </div>
  );
}
