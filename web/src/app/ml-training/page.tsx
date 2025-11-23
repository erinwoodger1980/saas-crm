"use client";
/**
 * ML Training Questionnaire Interface
 * 
 * This interface allows users to:
 * 1. Fill in questionnaire fields manually
 * 2. Upload photos of the project
 * 3. Upload supplier quote PDFs
 * 4. Compare ML predicted price vs actual supplier price
 * 5. Provide feedback to improve ML accuracy
 */

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Target 
} from "lucide-react";

interface QuestionnaireField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface TrainingSession {
  questionnaireAnswers: Record<string, any>;
  photos: File[];
  supplierQuotePdf?: File;
  actualPrice?: number;
  mlEstimatedPrice?: number;
  mlConfidence?: number;
  variance?: number;
}

export default function MLTrainingPage() {
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [session, setSession] = useState<TrainingSession>({
    questionnaireAnswers: {},
    photos: [],
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mlProcessing, setMlProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    loadFields();
    loadMetrics();
  }, []);

  async function loadFields() {
    try {
      const resp = await fetch(`${apiBase}/questionnaire-fields?includeStandard=true`);
      if (!resp.ok) throw new Error("Failed to load fields");
      const json = await resp.json();
      setFields(json.filter((f: any) => f.isStandard && f.isActive));
    } catch (err: any) {
      console.error("Failed to load fields:", err);
      setMessage({ type: "error", text: "Failed to load questionnaire fields" });
    }
  }

  async function loadMetrics() {
    try {
      // Replace with actual tenant ID from auth context
      const tenantId = "demo-tenant-id";
      const resp = await fetch(`${apiBase}/quote-approval/${tenantId}/metrics?days=90`);
      if (!resp.ok) throw new Error("Failed to load metrics");
      const json = await resp.json();
      setMetrics(json);
    } catch (err: any) {
      console.error("Failed to load metrics:", err);
    }
  }

  function handleAnswerChange(key: string, value: any) {
    setAnswers(prev => ({ ...prev, [key]: value }));
    setSession(prev => ({
      ...prev,
      questionnaireAnswers: { ...prev.questionnaireAnswers, [key]: value },
    }));
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setSession(prev => ({
      ...prev,
      photos: [...prev.photos, ...files],
    }));
  }

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSession(prev => ({
        ...prev,
        supplierQuotePdf: file,
      }));
    }
  }

  async function requestMLEstimate() {
    setMlProcessing(true);
    setMessage(null);
    
    try {
      // Call ML prediction endpoint with current answers
      const resp = await fetch(`${apiBase}/ml/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: session.questionnaireAnswers,
          photos: session.photos.length,
        }),
      });
      
      if (!resp.ok) throw new Error("Failed to get ML estimate");
      
      const result = await resp.json();
      setSession(prev => ({
        ...prev,
        mlEstimatedPrice: result.estimatedPrice,
        mlConfidence: result.confidence,
      }));
      
      setMessage({ type: "success", text: `ML estimate received: £${result.estimatedPrice.toFixed(2)} (${(result.confidence * 100).toFixed(1)}% confidence)` });
    } catch (err: any) {
      console.error("ML prediction failed:", err);
      setMessage({ type: "error", text: "Failed to get ML estimate. Make sure required fields are filled." });
    } finally {
      setMlProcessing(false);
    }
  }

  async function submitTrainingExample() {
    if (!session.actualPrice) {
      setMessage({ type: "error", text: "Please enter the actual supplier price" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Calculate variance
      let variance = null;
      if (session.mlEstimatedPrice && session.actualPrice) {
        variance = ((session.actualPrice - session.mlEstimatedPrice) / session.mlEstimatedPrice) * 100;
      }

      // Upload photos and PDF
      const formData = new FormData();
      session.photos.forEach((photo, idx) => {
        formData.append(`photo_${idx}`, photo);
      });
      if (session.supplierQuotePdf) {
        formData.append("supplierQuote", session.supplierQuotePdf);
      }
      formData.append("answers", JSON.stringify(session.questionnaireAnswers));
      formData.append("actualPrice", session.actualPrice.toString());
      if (session.mlEstimatedPrice) {
        formData.append("mlEstimatedPrice", session.mlEstimatedPrice.toString());
      }
      if (session.mlConfidence) {
        formData.append("mlConfidence", session.mlConfidence.toString());
      }
      if (variance !== null) {
        formData.append("variance", variance.toString());
      }

      const resp = await fetch(`${apiBase}/ml/training-example`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) throw new Error("Failed to submit training example");

      const result = await resp.json();
      
      setMessage({ 
        type: "success", 
        text: `Training example submitted! Variance: ${variance?.toFixed(1)}%. This helps improve ML accuracy.` 
      });
      
      // Reset form
      setSession({
        questionnaireAnswers: {},
        photos: [],
      });
      setAnswers({});
      
      // Reload metrics
      await loadMetrics();
      
    } catch (err: any) {
      console.error("Failed to submit training example:", err);
      setMessage({ type: "error", text: "Failed to submit training example" });
    } finally {
      setLoading(false);
    }
  }

  const progressPct = fields.length > 0 
    ? (Object.keys(answers).filter(k => answers[k] != null && answers[k] !== '').length / fields.length) * 100 
    : 0;

  const variance = session.mlEstimatedPrice && session.actualPrice
    ? ((session.actualPrice - session.mlEstimatedPrice) / session.mlEstimatedPrice) * 100
    : null;

  return (
    <div className="container mx-auto max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">ML Training Interface</h1>
        <p className="text-muted-foreground">
          Train the ML by comparing real supplier quotes against predicted prices. Your feedback helps improve accuracy.
        </p>
      </div>

      {/* Trust Metrics Dashboard */}
      {metrics && metrics.totalQuotes > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              ML Trust Score
            </CardTitle>
            <CardDescription>
              Based on {metrics.totalQuotes} approved quotes over the last {metrics.period?.days || 30} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Trust Score</div>
                <div className="text-3xl font-bold text-emerald-600">
                  {metrics.trustScore.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Within 10% accuracy
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Accurate Within 10%</div>
                <div className="text-2xl font-bold">
                  {metrics.accurateWithin10Pct}/{metrics.totalQuotes}
                </div>
                <div className="text-xs text-muted-foreground">
                  {metrics.accurateWithin10PctPercent.toFixed(1)}% of quotes
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Avg Variance</div>
                <div className="text-2xl font-bold">
                  {metrics.averageVariancePct.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Median: {metrics.medianVariancePct.toFixed(1)}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">ML Confidence</div>
                <div className="text-2xl font-bold">
                  {(metrics.confidenceAvg * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Average confidence
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Questionnaire */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>
                Fill in the questionnaire as you would for a real quote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div 
                  className="h-full bg-emerald-500 transition-all" 
                  style={{ width: `${progressPct}%` }} 
                />
              </div>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {fields.map(field => (
                  <div key={field.id} className="space-y-1">
                    <Label htmlFor={field.key}>
                      {field.label}
                      {field.required && <span className="text-rose-500 ml-1">*</span>}
                    </Label>
                    {field.type === "number" ? (
                      <Input
                        id={field.key}
                        type="number"
                        value={answers[field.key] || ""}
                        onChange={e => handleAnswerChange(field.key, parseFloat(e.target.value) || null)}
                      />
                    ) : field.type === "select" && field.options ? (
                      <select
                        id={field.key}
                        value={answers[field.key] || ""}
                        onChange={e => handleAnswerChange(field.key, e.target.value)}
                        className="w-full rounded-md border bg-background p-2"
                      >
                        <option value="">Select...</option>
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={field.key}
                        value={answers[field.key] || ""}
                        onChange={e => handleAnswerChange(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Photo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Project Photos
              </CardTitle>
              <CardDescription>
                Upload photos of the project (optional but helpful for ML)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="cursor-pointer"
              />
              {session.photos.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {session.photos.length} photo(s) selected
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: ML Comparison */}
        <div className="space-y-6">
          {/* Get ML Estimate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                ML Price Prediction
              </CardTitle>
              <CardDescription>
                Get ML's prediction based on your answers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={requestMLEstimate}
                disabled={mlProcessing || Object.keys(answers).length === 0}
                className="w-full"
              >
                {mlProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  "Get ML Estimate"
                )}
              </Button>
              
              {session.mlEstimatedPrice && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <div className="text-sm text-muted-foreground">ML Predicted Price</div>
                  <div className="text-3xl font-bold">
                    £{session.mlEstimatedPrice.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Confidence: {((session.mlConfidence || 0) * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supplier Quote Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Supplier Quote (PDF)
              </CardTitle>
              <CardDescription>
                Upload the actual supplier quote PDF
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="cursor-pointer"
              />
              {session.supplierQuotePdf && (
                <div className="text-sm text-muted-foreground">
                  {session.supplierQuotePdf.name}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actual Price Input */}
          <Card>
            <CardHeader>
              <CardTitle>Actual Supplier Price</CardTitle>
              <CardDescription>
                Enter the real price from the supplier quote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="actualPrice">Price (GBP)</Label>
                <Input
                  id="actualPrice"
                  type="number"
                  step="0.01"
                  value={session.actualPrice || ""}
                  onChange={e => setSession(prev => ({
                    ...prev,
                    actualPrice: parseFloat(e.target.value) || undefined,
                  }))}
                  placeholder="0.00"
                />
              </div>

              {/* Variance Display */}
              {variance !== null && (
                <div className={`rounded-lg border p-4 ${
                  Math.abs(variance) <= 10 
                    ? "bg-emerald-50 border-emerald-200" 
                    : Math.abs(variance) <= 20
                    ? "bg-amber-50 border-amber-200"
                    : "bg-rose-50 border-rose-200"
                }`}>
                  <div className="text-sm font-medium mb-1">Price Variance</div>
                  <div className="text-2xl font-bold">
                    {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                  </div>
                  <div className="text-xs mt-1">
                    {Math.abs(variance) <= 10 
                      ? "✓ Excellent accuracy" 
                      : Math.abs(variance) <= 20
                      ? "⚠ Acceptable variance"
                      : "✗ Needs improvement"}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button 
                onClick={submitTrainingExample}
                disabled={loading || !session.actualPrice}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Submit Training Example
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
