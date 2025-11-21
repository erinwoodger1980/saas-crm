import { useCallback, useState, useEffect } from "react";
import { FileText, Loader2, Upload, ExternalLink, Edit3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SupplierFileDto, QuoteSourceProfile } from "@/lib/api/quotes";
import { fetchQuoteSourceProfiles, updateQuoteSource } from "@/lib/api/quotes";

export type SupplierFilesCardProps = {
  files?: SupplierFileDto[] | null;
  quoteId: string;
  quoteSourceType?: string | null;
  supplierProfileId?: string | null;
  onOpen: (_file: SupplierFileDto) => void;
  onUpload: (_files: FileList | null) => void;
  onUploadClick?: () => void;
  isUploading?: boolean;
  onSourceUpdated?: () => void;
};

export function SupplierFilesCard({ 
  files, 
  quoteId, 
  quoteSourceType, 
  supplierProfileId, 
  onOpen, 
  onUpload, 
  onUploadClick, 
  isUploading,
  onSourceUpdated 
}: SupplierFilesCardProps) {
  const [dragging, setDragging] = useState(false);
  const [profiles, setProfiles] = useState<QuoteSourceProfile[]>([]);
  const [selectedType, setSelectedType] = useState<string>(quoteSourceType || "");
  const [selectedProfile, setSelectedProfile] = useState<string>(supplierProfileId || "");
  const [isUpdatingSource, setIsUpdatingSource] = useState(false);

  useEffect(() => {
    fetchQuoteSourceProfiles().then(setProfiles).catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedType(quoteSourceType || "");
    setSelectedProfile(supplierProfileId || "");
  }, [quoteSourceType, supplierProfileId]);

  const handleTypeChange = async (newType: string) => {
    setSelectedType(newType);
    setSelectedProfile(""); // Reset profile when type changes
    
    try {
      setIsUpdatingSource(true);
      await updateQuoteSource(quoteId, newType as 'supplier' | 'software' | null, null);
      onSourceUpdated?.();
    } catch (err) {
      console.error("Failed to update quote source type:", err);
    } finally {
      setIsUpdatingSource(false);
    }
  };

  const handleProfileChange = async (newProfile: string) => {
    setSelectedProfile(newProfile);
    
    try {
      setIsUpdatingSource(true);
      await updateQuoteSource(quoteId, selectedType as 'supplier' | 'software' | null, newProfile);
      onSourceUpdated?.();
    } catch (err) {
      console.error("Failed to update quote source profile:", err);
    } finally {
      setIsUpdatingSource(false);
    }
  };

  const filteredProfiles = profiles.filter(p => p.type === selectedType);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      onUpload(event.dataTransfer?.files ?? null);
    },
    [onUpload],
  );

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight">Supplier files</CardTitle>
          <p className="text-sm text-muted-foreground">Drag PDFs here or upload to keep the parser in sync.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onUploadClick}
          disabled={!onUploadClick}
        >
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quote Source Selection */}
        {(files ?? []).length > 0 && (
          <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="source-type" className="text-xs font-medium text-muted-foreground">Quote Source Type</Label>
                <Select value={selectedType} onValueChange={handleTypeChange} disabled={isUpdatingSource}>
                  <SelectTrigger id="source-type" className="w-full">
                    <SelectValue placeholder="Select source type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-2">
                <Label htmlFor="source-profile" className="text-xs font-medium text-muted-foreground">Specific Source</Label>
                <Select 
                  value={selectedProfile} 
                  onValueChange={handleProfileChange} 
                  disabled={!selectedType || isUpdatingSource}
                >
                  <SelectTrigger id="source-profile" className="w-full">
                    <SelectValue placeholder={selectedType ? "Select source..." : "Choose type first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProfiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <span className="flex flex-col text-left">
                          <span>{profile.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {profile.source === 'tenant' && 'Your supplier'}
                            {profile.source === 'global' && `Shared · ${profile.tenantName ?? 'Global library'}`}
                            {profile.source === 'static' && 'Built-in template'}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedProfile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 w-full"
                onClick={() => {
                  const firstFile = (files ?? [])[0];
                  if (firstFile) {
                    window.open(`/pdf-trainer?quoteId=${quoteId}&profileId=${selectedProfile}&fileId=${firstFile.id}`, '_blank');
                  }
                }}
              >
                <Edit3 className="h-4 w-4" />
                Annotate Template for ML Training
              </Button>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl border-2 border-dashed p-6 text-center text-sm transition ${
            dragging ? "border-emerald-400 bg-emerald-50" : "border-muted"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <p className="font-medium text-foreground">Drop supplier PDFs</p>
            <p className="text-xs">Files are parsed with ML and cached for quick re-pricing.</p>
          </div>
        </div>

        <div className="space-y-2">
          {(files ?? []).map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{file.name ?? "Supplier PDF"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {file.mimeType ?? "application/pdf"} · {formatSize(file.sizeBytes)}
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => onOpen(file)}>
                <ExternalLink className="h-4 w-4" /> View
              </Button>
            </div>
          ))}
          {(files ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-muted/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              No supplier files uploaded yet. Add PDFs to unlock ML parsing.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatSize(bytes?: number | null) {
  if (!bytes || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
