import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EstimateResponse, QuoteDto } from "@/lib/api/quotes";

export type EstimatePanelProps = {
  quote?: QuoteDto | null;
  estimate?: EstimateResponse | null;
  linesCount: number;
  currency?: string | null;
  isEstimating?: boolean;
  onEstimate: () => void;
  onSaveEstimate?: () => void;
  onApprove?: () => void;
  reestimate?: boolean;
  lastEstimateAt?: string | null;
  cacheHit?: boolean;
  latencyMs?: number | null;
};

const LOW_CONFIDENCE_THRESHOLD = 0.7;

export function EstimatePanel({
  quote,
  estimate,
  linesCount,
  currency,
  isEstimating,
  onEstimate,
  onSaveEstimate,
  onApprove,
  reestimate,
  lastEstimateAt,
  cacheHit,
  latencyMs,
}: EstimatePanelProps) {
  const total = estimate?.estimatedTotal ?? estimate?.predictedTotal ?? quote?.totalGBP ?? null;
  const confidence = estimate?.confidence ?? null;
  const showLowConfidence = confidence != null && confidence < LOW_CONFIDENCE_THRESHOLD;
  const estimateLabel = reestimate ? "Re-estimate" : "Generate ML estimate";

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight">Estimate</CardTitle>
          <p className="text-sm text-muted-foreground">Review ML pricing before saving to the quote.</p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right text-xs text-muted-foreground">
          {cacheHit && <Badge variant="secondary">Cached</Badge>}
          {latencyMs != null && <span>Latency {latencyMs} ms</span>}
          {lastEstimateAt && <span>Updated {formatTimeAgo(lastEstimateAt)}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="text-sm font-medium text-muted-foreground">Predicted total</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">
              {total != null ? formatCurrency(total, currency ?? quote?.currency ?? "GBP") : "—"}
            </span>
            {quote?.currency && <Badge variant="outline">{(currency ?? quote.currency ?? "GBP").toUpperCase()}</Badge>}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Confidence</span>
            <span>{confidence != null ? `${Math.round(confidence * 100)}%` : "—"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.max(2, Math.round((confidence ?? 0) * 100))}%` }}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">Lines considered</dt>
            <dd>{linesCount}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Quote total</dt>
            <dd>{quote?.totalGBP != null ? formatCurrency(quote.totalGBP, currency ?? quote.currency ?? "GBP") : "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Model version</dt>
            <dd>{estimate?.modelVersionId ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Quote status</dt>
            <dd>{quote?.status ?? "—"}</dd>
          </div>
        </dl>

        {showLowConfidence && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Low confidence result</p>
              <p className="text-xs text-amber-700/80">
                The model is unsure about this estimate. Double-check supplier mappings and questionnaire answers before
                approving.
              </p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>ML powered pricing keeps proposal totals consistent.</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveEstimate}
            disabled={!onSaveEstimate || isEstimating}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Save estimate to quote
          </Button>
          <Button type="button" onClick={onEstimate} disabled={isEstimating}>
            {isEstimating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isEstimating ? "Estimating" : estimateLabel}
          </Button>
          <Button type="button" variant="secondary" onClick={onApprove} disabled={!onApprove}>
            Mark ready to send
          </Button>
        </div>
      </CardFooter>
    </Card>
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
