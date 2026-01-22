"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const ProposalImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fileId: {
        default: null,
        parseHTML: (element) => {
          const fromData = element.getAttribute("data-file-id");
          if (fromData) return fromData;
          const src = element.getAttribute("src") || "";
          const m = src.match(/^proposal-asset:\/\/([a-zA-Z0-9-]+)$/);
          return m ? m[1] : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.fileId) return {};
          return { "data-file-id": String(attributes.fileId) };
        },
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const attrs: Record<string, any> = { ...HTMLAttributes };
    const fileId = attrs["data-file-id"];
    if (fileId) {
      attrs.src = `proposal-asset://${String(fileId)}`;
    }
    return ["img", attrs];
  },
});

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
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isUploadingImageFor, setIsUploadingImageFor] = useState<null | "intro" | "scope" | "guarantees" | "terms">(null);

  const signedUrlCacheRef = useRef<Map<string, string>>(new Map());

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
    extensions: [StarterKit, ProposalImage],
    content: defaults.introHtml,
  });

  const editorScope = useEditor({
    extensions: [StarterKit, ProposalImage],
    content: defaults.scopeHtml,
  });

  const editorGuarantees = useEditor({
    extensions: [StarterKit, ProposalImage],
    content: defaults.guaranteesHtml,
  });

  const editorTerms = useEditor({
    extensions: [StarterKit, ProposalImage],
    content: defaults.termsHtml,
  });

  // If quote changes under us, keep template in sync.
  useEffect(() => {
    setProposalTemplate((initialMeta?.proposalTemplate || "soho") as any);
    setHeroFileId(initialMeta?.proposalHeroImageFileId ?? null);
  }, [initialMeta?.proposalTemplate, initialMeta?.proposalHeroImageFileId]);

  const getSignedUrlForFileId = useCallback(async (fileId: string): Promise<string | null> => {
    const id = String(fileId || "").trim();
    if (!quoteId || !id) return null;
    const cached = signedUrlCacheRef.current.get(id);
    if (cached) return cached;

    const resp = await apiFetch<{ ok: boolean; url?: string }>(
      `/quotes/${encodeURIComponent(quoteId)}/files/${encodeURIComponent(id)}/signed-any`,
      { method: "GET" },
    );
    const url = resp?.url ? String(resp.url) : null;
    if (url) signedUrlCacheRef.current.set(id, url);
    return url;
  }, [quoteId]);

  const hydrateEditorImages = useCallback(async (editor: any) => {
    if (!editor) return;

    const fileIds: string[] = [];
    editor.state.doc.descendants((node: any) => {
      if (node?.type?.name === "image" && node?.attrs?.fileId) {
        fileIds.push(String(node.attrs.fileId));
      }
    });

    const unique = Array.from(new Set(fileIds)).filter(Boolean);
    if (!unique.length) return;

    const urlMap: Record<string, string> = {};
    for (const id of unique) {
      const url = await getSignedUrlForFileId(id);
      if (url) urlMap[id] = url;
    }

    const tr = editor.state.tr;
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node?.type?.name !== "image") return;
      const fileId = node?.attrs?.fileId ? String(node.attrs.fileId) : "";
      if (!fileId) return;
      const nextSrc = urlMap[fileId];
      if (!nextSrc) return;
      if (node?.attrs?.src === nextSrc) return;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: nextSrc });
    });
    if (tr.docChanged) editor.view.dispatch(tr);
  }, [getSignedUrlForFileId]);

  useEffect(() => {
    void hydrateEditorImages(editorIntro);
  }, [editorIntro, hydrateEditorImages]);

  useEffect(() => {
    void hydrateEditorImages(editorScope);
  }, [editorScope, hydrateEditorImages]);

  useEffect(() => {
    void hydrateEditorImages(editorGuarantees);
  }, [editorGuarantees, hydrateEditorImages]);

  useEffect(() => {
    void hydrateEditorImages(editorTerms);
  }, [editorTerms, hydrateEditorImages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!heroFileId) {
        setHeroPreviewUrl(null);
        return;
      }
      try {
        const url = await getSignedUrlForFileId(heroFileId);
        if (!cancelled) setHeroPreviewUrl(url);
      } catch {
        if (!cancelled) setHeroPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [heroFileId, getSignedUrlForFileId]);

  const uploadQuoteImage = useCallback(async (file: File): Promise<string | null> => {
    if (!quoteId) return null;
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
    return uploadedId ? String(uploadedId) : null;
  }, [quoteId]);

  const insertImageIntoEditor = useCallback(async (which: "intro" | "scope" | "guarantees" | "terms", file: File) => {
    const editor =
      which === "intro" ? editorIntro :
      which === "scope" ? editorScope :
      which === "guarantees" ? editorGuarantees :
      editorTerms;
    if (!editor) return;

    setIsUploadingImageFor(which);
    try {
      const uploadedId = await uploadQuoteImage(file);
      if (!uploadedId) return;
      const url = await getSignedUrlForFileId(uploadedId);
      if (!url) return;

      editor.chain().focus().setImage({ src: url, fileId: uploadedId } as any).run();
    } finally {
      setIsUploadingImageFor(null);
    }
  }, [editorIntro, editorScope, editorGuarantees, editorTerms, uploadQuoteImage, getSignedUrlForFileId]);

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
            Edit the proposal content (WYSIWYG). Use placeholders like <strong>{"{{projectName}}"}</strong>,{" "}
            <strong>{"{{client}}"}</strong>,{" "}
            <strong>{"{{total}}"}</strong>.
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
        {heroPreviewUrl ? (
          <div className="mt-2">
            <img
              src={heroPreviewUrl}
              alt="Hero preview"
              className="max-h-[180px] w-full rounded-lg border object-cover"
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <Section
          title="Intro"
          editor={editorIntro}
          onInsertImage={(file) => insertImageIntoEditor("intro", file)}
          inserting={isUploadingImageFor === "intro"}
        />
        <Section
          title="Scope"
          editor={editorScope}
          onInsertImage={(file) => insertImageIntoEditor("scope", file)}
          inserting={isUploadingImageFor === "scope"}
        />
        <Section
          title="Guarantees"
          editor={editorGuarantees}
          onInsertImage={(file) => insertImageIntoEditor("guarantees", file)}
          inserting={isUploadingImageFor === "guarantees"}
        />
        <Section
          title="Terms"
          editor={editorTerms}
          onInsertImage={(file) => insertImageIntoEditor("terms", file)}
          inserting={isUploadingImageFor === "terms"}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  editor,
  onInsertImage,
  inserting,
}: {
  title: string;
  editor: any;
  onInsertImage?: (file: File) => void;
  inserting?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        {onInsertImage ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onInsertImage(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!inserting}
              onClick={() => fileRef.current?.click()}
            >
              {inserting ? "Uploading…" : "Insert image"}
            </Button>
          </>
        ) : null}
      </div>
      <div className="rounded-lg border bg-background p-3 min-h-[120px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
