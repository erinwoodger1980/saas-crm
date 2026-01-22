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
    // IMPORTANT:
    // - In the editor we want <img src> to be a real (signed) URL so the browser can display it.
    // - We still keep data-file-id so we can canonicalize on save back to proposal-asset://<id>.
    return ["img", { ...HTMLAttributes }];
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
  proposalChristchurchImageFileIds?: {
    logoMarkFileId?: string | null;
    logoWideFileId?: string | null;
    coverHeroFileId?: string | null;
    sidebarPhotoFileId?: string | null;
    badge1FileId?: string | null;
    badge2FileId?: string | null;
    fensaFileId?: string | null;
    pas24FileId?: string | null;
    fscFileId?: string | null;
    ggfFileId?: string | null;
  };
  proposalBlocks?: ProposalBlocks;
};

function canonicalizeProposalHtmlForSave(html: string): string {
  const raw = String(html || "");
  if (!raw.trim()) return "";
  try {
    const doc = new DOMParser().parseFromString(raw, "text/html");

    // Treat empty rich-text (e.g. <p></p>, <p><br></p>) as empty so the
    // server can fall back to Settings-driven defaults.
    const text = (doc.body?.textContent || "").replace(/\u00a0/g, " ").trim();
    const hasImages = doc.body ? doc.body.querySelectorAll("img").length > 0 : false;
    if (!text && !hasImages) return "";

    const imgs = Array.from(doc.querySelectorAll("img[data-file-id]"));
    for (const img of imgs) {
      const fileId = (img.getAttribute("data-file-id") || "").trim();
      if (!fileId) continue;
      img.setAttribute("src", `proposal-asset://${fileId}`);
    }
    return doc.body.innerHTML;
  } catch {
    // If parsing fails for any reason, fall back to the raw HTML.
    return raw;
  }
}

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

  const [ccImageFileIds, setCcImageFileIds] = useState<NonNullable<ProposalEditorMeta["proposalChristchurchImageFileIds"]>>(
    initialMeta?.proposalChristchurchImageFileIds || {},
  );
  const [ccPreviewUrls, setCcPreviewUrls] = useState<Record<string, string | null>>({
    logoMarkFileId: null,
    logoWideFileId: null,
    coverHeroFileId: null,
    sidebarPhotoFileId: null,
    badge1FileId: null,
    badge2FileId: null,
    fensaFileId: null,
    pas24FileId: null,
    fscFileId: null,
    ggfFileId: null,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isUploadingImageFor, setIsUploadingImageFor] = useState<null | "scope">(null);

  const signedUrlCacheRef = useRef<Map<string, string>>(new Map());

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const defaults = useMemo(() => {
    const blocks = initialMeta?.proposalBlocks || {};

    return {
      scopeHtml:
        blocks.scopeHtml ||
        "<p>This quotation covers the supply of bespoke joinery for <strong>{{projectName}}</strong>. Please review specifications and quantities.</p>",
    };
  }, [initialMeta]);

  const editorScope = useEditor({
    extensions: [StarterKit, ProposalImage],
    content: defaults.scopeHtml,
  });

  // If quote changes under us, keep template in sync.
  useEffect(() => {
    setProposalTemplate((initialMeta?.proposalTemplate || "soho") as any);
    setHeroFileId(initialMeta?.proposalHeroImageFileId ?? null);
    setCcImageFileIds(initialMeta?.proposalChristchurchImageFileIds || {});
  }, [initialMeta?.proposalTemplate, initialMeta?.proposalHeroImageFileId, initialMeta?.proposalChristchurchImageFileIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string | null> = {
        logoMarkFileId: null,
        logoWideFileId: null,
        coverHeroFileId: null,
        sidebarPhotoFileId: null,
        badge1FileId: null,
        badge2FileId: null,
        fensaFileId: null,
        pas24FileId: null,
        fscFileId: null,
        ggfFileId: null,
      };

      const keys = Object.keys(next) as Array<keyof typeof next>;
      for (const k of keys) {
        const fileId = (ccImageFileIds as any)?.[k] ? String((ccImageFileIds as any)[k]) : "";
        if (!fileId) continue;
        try {
          next[k] = await getSignedUrlForFileId(fileId);
        } catch {
          next[k] = null;
        }
      }

      if (!cancelled) setCcPreviewUrls(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [ccImageFileIds, getSignedUrlForFileId]);

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
    void hydrateEditorImages(editorScope);
  }, [editorScope, hydrateEditorImages]);

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

  const insertImageIntoEditor = useCallback(async (which: "scope", file: File) => {
    const editor = editorScope;
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
  }, [editorScope, uploadQuoteImage, getSignedUrlForFileId]);

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
        try {
          await apiFetch(`/quotes/${encodeURIComponent(quoteId)}`, {
            method: "PATCH",
            json: { meta: { proposalHeroImageFileId: String(uploadedId) } },
          });
          onSaved?.();
        } catch {
          // Non-fatal: the preview will still show; user can hit Save proposal.
        }
      }
    } finally {
      setIsUploadingHero(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [quoteId, onSaved]);

  const handleSave = useCallback(async () => {
    if (!quoteId) return;
    setIsSaving(true);
    try {
      const meta: ProposalEditorMeta = {
        proposalTemplate,
        proposalHeroImageFileId: heroFileId,
        proposalChristchurchImageFileIds: proposalTemplate === "christchurch" ? ccImageFileIds : ccImageFileIds,
        proposalBlocks: {
          introHtml: "",
          scopeHtml: canonicalizeProposalHtmlForSave(editorScope?.getHTML() || ""),
          guaranteesHtml: "",
          termsHtml: "",
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
  }, [quoteId, proposalTemplate, heroFileId, ccImageFileIds, editorScope, onSaved]);

  const handleUploadChristchurchImage = useCallback(
    async (
      slot:
        | "logoMarkFileId"
        | "logoWideFileId"
        | "coverHeroFileId"
        | "sidebarPhotoFileId"
        | "badge1FileId"
        | "badge2FileId"
        | "fensaFileId"
        | "pas24FileId"
        | "fscFileId"
        | "ggfFileId",
      file: File,
    ) => {
      const uploadedId = await uploadQuoteImage(file);
      if (!uploadedId) return;
      const next = { ...ccImageFileIds, [slot]: uploadedId };
      setCcImageFileIds(next);
      try {
        await apiFetch(`/quotes/${encodeURIComponent(quoteId)}`, {
          method: "PATCH",
          json: { meta: { proposalChristchurchImageFileIds: next } },
        });
        onSaved?.();
      } catch {
        // Non-fatal: user can hit Save proposal.
      }
    },
    [uploadQuoteImage, ccImageFileIds, quoteId, onSaved],
  );

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

      {proposalTemplate === "christchurch" ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">Christchurch template images</div>
          <div className="text-xs text-muted-foreground">
            Defaults come from the reference PDF. Uploading here overrides them for this quote only.
          </div>

          <TemplateImageRow
            label="Cover hero"
            previewUrl={ccPreviewUrls.coverHeroFileId}
            onPick={(f) => void handleUploadChristchurchImage("coverHeroFileId", f)}
          />

          <TemplateImageRow
            label="Logo mark"
            previewUrl={ccPreviewUrls.logoMarkFileId}
            onPick={(f) => void handleUploadChristchurchImage("logoMarkFileId", f)}
          />
          <TemplateImageRow
            label="Logo wide"
            previewUrl={ccPreviewUrls.logoWideFileId}
            onPick={(f) => void handleUploadChristchurchImage("logoWideFileId", f)}
          />
          <TemplateImageRow
            label="Sidebar photo"
            previewUrl={ccPreviewUrls.sidebarPhotoFileId}
            onPick={(f) => void handleUploadChristchurchImage("sidebarPhotoFileId", f)}
          />
          <TemplateImageRow
            label="Badge 1"
            previewUrl={ccPreviewUrls.badge1FileId}
            onPick={(f) => void handleUploadChristchurchImage("badge1FileId", f)}
          />
          <TemplateImageRow
            label="Badge 2"
            previewUrl={ccPreviewUrls.badge2FileId}
            onPick={(f) => void handleUploadChristchurchImage("badge2FileId", f)}
          />

          <TemplateImageRow
            label="FENSA logo"
            previewUrl={ccPreviewUrls.fensaFileId}
            onPick={(f) => void handleUploadChristchurchImage("fensaFileId", f)}
          />
          <TemplateImageRow
            label="PAS 24 logo"
            previewUrl={ccPreviewUrls.pas24FileId}
            onPick={(f) => void handleUploadChristchurchImage("pas24FileId", f)}
          />
          <TemplateImageRow
            label="FSC logo"
            previewUrl={ccPreviewUrls.fscFileId}
            onPick={(f) => void handleUploadChristchurchImage("fscFileId", f)}
          />
          <TemplateImageRow
            label="GGF logo"
            previewUrl={ccPreviewUrls.ggfFileId}
            onPick={(f) => void handleUploadChristchurchImage("ggfFileId", f)}
          />
        </div>
      ) : null}

      <div className="space-y-4">
        <Section
          title="Scope"
          editor={editorScope}
          onInsertImage={(file) => insertImageIntoEditor("scope", file)}
          inserting={isUploadingImageFor === "scope"}
        />
      </div>
    </div>
  );
}

function TemplateImageRow({
  label,
  previewUrl,
  onPick,
}: {
  label: string;
  previewUrl: string | null | undefined;
  onPick: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {previewUrl ? (
          <div className="mt-2">
            <img src={previewUrl} alt={`${label} preview`} className="h-12 w-auto rounded border bg-white" />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mt-1">Using default</div>
        )}
      </div>
      <div className="shrink-0">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          Upload
        </Button>
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
