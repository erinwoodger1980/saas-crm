/**
 * DecisionStep - Post-submit decision screen
 * Lets the user choose to send ML estimate or request a detailed quote.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Mail } from 'lucide-react';

interface DecisionStepProps {
  totalGross?: number;
  primaryColor?: string;
  companyName?: string;
  onDoOwnQuote?: () => void;
  onSendMlEstimate?: () => void;
  onFinish?: () => void;
}

export function DecisionStep({
  totalGross,
  primaryColor = '#3b82f6',
  companyName = 'Us',
  onDoOwnQuote,
  onSendMlEstimate,
  onFinish,
}: DecisionStepProps) {
  const safe = (v: number | undefined | null) => Number.isFinite(v as number) ? Number(v).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div 
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-opacity-10"
          style={{ backgroundColor: primaryColor }}
        >
          <Sparkles className="h-6 w-6" style={{ color: primaryColor }} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Your estimate is ready</h2>
        {Number.isFinite(totalGross as number) && (
          <p className="mt-2 text-slate-600">Total estimate: <span className="font-semibold" style={{ color: primaryColor }}>£{safe(totalGross)}</span></p>
        )}
        <p className="mt-2 text-slate-600">Choose how you’d like to proceed:</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Do your own quote</h3>
          </div>
          <p className="text-sm text-slate-600">Download an itemized estimate and refine details at your own pace.</p>
          <Button
            onClick={onDoOwnQuote}
            variant="outline"
            className="mt-4 w-full rounded-2xl border-2"
          >
            Download estimate PDF
          </Button>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Send ML estimate</h3>
          </div>
          <p className="text-sm text-slate-600">Send the ML-generated estimate to {companyName} to start a detailed quote.</p>
          <Button
            onClick={onSendMlEstimate}
            className="mt-4 w-full rounded-2xl text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Send estimate to {companyName}
          </Button>
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <Button
          onClick={onFinish}
          variant="ghost"
          className="rounded-2xl"
        >
          Finish
        </Button>
      </div>
    </div>
  );
}
