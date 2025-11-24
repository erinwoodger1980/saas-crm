"use client";

import { useState, useMemo } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { priceDoorForQuote, type PricingConfigInput } from "@/lib/api/quotes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import FireDoorImportSection from "@/components/FireDoorImport";

// Minimal local UI primitives fallback if shadcn components are absent
// (If your design system differs, replace imports above accordingly.)

const LEAF_CONFIGS = [
  "Single Leaf + Frame",
  "Pair of Leaves + Frame",
  "Leaf Only",
] as const;

type LeafConfiguration = typeof LEAF_CONFIGS[number];

export default function FireDoorCalculatorPage() {
  const [authed, setAuthed] = useState(false);
  const [quoteId, setQuoteId] = useState("");

  // Inputs (keep minimal but compatible with backend pricing engine)
  const [quantity, setQuantity] = useState(1);
  const [leafConfiguration, setLeafConfiguration] = useState<LeafConfiguration>("Single Leaf + Frame");
  const [frameWidthMm, setFrameWidthMm] = useState<number | "">(926);
  const [frameHeightMm, setFrameHeightMm] = useState<number | "">(2040);
  const [numberOfLeaves, setNumberOfLeaves] = useState<number | "">(1);
  const [masterLeafWidthMm, setMasterLeafWidthMm] = useState<number | "">(826);

  const [coreType, setCoreType] = useState<string>("FD30");
  const [coreThicknessMm, setCoreThicknessMm] = useState<number | "">(44);
  const [coreSizeStatus, setCoreSizeStatus] = useState<string>("OK");

  const [lippingSelected, setLippingSelected] = useState(true);
  const [lippingWidthMm, setLippingWidthMm] = useState<number | "">(10);

  const [frameMaterial, setFrameMaterial] = useState<string>("Softwood");
  const [frameThicknessMm, setFrameThicknessMm] = useState<number | "">(32);

  const [glassType, setGlassType] = useState<string>("Pyroguard");
  const [fireRating, setFireRating] = useState<string>("FD30");
  const [acousticRatingDb, setAcousticRatingDb] = useState<number | "">(0);
  const [totalGlassAreaM2, setTotalGlassAreaM2] = useState<number | "">(0);

  // Pricing config overrides (optional)
  const [labourPerDoor, setLabourPerDoor] = useState<number | "">(50);
  const [overheadPercent, setOverheadPercent] = useState<number | "">(15);
  const [targetMarginPercent, setTargetMarginPercent] = useState<number | "">(25);

  const [isPricing, setIsPricing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useMemo(() => {
    // Ensure a dev auth cookie for local usage (no-op in prod if already logged in)
    ensureDemoAuth().then((ok) => setAuthed(ok));
  }, []);

  const onPrice = async () => {
    setIsPricing(true);
    setError(null);
    setResult(null);
    try {
      // Auto-create a quote if no ID provided
      let targetQuoteId = quoteId;
      if (!targetQuoteId) {
        const newQuote = await apiFetch<{ id: string }>("/quotes", {
          method: "POST",
          json: {
            customerName: "Fire Door Quote",
            status: "draft",
          },
        });
        targetQuoteId = newQuote.id;
        setQuoteId(targetQuoteId);
      }

      const context = buildContext({
        quantity,
        leafConfiguration,
        frameWidthMm: num(frameWidthMm),
        frameHeightMm: num(frameHeightMm),
        numberOfLeaves: num(numberOfLeaves),
        masterLeafWidthMm: num(masterLeafWidthMm),
        coreType,
        coreThicknessMm: num(coreThicknessMm),
        coreSizeStatus,
        lippingSelected,
        lippingWidthMm: num(lippingWidthMm),
        frameMaterial,
        frameThicknessMm: num(frameThicknessMm),
        glassType,
        fireRating,
        acousticRatingDb: num(acousticRatingDb),
        totalGlassAreaM2: num(totalGlassAreaM2),
      });

      const cfg: PricingConfigInput = {
        defaultLabourCostPerDoor: num(labourPerDoor) ?? undefined,
        defaultOverheadPercentOnCost: num(overheadPercent) ?? undefined,
        targetMarginPercentOnSell: num(targetMarginPercent) ?? undefined,
      };

      const res = await priceDoorForQuote(targetQuoteId, context, cfg);
      setResult(res);
    } catch (e: any) {
      setError(e?.message || "Pricing failed");
    } finally {
      setIsPricing(false);
    }
  };

  const currency = "GBP";
  const breakdown = result?.results?.[0]?.breakdown ?? null;
  const materials = breakdown?.materials ?? [];
  const finalSell = breakdown?.finalSellPrice ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-6 lg:py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Fire Door Calculator</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quickly price a fire door and save to a quote.</p>
      </div>

      {/* Fire Door Import Section - for manufacturers to upload CSV spreadsheets */}
      <div className="mb-8">
        <FireDoorImportSection />
      </div>

      <Separator className="my-8" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Specification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quote ID (optional - will auto-create)</Label>
                  <Input value={quoteId} onChange={(e) => setQuoteId(e.target.value)} placeholder="Leave blank to create new quote" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
                </div>
                <div className="col-span-2">
                  <Label>Leaf configuration</Label>
                  <Select value={leafConfiguration} onValueChange={(v) => setLeafConfiguration(v as LeafConfiguration)}>
                    <SelectTrigger><SelectValue placeholder="Leaf configuration" /></SelectTrigger>
                    <SelectContent>
                      {LEAF_CONFIGS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Frame width (mm)</Label>
                  <Input type="number" value={frameWidthMm} onChange={(e) => setFrameWidthMm(num(e.target.value) ?? "")} />
                </div>
                <div>
                  <Label>Frame height (mm)</Label>
                  <Input type="number" value={frameHeightMm} onChange={(e) => setFrameHeightMm(num(e.target.value) ?? "")} />
                </div>
                <div>
                  <Label>Number of leaves</Label>
                  <Input type="number" value={numberOfLeaves} onChange={(e) => setNumberOfLeaves(num(e.target.value) ?? "")} />
                </div>
                <div>
                  <Label>Master leaf width (mm)</Label>
                  <Input type="number" value={masterLeafWidthMm} onChange={(e) => setMasterLeafWidthMm(num(e.target.value) ?? "")} />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Core type</Label>
                  <Input value={coreType} onChange={(e) => setCoreType(e.target.value)} />
                </div>
                <div>
                  <Label>Core thickness (mm)</Label>
                  <Input type="number" value={coreThicknessMm} onChange={(e) => setCoreThicknessMm(num(e.target.value) ?? "")} />
                </div>
                <div>
                  <Label>Core size status</Label>
                  <Select value={coreSizeStatus} onValueChange={setCoreSizeStatus}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OK">OK</SelectItem>
                      <SelectItem value="CHECK_PRICE">CHECK_PRICE</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">NOT_APPLICABLE</SelectItem>
                      <SelectItem value="NONE">NONE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                  <Label className="block">Lipping selected</Label>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={lippingSelected}
                      onChange={(e) => setLippingSelected(e.target.checked)}
                    />
                    Include lipping material
                  </label>
                </div>
                <div>
                  <Label>Lipping width (mm)</Label>
                  <Input type="number" value={lippingWidthMm} onChange={(e) => setLippingWidthMm(num(e.target.value) ?? "")} />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frame material</Label>
                  <Input value={frameMaterial} onChange={(e) => setFrameMaterial(e.target.value)} />
                </div>
                <div>
                  <Label>Frame thickness (mm)</Label>
                  <Input type="number" value={frameThicknessMm} onChange={(e) => setFrameThicknessMm(num(e.target.value) ?? "")} />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Glass type</Label>
                  <Input value={glassType} onChange={(e) => setGlassType(e.target.value)} />
                </div>
                <div>
                  <Label>Fire rating</Label>
                  <Input value={fireRating} onChange={(e) => setFireRating(e.target.value)} />
                </div>
                <div>
                  <Label>Acoustic rating (dB)</Label>
                  <Input type="number" value={acousticRatingDb} onChange={(e) => setAcousticRatingDb(num(e.target.value) ?? "")} />
                </div>
                <div className="col-span-3">
                  <Label>Total glass area (m²)</Label>
                  <Input type="number" step="0.01" value={totalGlassAreaM2} onChange={(e) => setTotalGlassAreaM2(num(e.target.value) ?? "")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Pricing config (optional)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div>
                <Label>Labour £/door</Label>
                <Input type="number" value={labourPerDoor} onChange={(e) => setLabourPerDoor(num(e.target.value) ?? "")} />
              </div>
              <div>
                <Label>Overhead % (on cost)</Label>
                <Input type="number" value={overheadPercent} onChange={(e) => setOverheadPercent(num(e.target.value) ?? "")} />
              </div>
              <div>
                <Label>Target margin % (on sell)</Label>
                <Input type="number" value={targetMarginPercent} onChange={(e) => setTargetMarginPercent(num(e.target.value) ?? "")} />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={onPrice} disabled={isPricing} className="gap-2">
              {isPricing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isPricing ? "Pricing..." : "Price and save to quote"}
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
          )}

          {breakdown && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Price breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-semibold">
                  Final sell: {finalSell != null ? formatCurrency(finalSell, currency) : "—"}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Materials</div>
                  <ul className="space-y-1 text-sm">
                    {materials.map((m: any, idx: number) => (
                      <li key={idx} className="flex items-center justify-between gap-3">
                        <span className="truncate">{m.description}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {m.quantity.toFixed(2)} {m.unit} @ {formatCurrency(m.sellPerUnit, currency)} = {formatCurrency(m.lineSell, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Separator />
                <pre className="max-h-[300px] overflow-auto rounded-md bg-muted/40 p-3 text-xs">
                  {JSON.stringify(breakdown, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Leave Quote ID blank to auto-create a new quote.</p>
              <p>• Set total glass area to include vision panels.</p>
              <p>• Lipping and frame values influence quantities.</p>
              <p>• Use config overrides to tune labour/overhead/margin.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function num(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildContext(spec: {
  quantity: number;
  leafConfiguration: LeafConfiguration;
  frameWidthMm: number | null;
  frameHeightMm: number | null;
  numberOfLeaves: number | null;
  masterLeafWidthMm: number | null;
  coreType: string | null;
  coreThicknessMm: number | null;
  coreSizeStatus: string | null;
  lippingSelected: boolean;
  lippingWidthMm: number | null;
  frameMaterial: string | null;
  frameThicknessMm: number | null;
  glassType: string | null;
  fireRating: string | null;
  acousticRatingDb: number | null;
  totalGlassAreaM2: number | null;
}) {
  const input = {
    quantity: spec.quantity || 1,
    leafConfiguration: spec.leafConfiguration,
    frameWidthMm: spec.frameWidthMm ?? 0,
    frameHeightMm: spec.frameHeightMm ?? 0,
    numberOfLeaves: spec.numberOfLeaves ?? (spec.leafConfiguration === "Pair of Leaves + Frame" ? 2 : 1),
    masterLeafWidthMm: spec.masterLeafWidthMm ?? undefined,
    coreType: spec.coreType ?? undefined,
    coreThicknessMm: spec.coreThicknessMm ?? undefined,
    lippingMaterialSelected: !!spec.lippingSelected,
    frameMaterial: spec.frameMaterial ?? undefined,
    fireRating: spec.fireRating ?? undefined,
    acousticRatingDb: spec.acousticRatingDb ?? undefined,
    glassType: spec.glassType ?? undefined,
  };

  const dimensions = {
    coreSizeStatus: spec.coreSizeStatus ?? null,
    coreWidthMm: spec.masterLeafWidthMm ?? null, // approximate core width as leaf width
    coreHeightMm: spec.frameHeightMm ?? null, // approximate
    lippingWidthMm: spec.lippingWidthMm ?? null,
    leafHeightMm: spec.frameHeightMm ? Math.max(0, spec.frameHeightMm - 20) : null, // rough allowance
    frameThicknessMm: spec.frameThicknessMm ?? null,
  };

  const apertures = {
    totalGlassAreaM2: spec.totalGlassAreaM2 ?? 0,
  };

  const warnings = {
    coreSizeStatus: dimensions.coreSizeStatus,
    hasVisionPanels: (apertures.totalGlassAreaM2 ?? 0) > 0,
    glassTypeRequired: (apertures.totalGlassAreaM2 ?? 0) > 0 && !input.glassType,
  };

  return { input, dimensions, apertures, warnings };
}

function formatCurrency(value?: number | null, currency?: string | null) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).format(value);
  } catch {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
  }
}
