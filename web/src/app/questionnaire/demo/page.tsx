"use client";
import React, { useEffect, useState } from "react";
import DynamicQuestionnaireForm, { QuestionnaireField } from "@/components/questionnaire/DynamicQuestionnaireForm";

export default function QuestionnaireDemoPage() {
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [savedResult, setSavedResult] = useState<any>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  const demoQuoteId = "demo-quote-id"; // Replace with real quote id in actual usage

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch(apiBase.replace(/\/$/, "") + "/questionnaire-fields");
        const json = await resp.json();
        const mapped: QuestionnaireField[] = json.map((f: any) => ({
          id: f.id,
          key: f.key,
            label: f.label,
          type: String(f.type).toLowerCase(),
          required: !!f.required,
          options: f.options || (Array.isArray(f.config?.options) ? f.config.options : null),
        }));
        setFields(mapped);
      } catch (e) {
        console.error("Failed to load fields", e);
      }
    }
    load();
  }, [apiBase]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-base font-semibold">Questionnaire Demo</h1>
      <DynamicQuestionnaireForm
        fields={fields}
        quoteId={demoQuoteId}
        onSubmitted={(res) => setSavedResult(res)}
      />
      {savedResult && (
        <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-auto max-h-64">{JSON.stringify(savedResult, null, 2)}</pre>
      )}
    </div>
  );
}
