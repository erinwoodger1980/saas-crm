/**
 * Progress bar for the public estimator stepper.
 * Shows current step and overall progress.
 */

interface ProgressBarProps {
  progress: number; // 0-100
}

export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-3xl font-bold text-gray-900">Get Your Estimate</h1>
        <span className="text-sm font-medium text-gray-600">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
