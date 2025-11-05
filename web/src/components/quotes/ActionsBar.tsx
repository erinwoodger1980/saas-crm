import { FileUp, Loader2, Sparkles, Wand2, Calculator, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type ActionsBarProps = {
  onUploadClick: () => void;
  onProcessSupplier?: () => void;
  onRenderProposal: () => void;
  onGenerateEstimate: () => void;
  onDownloadCsv?: () => void;
  disabled?: boolean;
  isUploading?: boolean;
  isProcessingSupplier?: boolean;
  isRendering?: boolean;
  isEstimating?: boolean;
  lastEstimateAt?: string | null;
  reestimate?: boolean;
  estimateCached?: boolean;
};

export function ActionsBar({
  onUploadClick,
  onProcessSupplier,
  onRenderProposal,
  onGenerateEstimate,
  onDownloadCsv,
  disabled,
  isUploading,
  isProcessingSupplier,
  isRendering,
  isEstimating,
  lastEstimateAt,
  reestimate,
  estimateCached,
}: ActionsBarProps) {
  const sharedDisabled = disabled || isUploading || isRendering;
  const estimateLabel = reestimate ? "Re-estimate" : "Generate ML estimate";

  const renderMeta = (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {lastEstimateAt && <span>Last estimate {formatTimeAgo(lastEstimateAt)}</span>}
      {estimateCached && <Badge variant="secondary">Cached result</Badge>}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onUploadClick}
          disabled={sharedDisabled}
          className="gap-2"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          Upload supplier PDF
        </Button>
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {onProcessSupplier && (
            <Button
              type="button"
              variant="outline"
              onClick={onProcessSupplier}
              disabled={sharedDisabled || isProcessingSupplier}
              className="gap-2"
            >
              {isProcessingSupplier ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {isProcessingSupplier ? "Converting" : "Convert → client quote"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onRenderProposal}
            disabled={sharedDisabled || isRendering}
            className="gap-2"
          >
            {isRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isRendering ? "Rendering" : "Render proposal"}
          </Button>
          <Button
            type="button"
            onClick={onGenerateEstimate}
            disabled={sharedDisabled || isEstimating}
            className="gap-2"
          >
            {isEstimating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isEstimating ? "Estimating" : estimateLabel}
          </Button>
          {onDownloadCsv && (
            <Button type="button" variant="ghost" onClick={onDownloadCsv} disabled={sharedDisabled} className="gap-2">
              <Calculator className="h-4 w-4" />
              Download CSV
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 md:justify-end">
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Sparkles className="h-4 w-4" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onProcessSupplier && (
                <DropdownMenuItem onClick={onProcessSupplier} disabled={sharedDisabled || isProcessingSupplier}>
                  <Wand2 className="mr-2 h-4 w-4" /> Convert → client quote
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onRenderProposal} disabled={sharedDisabled || isRendering}>
                <Download className="mr-2 h-4 w-4" /> Render proposal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGenerateEstimate} disabled={sharedDisabled || isEstimating}>
                <Sparkles className="mr-2 h-4 w-4" /> {estimateLabel}
              </DropdownMenuItem>
              {onDownloadCsv && (
                <DropdownMenuItem onClick={onDownloadCsv} disabled={sharedDisabled}>
                  <Calculator className="mr-2 h-4 w-4" /> Download CSV
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {renderMeta}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp?: string | null) {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch (err) {
    console.warn("formatTimeAgo failed", err);
    return "";
  }
}
