"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import type { PdfTemplateSummary, QuoteSourceProfile, SupplierFileDto } from "@/lib/api/quotes";
import { fetchPdfTemplates, fetchQuoteSourceProfiles } from "@/lib/api/quotes";
import { Loader2, Sparkles, Edit3 } from "lucide-react";

export type TemplatePickerDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  quoteId: string;
  supplierFiles?: SupplierFileDto[] | null;
  initialSourceType?: string | null;
  initialProfileId?: string | null;
  isSubmitting?: boolean;
  onConfirm: (_selection: { sourceType: "supplier" | "software" | null; profileId: string | null }) => void | Promise<void>;
};

export function TemplatePickerDialog({
  open,
  onOpenChange,
  quoteId,
  supplierFiles,
  initialSourceType,
  initialProfileId,
  onConfirm,
  isSubmitting,
}: TemplatePickerDialogProps) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<QuoteSourceProfile[]>([]);
  const [templates, setTemplates] = useState<PdfTemplateSummary[]>([]);
  const [selectedType, setSelectedType] = useState<string>(initialSourceType || "supplier");
  const [selectedProfile, setSelectedProfile] = useState<string>(initialProfileId || "");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let aborted = false;
    setIsLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const [profileData, templateData] = await Promise.all([
          fetchQuoteSourceProfiles(),
          fetchPdfTemplates(),
        ]);
        if (aborted) return;
        setProfiles(profileData);
        setTemplates(templateData);
      } catch (err: any) {
        if (aborted) return;
        console.error("[TemplatePickerDialog] bootstrap failed", err);
        const message = err?.message || "Failed to load templates";
        setLoadError(message);
        toast({ title: "Unable to load templates", description: message, variant: "destructive" });
      } finally {
        if (!aborted) setIsLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [open, toast]);

  useEffect(() => {
    if (!open) return;
    setSelectedType(initialSourceType || "supplier");
    setSelectedProfile(initialProfileId || "");
  }, [open, initialSourceType, initialProfileId]);

  const supplierProfileOptions = useMemo(() => profiles.filter((profile) => profile.type === selectedType), [profiles, selectedType]);
  const currentTemplate = useMemo(() => templates.find((tpl) => tpl.supplierProfileId === selectedProfile), [templates, selectedProfile]);

  const firstFile = (supplierFiles || []).find((f: any) => f?.kind === "SUPPLIER_QUOTE") || supplierFiles?.[0];
  const trainerHref = selectedProfile
    ? `/pdf-trainer?quoteId=${encodeURIComponent(quoteId)}&profileId=${encodeURIComponent(selectedProfile)}${firstFile ? `&fileId=${encodeURIComponent(firstFile.id)}` : ""}`
    : null;

  const handleConfirm = useCallback(() => {
    if (!selectedProfile || isSubmitting) return;
    const sourceType = selectedType === "supplier" || selectedType === "software" ? selectedType : null;
    onConfirm({ sourceType, profileId: selectedProfile });
  }, [selectedProfile, selectedType, onConfirm, isSubmitting]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select a parsing template</DialogTitle>
          <DialogDescription>
            Choose the supplier profile before parsing so we can load the right layout annotations.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {loadError}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Source type</Label>
                <Select value={selectedType} onValueChange={(value) => {
                  setSelectedType(value);
                  setSelectedProfile("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Supplier PDF</SelectItem>
                    <SelectItem value="software">Software export</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Profile</Label>
                <Select
                  value={selectedProfile}
                  onValueChange={setSelectedProfile}
                  disabled={!selectedType || supplierProfileOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={supplierProfileOptions.length ? "Select profile" : "No profiles available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierProfileOptions.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/30 p-4">
              {!selectedProfile ? (
                <p className="text-sm text-muted-foreground">Select a profile to see the most recent template details.</p>
              ) : currentTemplate ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-foreground">{currentTemplate.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {currentTemplate.updatedAt ? new Date(currentTemplate.updatedAt).toLocaleString() : "recently"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {currentTemplate.annotationCount ?? 0} annotations
                    </Badge>
                  </div>
                  {currentTemplate.description && (
                    <p className="text-sm text-muted-foreground">{currentTemplate.description}</p>
                  )}
                  <div className="rounded-lg border bg-background px-4 py-3 text-sm">
                    <p className="font-medium text-foreground">Template metadata</p>
                    <dl className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                      <div>
                        <dt>Supplier profile</dt>
                        <dd className="font-mono text-foreground">{currentTemplate.supplierProfileId}</dd>
                      </div>
                      <div>
                        <dt>Pages annotated</dt>
                        <dd className="text-foreground">{currentTemplate.pageCount ?? "—"}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">No saved template for this profile.</p>
                  <p className="text-sm text-muted-foreground">
                    Launch the PDF Trainer to annotate a sample and generate a layout template before parsing.
                  </p>
                </div>
              )}
            </div>

            <div className="max-h-40 overflow-y-auto rounded-xl border bg-card p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Parser tips</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Match the exact supplier profile so we load the correct layout annotations.</li>
                <li>Use the PDF Trainer to add missing annotations if the parser skips rows.</li>
                <li>Need to override? Pick a different profile, save, then parse again.</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="gap-2"
            disabled={!trainerHref}
            onClick={() => {
              if (!trainerHref) return;
              window.open(trainerHref, "_blank", "noopener,noreferrer");
            }}
          >
            <Edit3 className="h-4 w-4" /> Open PDF Trainer
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={!selectedProfile || isSubmitting || !!loadError}
            onClick={handleConfirm}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Use template & parse
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
