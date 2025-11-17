import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { EstimateResponse, QuoteDto } from "@/lib/api/quotes";

export type QuoteEstimateSidebarProps = {
  quote?: QuoteDto | null;
  estimate?: EstimateResponse | null;
  linesCount: number;
  filesCount: number;
  currency?: string | null;
  isEstimating?: boolean;
  isRendering?: boolean;
  isUploading?: boolean;
  onEstimate: () => void;
  onRenderProposal?: () => void;
  onUploadClick?: () => void;
  onApplyMargin?: () => void;
  reestimate?: boolean;
  lastEstimateAt?: string | null;
  cacheHit?: boolean;
  latencyMs?: number | null;
};

const LOW_CONFIDENCE_THRESHOLD = 0.7;

export function QuoteEstimateSidebar({
  quote,
  estimate,
  linesCount,
  filesCount,
  currency,
  isEstimating,
  isRendering,
  isUploading,
  onEstimate,
  onRenderProposal,
  onUploadClick,
  onApplyMargin,
  reestimate,
  lastEstimateAt,
  cacheHit,
  latencyMs,
}: QuoteEstimateSidebarProps) {
  const total = estimate?.estimatedTotal ?? estimate?.predictedTotal ?? quote?.totalGBP ?? null;
  const confidence = estimate?.confidence ?? null;
  const showLowConfidence = confidence != null && confidence < LOW_CONFIDENCE_THRESHOLD;
  const estimateLabel = reestimate ? "Re-estimate" : "Generate estimate";

  return (
    <div className="sticky top-24 space-y-4">
      {/* Main Estimate Card */}
      <Card className="rounded-2xl shadow-md border-2">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">Estimate Summary</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">ML-powered quote pricing</p>
            </div>
            {quote?.status && (
              <Badge
                variant={quote.status === "DRAFT" ? "secondary" : quote.status === "SENT" ? "default" : "outline"}
                className="shrink-0"
              >
                {quote.status}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Total Display */}
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Predicted Total</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {total != null ? formatCurrency(total, currency ?? quote?.currency ?? "GBP") : "—"}
              </span>
              <Badge variant="outline" className="shrink-0 text-xs">
                {(currency ?? quote?.currency ?? "GBP").toUpperCase()}
              </Badge>
            </div>
            {lastEstimateAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Updated {formatTimeAgo(lastEstimateAt)}
                {cacheHit && " · Cached"}
                {latencyMs != null && ` · ${latencyMs}ms`}
              </p>
            )}
          </div>

          {/* Confidence Bar */}
          {confidence != null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Confidence</span>
                <span className="font-semibold text-foreground">{Math.round(confidence * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    confidence >= LOW_CONFIDENCE_THRESHOLD ? "bg-emerald-500" : "bg-amber-500"
                  )}
                  style={{ width: `${Math.max(2, Math.round(confidence * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* Low Confidence Warning */}
          {showLowConfidence && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Low confidence</p>
                <p className="mt-1 text-amber-800">Review supplier mappings and questionnaire answers.</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Quick Stats */}
          <dl className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="font-medium text-muted-foreground">Supplier files</dt>
              <dd className="mt-1 font-semibold text-foreground">{filesCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Quote lines</dt>
              <dd className="mt-1 font-semibold text-foreground">{linesCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Quote total</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {quote?.totalGBP != null ? formatCurrency(quote.totalGBP, currency ?? quote.currency ?? "GBP") : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Model</dt>
              <dd className="mt-1 truncate font-semibold text-foreground" title={estimate?.modelVersionId ?? "—"}>
                {estimate?.modelVersionId ? estimate.modelVersionId.slice(0, 8) : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>

        <CardFooter className="flex-col gap-2 pt-4">
          {/* Primary Actions */}
          <div className="flex w-full flex-col gap-2">
            <Button onClick={onEstimate} disabled={isEstimating} className="w-full gap-2" size="lg">
              {isEstimating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isEstimating ? "Estimating..." : estimateLabel}
            </Button>

            {onApplyMargin && (
              <Button onClick={onApplyMargin} variant="outline" className="w-full gap-2">
                <Wand2 className="h-4 w-4" />
                Apply margin pricing
              </Button>
            )}

            {onRenderProposal && (
              <Button
                onClick={onRenderProposal}
                disabled={isRendering || !quote}
                variant="secondary"
                className="w-full gap-2"
              >
                {isRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {isRendering ? "Rendering..." : "Render proposal PDF"}
              </Button>
            )}
          </div>

          <Separator className="my-2" />

          {/* Secondary Actions */}
          <div className="flex w-full gap-2">
            {onUploadClick && (
              <Button onClick={onUploadClick} disabled={isUploading} variant="outline" size="sm" className="flex-1 gap-2">
                {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Upload
              </Button>
            )}
            <Button variant="outline" size="sm" className="flex-1 gap-2">
              <Download className="h-3 w-3" />
              Export
            </Button>
          </div>

          {reestimate && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span>Lines changed. Consider re-estimating.</span>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Help Card */}
      <Card className="rounded-2xl border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">ML Pricing Tips</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Upload supplier PDFs first</li>
                <li>• Fill questionnaire for better estimates</li>
                <li>• Review parsed lines before pricing</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).format(value);
  } catch {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
  }
}

function formatTimeAgo(timestamp: string) {
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
  } catch {
    return "";
  }
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
