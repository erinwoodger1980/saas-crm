"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type ProposalBlocks = {
  introHtml?: string;
  scopeHtml?: string;
  guaranteesHtml?: string;
  termsHtml?: string;
};

export type ProposalEditorMeta = {
  proposalTemplate?: "soho" | "christchurch";
  proposalHeroImageFileId?: string | null;
  proposalBlocks?: ProposalBlocks;
};

export function ProposalEditor({
  quoteId,
  initialMeta,
  onSaved,
}: {
  quoteId: string;
  initialMeta: ProposalEditorMeta | null | undefined;
  onSaved?: () => void;
}) {
  const initialTemplate = (initialMeta?.proposalTemplate || "soho") as "soho" | "christchurch";
  const [proposalTemplate, setProposalTemplate] = useState<"soho" | "christchurch">(initialTemplate);
  const [heroFileId, setHeroFileId] = useState<string | null>(initialMeta?.proposalHeroImageFileId ?? null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const defaults = useMemo(() => {
    const blocks = initialMeta?.proposalBlocks || {};

    return {
      introHtml:
        blocks.introHtml ||
        "<p><strong>Thank you for the opportunity to quote.</strong> This proposal updates automatically from your quote lines and project details.</p>",
      scopeHtml:
        blocks.scopeHtml ||
        "<p>This quotation covers the supply of bespoke joinery for <strong>{{projectName}}</strong>. Please review specifications and quantities.</p>",
      guaranteesHtml:
        blocks.guaranteesHtml ||
        "<ul><li>Delivered on time</li><li>No hidden extras</li><li>Fully compliant</li></ul>",
      termsHtml:
        blocks.termsHtml ||
        "<p>Prices are valid until <strong>{{validUntil}}</strong>. Payment terms and lead times as agreed.</p>",
    };
  }, [initialMeta]);

  const editorIntro = useEditor({
    extensions: [StarterKit, Image],
    content: defaults.introHtml,
  });

  const editorScope = useEditor({
    extensions: [StarterKit, Image],
    content: defaults.scopeHtml,
  });

  const editorGuarantees = useEditor({
    extensions: [StarterKit, Image],
    content: defaults.guaranteesHtml,
  });

  const editorTerms = useEditor({
    extensions: [StarterKit, Image],
    content: defaults.termsHtml,
  });

  // If quote changes under us, keep template in sync.
  useEffect(() => {
    setProposalTemplate((initialMeta?.proposalTemplate || "soho") as any);
    setHeroFileId(initialMeta?.proposalHeroImageFileId ?? null);
  }, [initialMeta?.proposalTemplate, initialMeta?.proposalHeroImageFileId]);

  const handleUploadHero = useCallback(async (file: File) => {
    if (!quoteId) return;
    setIsUploadingHero(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const resp = await apiFetch<{ ok: boolean; files?: Array<{ id: string }> }>(
        `/quotes/${encodeURIComponent(quoteId)}/files?kind=OTHER`,
        {
          method: "POST",
          body: fd as any,
        } as any,
      );

      const uploadedId = resp?.files?.[0]?.id;
      if (uploadedId) {
        setHeroFileId(uploadedId);
      }
    } finally {
      setIsUploadingHero(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [quoteId]);

  const handleSave = useCallback(async () => {
    if (!quoteId) return;
    setIsSaving(true);
    try {
      const meta: ProposalEditorMeta = {
        proposalTemplate,
        proposalHeroImageFileId: heroFileId,
        proposalBlocks: {
          introHtml: editorIntro?.getHTML() || "",
          scopeHtml: editorScope?.getHTML() || "",
          guaranteesHtml: editorGuarantees?.getHTML() || "",
          termsHtml: editorTerms?.getHTML() || "",
        },
      };

      await apiFetch(`/quotes/${encodeURIComponent(quoteId)}`, {
        method: "PATCH",
        json: { meta },
      });
      onSaved?.();
    } finally {
      setIsSaving(false);
    }
  }, [quoteId, proposalTemplate, heroFileId, editorIntro, editorScope, editorGuarantees, editorTerms, onSaved]);

  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Proposal editor</h2>
          <p className="text-sm text-muted-foreground">
            Edit the proposal content (WYSIWYG). Use placeholders like <strong>{{"{{projectName}}"}}</strong>, <strong>{{"{{client}}"}}</strong>, <strong>{{"{{total}}"}}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={proposalTemplate}
            onChange={(e) => setProposalTemplate(e.target.value === "christchurch" ? "christchurch" : "soho")}
          >
            <option value="soho">Soho</option>
            <option value="christchurch">Christchurch</option>
          </select>

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save proposal"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Hero image</div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="block text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUploadHero(f);
            }}
            disabled={isUploadingHero}
          />
          {heroFileId ? (
            <div className="text-xs text-muted-foreground">Attached: {heroFileId.slice(0, 8).toUpperCase()}</div>
          ) : (
            <div className="text-xs text-muted-foreground">No hero image selected</div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Section title="Intro" editor={editorIntro} />
        <Section title="Scope" editor={editorScope} />
        <Section title="Guarantees" editor={editorGuarantees} />
        <Section title="Terms" editor={editorTerms} />
      </div>
    </div>
  );
}

function Section({ title, editor }: { title: string; editor: any }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="rounded-lg border bg-background p-3 min-h-[120px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
