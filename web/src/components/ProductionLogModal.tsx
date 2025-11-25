"use client";

import { useState } from "react";
import { X, Plus, TrendingUp, Clock, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

interface ProductionLogModalProps {
  projectId: string;
  projectName: string;
  process: string;
  processLabel: string;
  currentPercent: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProductionLog {
  id: string;
  process: string;
  previousPercent: number;
  addedPercent: number;
  newPercent: number;
  loggedBy: string;
  loggedAt: string;
  notes?: string;
}

export default function ProductionLogModal({
  projectId,
  projectName,
  process,
  processLabel,
  currentPercent,
  onClose,
  onSuccess,
}: ProductionLogModalProps) {
  const [addedPercent, setAddedPercent] = useState<number>(10);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const remainingPercent = 100 - currentPercent;
  const newPercent = Math.min(100, currentPercent + addedPercent);

  async function loadLogs() {
    try {
      const response = await apiFetch<{ logs: ProductionLog[] }>(
        `/fire-door-production/${projectId}/logs`
      );
      setLogs(response.logs.filter(log => log.process === process));
      setShowLogs(true);
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  }

  async function handleSubmit() {
    if (addedPercent <= 0) return;

    setLoading(true);
    try {
      await apiFetch(`/fire-door-production/${projectId}/logs`, {
        method: "POST",
        json: {
          process,
          addedPercent,
          notes: notes.trim() || undefined,
        },
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to log production:", error);
      alert("Failed to log production progress");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">Log Production Progress</h2>
              <p className="text-blue-100 text-sm">
                {projectName} - {processLabel}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Current Progress */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-600">Current Progress</span>
              <span className="text-3xl font-bold text-slate-900">{currentPercent}%</span>
            </div>
            <div className="relative h-4 bg-white rounded-full overflow-hidden shadow-inner">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 rounded-full"
                style={{ width: `${currentPercent}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500 text-right">
              {remainingPercent}% remaining
            </div>
          </div>

          {/* Add Progress */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Add Progress Percentage
            </label>
            
            {/* Quick Buttons */}
            <div className="flex flex-wrap gap-2">
              {[5, 10, 25, 50].map((value) => (
                <button
                  key={value}
                  onClick={() => setAddedPercent(value)}
                  disabled={currentPercent + value > 100}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    addedPercent === value
                      ? "bg-blue-600 text-white shadow-lg scale-105"
                      : currentPercent + value > 100
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-105"
                  }`}
                >
                  +{value}%
                </button>
              ))}
              {remainingPercent > 0 && remainingPercent <= 100 && (
                <button
                  onClick={() => setAddedPercent(remainingPercent)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    addedPercent === remainingPercent
                      ? "bg-green-600 text-white shadow-lg scale-105"
                      : "bg-green-50 text-green-700 hover:bg-green-100 hover:scale-105"
                  }`}
                >
                  Complete ({remainingPercent}%)
                </button>
              )}
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={remainingPercent}
                value={addedPercent}
                onChange={(e) => setAddedPercent(Math.min(remainingPercent, parseInt(e.target.value) || 0))}
                className="text-lg font-semibold text-center"
              />
              <span className="text-slate-500">%</span>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min={0}
              max={remainingPercent}
              value={addedPercent}
              onChange={(e) => setAddedPercent(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Preview New Progress */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-green-700">New Progress</span>
              <span className="text-3xl font-bold text-green-700">{newPercent}%</span>
            </div>
            <div className="relative h-4 bg-white rounded-full overflow-hidden shadow-inner">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${newPercent}%` }}
              />
            </div>
            {newPercent === 100 && (
              <div className="mt-3 text-sm font-medium text-green-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Process Complete! 🎉
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this progress update..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>

          {/* History Button */}
          <Button
            variant="outline"
            onClick={loadLogs}
            className="w-full"
            disabled={showLogs}
          >
            <Clock className="w-4 h-4 mr-2" />
            {showLogs ? "Showing History" : "View History"}
          </Button>

          {/* Logs */}
          {showLogs && logs.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Production History</h4>
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-50 rounded-lg p-3 border border-slate-200"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="font-medium text-slate-700">{log.loggedBy}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(log.loggedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">
                    {log.previousPercent}% → {log.newPercent}% 
                    <span className="text-green-600 font-semibold ml-2">
                      (+{log.addedPercent}%)
                    </span>
                  </div>
                  {log.notes && (
                    <p className="text-xs text-slate-500 mt-1">{log.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {showLogs && logs.length === 0 && (
            <div className="text-center text-slate-500 py-4">
              No production logs yet for this process
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || addedPercent <= 0}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {loading ? "Logging..." : "Log Progress"}
          </Button>
        </div>
      </div>
    </div>
  );
}
