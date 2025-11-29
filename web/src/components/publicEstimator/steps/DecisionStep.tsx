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
  isInviteMode?: boolean;
  onDoOwnQuote?: () => void;
  onSendMlEstimate?: () => void;
  onFinish?: () => void;
}

export function DecisionStep({
  totalGross,
  primaryColor = '#3b82f6',
  companyName = 'Us',
  isInviteMode = false,
  onDoOwnQuote,
  onSendMlEstimate,
  onFinish,
}: DecisionStepProps) {
  const safe = (v: number | undefined | null) => Number.isFinite(v as number) ? Number(v).toFixed(2) : '0.00';

  // Public (AD) mode: show confirmation and next steps, no prices/actions
  if (!isInviteMode) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-opacity-10"
            style={{ backgroundColor: primaryColor }}
          >
            <Sparkles className="h-6 w-6" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Thanks — request received!</h2>
          <p className="mt-2 text-slate-600">
            Our joiner will confirm your measurements and finalize your quote. We’ll email your confirmed price and next steps shortly.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">What happens now?</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1) We review your selections and photos</li>
            <li>2) If needed, we’ll arrange a quick call/site check</li>
            <li>3) We send your confirmed, itemized quote by email</li>
          </ul>
        </div>

        <div className="flex justify-center pt-2">
          <Button onClick={onFinish} className="rounded-2xl text-white" style={{ backgroundColor: primaryColor }}>
            Finish
          </Button>
        </div>
      </div>
    );
  }

  // Invite mode: confirmed pricing flow
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
