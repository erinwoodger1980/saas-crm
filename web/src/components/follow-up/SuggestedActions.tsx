// web/src/components/follow-up/SuggestedActions.tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Send, RefreshCw, Mail, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Suggestion = {
  action: string;
  label: string;
  description: string;
  confidence: number;
};

type Props = {
  taskId: string;
  authHeaders: Record<string, string>;
  onAction?: (action: string) => void;
};

export function SuggestedActions({ taskId, authHeaders, onAction }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSuggestions() {
      try {
        setLoading(true);
        const data = await apiFetch<{ ok: boolean; suggestions: Suggestion[] }>(
          `/tasks/${taskId}/suggestions`,
          { headers: authHeaders }
        );
        setSuggestions(data.suggestions || []);
      } catch (e: any) {
        console.error("Failed to load suggestions:", e);
      } finally {
        setLoading(false);
      }
    }

    if (taskId) {
      loadSuggestions();
    }
  }, [taskId, authHeaders]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ ok: boolean; suggestions: Suggestion[] }>(
        `/tasks/${taskId}/suggestions`,
        { headers: authHeaders }
      );
      setSuggestions(data.suggestions || []);
    } catch (e: any) {
      console.error("Failed to refresh suggestions:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4 border-indigo-200 bg-indigo-50">
        <div className="flex items-center gap-2 text-indigo-600">
          <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
          <span className="text-sm">Analyzing task...</span>
        </div>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="p-4 border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 text-slate-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">No suggestions available at this time.</span>
        </div>
      </Card>
    );
  }

  const getIcon = (action: string) => {
    switch (action) {
      case "send_draft":
      case "send_followup":
        return <Send className="h-4 w-4" />;
      case "draft_response":
      case "generate_draft":
        return <Mail className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getActionColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-600 hover:bg-green-700";
    if (confidence >= 0.6) return "bg-blue-600 hover:bg-blue-700";
    return "bg-slate-600 hover:bg-slate-700";
  };

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100">
              <Lightbulb className="h-5 w-5 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Suggested Actions</h3>
          </div>
          <Button
            onClick={refresh}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm text-slate-900">
                      {suggestion.label}
                    </h4>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        suggestion.confidence >= 0.8
                          ? "bg-green-100 text-green-800"
                          : suggestion.confidence >= 0.6
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">
                    {suggestion.description}
                  </p>
                  <Button
                    onClick={() => onAction?.(suggestion.action)}
                    size="sm"
                    className={getActionColor(suggestion.confidence)}
                  >
                    {getIcon(suggestion.action)}
                    <span className="ml-2">{suggestion.label}</span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
