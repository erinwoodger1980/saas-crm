/**
 * Progress bar for the public estimator stepper.
 * Shows current step and overall progress.
 */

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
  brandColor?: string;
}

export function ProgressBar({ 
  currentStep, 
  totalSteps, 
  stepLabels,
  brandColor = '#3b82f6' 
}: ProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full space-y-2">
      {/* Progress bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            backgroundColor: brandColor,
          }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Step {currentStep} of {totalSteps}
        </span>
        {stepLabels && stepLabels[currentStep - 1] && (
          <span className="font-medium text-slate-700">
            {stepLabels[currentStep - 1]}
          </span>
        )}
      </div>
    </div>
  );
}
