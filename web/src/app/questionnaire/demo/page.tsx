"use client";
import React, { useEffect, useMemo, useState } from "react";
import DynamicQuestionnaireForm, { QuestionnaireField } from "@/components/questionnaire/DynamicQuestionnaireForm";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function QuestionnaireDemoPage() {
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [savedResult, setSavedResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [chatOpen, setChatOpen] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState("How do I fill this?");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hi! Ask me about any field and I will guide you.' }
  ]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoResult, setPhotoResult] = useState<any>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  const demoQuoteId = "demo-quote-id"; // Replace with real quote id in actual usage

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(apiBase.replace(/\/$/, "") + "/questionnaire-fields?includeStandard=true");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const mapped: QuestionnaireField[] = json
          .filter((f: any) => f.askInQuestionnaire !== false && !f.internalOnly)
          .map((f: any) => ({
            id: f.id,
            key: f.key,
            label: f.label,
            type: String(f.type).toLowerCase(),
            required: !!f.required,
            options: f.options || (Array.isArray(f.config?.options) ? f.config.options : null),
          }));
        setFields(mapped);
      } catch (e: any) {
        console.error("Failed to load fields", e);
        setError(e?.message || "Failed to load fields");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [apiBase]);

  // Basic grouping: separate select/list style vs text/number for a cleaner two-column layout
  const grouped = useMemo(() => {
    const choiceTypes = new Set(["select","radio","checkbox","multiselect"]);
    return {
      choice: fields.filter(f => choiceTypes.has(f.type)),
      input: fields.filter(f => !choiceTypes.has(f.type)),
    };
  }, [fields]);

  const totalRequired = useMemo(() => fields.filter(f => f.required).length, [fields]);
  const requiredAnswered = useMemo(() => fields.filter(f => f.required && answers[f.key] != null && answers[f.key] !== '').length, [fields, answers]);
  const progressPct = totalRequired === 0 ? 0 : Math.round((requiredAnswered / totalRequired) * 100);
  const formReady = !loading && fields.length > 0 && !error;

  // Helper text suggestions (heuristic). In real app, move to server-provided metadata.
  function helperFor(field: QuestionnaireField): string | null {
    const k = field.key.toLowerCase();
    if (/(width|height|size)/.test(k)) return 'Provide numerical dimension (mm or meters) for sizing.';
    if (/material|timber|wood/.test(k)) return 'Specify preferred material. Helps estimate cost volatility.';
    if (/finish|coating|paint/.test(k)) return 'Describe surface finish (e.g., primed, stained, lacquer).';
    if (/quantity|qty|units?/.test(k)) return 'Enter total number of units/items required.';
    if (/location|site|postcode/.test(k)) return 'Location can affect logistics and delivery pricing.';
    if (/deadline|date|timeline/.test(k)) return 'Target completion date improves scheduling accuracy.';
    if (field.type === 'number') return 'Numeric value only; leave blank if unknown.';
    if (field.type === 'boolean') return 'Toggle on if this applies to your project.';
    if (field.type === 'select') return 'Choose the closest match from the list.';
    return null;
  }

  function updateAnswer(key: string, value: any) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  async function submitCombinedForm() {
    const completed = requiredAnswered === totalRequired;
    try {
      const resp = await fetch(apiBase.replace(/\/$/, "") + "/questionnaire-responses/quote/" + demoQuoteId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: fields.map(f => ({ fieldId: f.id, value: answers[f.key] ?? null })),
          completed,
        })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Failed to save');
      setSavedResult(json);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function sendChat() {
    const userText = chatInput.trim();
    if (!userText) return;
    setChatMessages(m => [...m, { role: 'user', content: userText }]);
    setChatInput('');
    // Call backend AI assistant endpoint
    const payload = {
      question: userText,
      fields: fields.map(f => ({ key: f.key, label: f.label, type: f.type, required: f.required })),
      answers,
      progress: { requiredAnswered, totalRequired }
    };
    setChatMessages(m => [...m, { role: 'assistant', content: 'Thinking…' }]);
    fetch(apiBase.replace(/\/$/, '') + '/public/estimator-ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(async resp => {
      let json: any = null;
      try { json = await resp.json(); } catch {}
      if (!resp.ok || !json?.answer) {
        throw new Error(json?.error || 'assistant_error');
      }
      setChatMessages(m => {
        const copy = [...m];
        // Replace the temporary "Thinking…" message (last assistant) with real answer
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === 'assistant' && copy[i].content === 'Thinking…') {
            copy[i] = { role: 'assistant', content: json.answer };
            return copy;
          }
        }
        return [...copy, { role: 'assistant', content: json.answer }];
      });
    }).catch(err => {
      console.error('assistant error', err);
      setChatMessages(m => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === 'assistant' && copy[i].content === 'Thinking…') {
            copy[i] = { role: 'assistant', content: 'Assistant unavailable. Please ask about a specific field name.' };
            return copy;
          }
        }
        return [...copy, { role: 'assistant', content: 'Assistant unavailable. Please ask about a specific field name.' }];
      });
    });
  }

  function generateAssistantReply(query: string, fs: QuestionnaireField[], ans: Record<string, any>): string {
    // Very naive parsing to match a field key.
    const lower = query.toLowerCase();
    const match = fs.find(f => lower.includes(f.key.toLowerCase()) || lower.includes(f.label.toLowerCase()));
    if (match) {
      const h = helperFor(match) || 'Provide a clear, concise value relevant to project scope.';
      const current = ans[match.key] != null && ans[match.key] !== '' ? `Current value: ${ans[match.key]}` : 'No value entered yet.';
      return `${match.label}: ${h} ${current}`;
    }
    if (/progress|done|complete/.test(lower)) {
      return `You have answered ${requiredAnswered}/${totalRequired} required questions (${progressPct}%).`;
    }
    return 'Focus on required fields first; ask about a specific field name for tailored guidance.';
  }

  // Minimal renderer for combined demo fields (matches basic types expected)
  function renderCombinedField(field: QuestionnaireField, value: any, onChange: (v: any) => void) {
    const commonProps = {
      className: 'w-full rounded-md border bg-white p-2 text-xs outline-none focus:ring-2',
      value: value ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(e.target.value),
    };
    if (field.type === 'select' && Array.isArray(field.options) && field.options.length) {
      return (
        <select {...commonProps}>
          <option value="" />
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (field.type === 'number') {
      return <input type="number" {...commonProps} />;
    }
    if (field.type === 'boolean') {
      return (
        <select {...commonProps}>
          <option value="" />
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }
    return <input type="text" {...commonProps} />;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Project Estimator</h1>
        <p className="text-sm text-muted-foreground">
          Answer a few structured questions and we generate a tailored project profile ready for pricing.
        </p>
      </div>

      {/* Status / loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading questionnaire…
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load questionnaire: {error}
        </div>
      )}

      {formReady && (
        <div className="space-y-8">
          {/* Metrics & Progress */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-1">
              <div className="text-xs font-medium text-muted-foreground">Questions</div>
              <div className="text-2xl font-bold">{fields.length}</div>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-1">
              <div className="text-xs font-medium text-muted-foreground">Required</div>
              <div className="text-2xl font-bold">{totalRequired}</div>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-1">
              <div className="text-xs font-medium text-muted-foreground">Answered</div>
              <div className="text-2xl font-bold">{requiredAnswered}</div>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-1">
              <div className="text-xs font-medium text-muted-foreground">Quote ID</div>
              <div className="text-sm font-mono">{demoQuoteId}</div>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all" style={{ width: progressPct + '%' }} />
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            {/* Combined Form */}
            <div className="space-y-6">
              <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
                <h2 className="text-lg font-semibold">Project Details</h2>
                {/* Photo Auto-Fill Section */}
                <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Auto-fill from photo</span>
                    {photoUploading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground/70">Upload a window/door/project photo; AI will estimate dimensions & attributes and pre-fill matching fields (only blank ones are filled).</p>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={photoUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPhotoError(null);
                      setPhotoUploading(true);
                      setPhotoResult(null);
                      try {
                        const form = new FormData();
                        form.append('photo', file);
                        form.append('fields', JSON.stringify(fields.map(f => ({ key: f.key, label: f.label, type: f.type, required: f.required }))));
                        form.append('existingAnswers', JSON.stringify(answers));
                        const resp = await fetch(apiBase.replace(/\/$/, '') + '/public/estimator-ai/photo-fill', { method: 'POST', body: form });
                        const json = await resp.json();
                        if (!resp.ok) throw new Error(json?.message || 'Upload failed');
                        setPhotoResult(json);
                      } catch (err: any) {
                        setPhotoError(err.message || 'Failed to analyse photo');
                      } finally {
                        setPhotoUploading(false);
                      }
                    }}
                    className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-background hover:file:opacity-90"
                  />
                  {photoError && <div className="text-[11px] text-rose-600">{photoError}</div>}
                  {photoResult && (
                    <div className="space-y-2">
                      {photoResult.measurement && (
                        <div className="text-[11px] text-muted-foreground">
                          Dim: {photoResult.measurement.widthMm ?? '?'} x {photoResult.measurement.heightMm ?? '?'} mm · conf {photoResult.measurement.confidence ?? '?'}
                        </div>
                      )}
                      <div className="text-[11px] max-h-28 overflow-auto rounded bg-slate-900/80 p-2 font-mono text-slate-100 whitespace-pre-wrap">
                        {Object.keys(photoResult.suggestedAnswers || {}).length
                          ? Object.entries(photoResult.suggestedAnswers).map(([k,v]) => `${k}: ${v}`).join('\n')
                          : (photoResult.message || 'No field suggestions produced.')}
                      </div>
                      {Object.keys(photoResult.suggestedAnswers || {}).length > 0 && (
                        <button
                          onClick={() => {
                            setAnswers(prev => {
                              const next = { ...prev };
                              for (const [k,v] of Object.entries(photoResult.suggestedAnswers)) {
                                if (next[k] == null || next[k] === '') next[k] = v;
                              }
                              return next;
                            });
                          }}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500"
                        >Apply Suggestions</button>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {fields.map(f => {
                    const helper = helperFor(f);
                    const val = answers[f.key] ?? '';
                    return (
                      <div key={f.key} className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          {f.label}{f.required && <span className="text-rose-500">*</span>}
                        </label>
                        {renderCombinedField(f, val, v => updateAnswer(f.key, v))}
                        {helper && <div className="text-[11px] text-muted-foreground/70">{helper}</div>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-muted-foreground">Progress: {progressPct}% {requiredAnswered}/{totalRequired} required</div>
                  <button
                    onClick={submitCombinedForm}
                    disabled={loading}
                    className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
                  >
                    {requiredAnswered === totalRequired ? 'Save & Complete' : 'Save Draft'}
                  </button>
                </div>
              </div>
              {savedResult && (
                <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold">Saved Responses</h3>
                  <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-[11px] text-slate-100">
                    {JSON.stringify(savedResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            {/* AI Assistant Sidebar */}
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-4 shadow-sm flex flex-col h-[520px]">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold">AI Assistant</h2>
                  <button onClick={() => setChatOpen(!chatOpen)} className="text-xs text-muted-foreground hover:text-foreground">
                    {chatOpen ? 'Hide' : 'Show'}
                  </button>
                </div>
                {chatOpen && (
                  <>
                    <div className="flex-1 overflow-auto space-y-2 pr-1">
                      {chatMessages.map((m,i) => (
                        <div key={i} className={`rounded-md px-3 py-2 text-xs whitespace-pre-wrap ${m.role === 'assistant' ? 'bg-muted/50' : 'bg-emerald-100 text-emerald-800'}`}>{m.content}</div>
                      ))}
                    </div>
                    <div className="pt-3 space-y-2">
                      <Input
                        value={chatInput}
                        placeholder="Ask about a field or progress…"
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } }}
                      />
                      <button
                        onClick={sendChat}
                        className="w-full rounded-md bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                      >
                        Ask AI
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
                Tips: Complete required (*) fields first. Use the assistant for clarifications. Your draft is saved locally until submitted.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
