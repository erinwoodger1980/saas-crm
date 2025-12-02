// web/src/components/automation/AutomationAI.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AutomationRule {
  name: string;
  enabled: boolean;
  trigger: {
    type: string;
    entityType: string;
    fieldName?: string;
  };
  actions: Array<{
    type: string;
    taskTitle: string;
    taskDescription?: string;
    taskType: string;
    priority: string;
    assignToUserId?: string;
    relatedTo: string;
    dueAtCalculation: {
      type: string;
      fieldName?: string;
      offsetDays?: number;
    };
    rescheduleOnTriggerChange: boolean;
    taskInstanceKey?: string;
  }>;
}

interface AutomationAIProps {
  tenantId: string;
  onRuleGenerated: (rule: AutomationRule) => void;
  onCancel: () => void;
}

export default function AutomationAI({ tenantId, onRuleGenerated, onCancel }: AutomationAIProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedRule, setGeneratedRule] = useState<AutomationRule | null>(null);

  const examples = [
    "Create a task to order paint 20 days before the delivery date",
    "Send a follow-up email 3 days after a quote is sent",
    "Create a high-priority installation task when an opportunity is won",
    "Order materials 2 weeks before the installation start date",
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a description of what you want to automate");
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedRule(null);

    try {
      const response = await apiFetch<{ rule: AutomationRule }>("/automation-rules/generate", {
        method: "POST",
        headers: { "x-tenant-id": tenantId },
        body: JSON.stringify({ prompt }),
      });

      setGeneratedRule(response.rule);
    } catch (err: any) {
      console.error("Failed to generate automation:", err);
      setError(err.message || "Failed to generate automation rule. Please try rephrasing your request.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (generatedRule) {
      onRuleGenerated(generatedRule);
    }
  };

  const formatFieldName = (field: string) => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold">AI Automation Assistant</h3>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Describe what you want to automate
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Create a task to order materials 20 days before delivery..."
          className="w-full min-h-[120px] p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={loading}
        />
      </div>

      {/* Examples */}
      <div className="space-y-2">
        <p className="text-sm text-gray-600">Examples:</p>
        <div className="grid gap-2">
          {examples.map((example, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(example)}
              className="text-left text-sm px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              disabled={loading}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">Failed to generate automation</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Generated Rule Preview */}
      {generatedRule && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">Automation Generated</p>
              <p className="text-sm text-green-700 mt-1">Review the details below and click Accept to create this rule.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            {/* Rule Name */}
            <div>
              <span className="font-medium text-gray-700">Name:</span>
              <span className="ml-2 text-gray-900">{generatedRule.name}</span>
            </div>

            {/* Trigger */}
            <div>
              <span className="font-medium text-gray-700">Trigger:</span>
              <div className="ml-2 mt-1 text-gray-900">
                <div>When <strong>{generatedRule.trigger.type.replace(/_/g, ' ').toLowerCase()}</strong></div>
                <div>on <strong>{generatedRule.trigger.entityType}</strong></div>
                {generatedRule.trigger.fieldName && (
                  <div>field: <strong>{formatFieldName(generatedRule.trigger.fieldName)}</strong></div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div>
              <span className="font-medium text-gray-700">Actions:</span>
              {generatedRule.actions.map((action, idx) => (
                <div key={idx} className="ml-2 mt-2 p-3 bg-white rounded border">
                  <div className="font-medium">{action.taskTitle}</div>
                  {action.taskDescription && (
                    <div className="text-gray-600 text-xs mt-1">{action.taskDescription}</div>
                  )}
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <div>Type: <span className="font-medium">{action.taskType}</span></div>
                    <div>Priority: <span className="font-medium">{action.priority}</span></div>
                    {action.dueAtCalculation.type === 'RELATIVE_TO_FIELD' && (
                      <div>
                        Due: <span className="font-medium">
                          {Math.abs(action.dueAtCalculation.offsetDays || 0)} days{' '}
                          {(action.dueAtCalculation.offsetDays || 0) < 0 ? 'before' : 'after'}{' '}
                          {formatFieldName(action.dueAtCalculation.fieldName || '')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        {generatedRule ? (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setGeneratedRule(null);
                setPrompt("");
              }}
              disabled={loading}
            >
              Try Again
            </Button>
            <Button
              onClick={handleAccept}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Accept & Create
            </Button>
          </>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Automation
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
