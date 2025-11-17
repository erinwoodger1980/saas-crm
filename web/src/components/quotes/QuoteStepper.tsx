import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuoteStep = {
  id: string;
  title: string;
  description: string;
};

export type QuoteStepperProps = {
  steps: QuoteStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
};

export function QuoteStepper({ steps, currentStep, onStepClick }: QuoteStepperProps) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol role="list" className="flex items-center justify-between">
        {steps.map((step, stepIdx) => {
          const isComplete = stepIdx < currentStep;
          const isCurrent = stepIdx === currentStep;
          const isClickable = onStepClick && stepIdx <= currentStep;

          return (
            <li key={step.id} className={cn("relative flex-1", stepIdx !== steps.length - 1 && "pr-8 sm:pr-20")}>
              {/* Connector line */}
              {stepIdx !== steps.length - 1 && (
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="ml-8 h-0.5 w-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        isComplete ? "w-full bg-emerald-600" : "w-0 bg-muted"
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step button */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(stepIdx)}
                disabled={!isClickable}
                className={cn(
                  "group relative flex flex-col items-start gap-1 text-left",
                  isClickable && "cursor-pointer hover:opacity-80",
                  !isClickable && "cursor-default"
                )}
              >
                <span className="flex items-center">
                  <span
                    className={cn(
                      "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                      isComplete && "border-emerald-600 bg-emerald-600 text-white",
                      isCurrent && "border-blue-600 bg-white text-blue-600",
                      !isComplete && !isCurrent && "border-muted bg-white text-muted-foreground"
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <span className="text-sm font-semibold">{stepIdx + 1}</span>
                    )}
                  </span>
                </span>
                <span className="ml-0 mt-1 flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "text-sm font-semibold transition-colors",
                      isCurrent && "text-blue-600",
                      isComplete && "text-foreground",
                      !isComplete && !isCurrent && "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{step.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
