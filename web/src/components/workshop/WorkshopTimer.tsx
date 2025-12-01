"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Play, Square, X } from "lucide-react";

interface Project {
  id: string;
  title: string;
}

interface Timer {
  id: string;
  projectId: string | null;
  process: string;
  startedAt: string;
  notes?: string | null;
  project?: { id: string; title: string } | null;
  user: { id: string; name: string | null; email: string };
}

interface WorkshopTimerProps {
  projects: Project[];
  processes: Array<{ code: string; name: string; isGeneric?: boolean }>;
  onTimerChange?: () => void;
}

function formatProcess(p: string) {
  return p.replace(/_/g, " ");
}

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export default function WorkshopTimer({ projects, processes, onTimerChange }: WorkshopTimerProps) {
  const [activeTimer, setActiveTimer] = useState<Timer | null>(null);
  const [elapsed, setElapsed] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  
  // Start timer form state
  const [projectId, setProjectId] = useState("");
  const [process, setProcess] = useState("");
  const [notes, setNotes] = useState("");
  
  // Check if selected process is generic
  const selectedProcess = processes.find(p => p.code === process);
  const isGenericProcess = selectedProcess?.isGeneric || false;

  // Load active timer on mount
  useEffect(() => {
    loadTimer();
  }, []);

  // Update elapsed time every second when timer is active
  useEffect(() => {
    if (!activeTimer) return;
    
    const interval = setInterval(() => {
      setElapsed(formatDuration(activeTimer.startedAt));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [activeTimer]);

  async function loadTimer() {
    try {
      const response = await apiFetch<{ ok: boolean; timer: Timer | null }>("/workshop/timer");
      if (response.ok && response.timer) {
        setActiveTimer(response.timer);
        setElapsed(formatDuration(response.timer.startedAt));
      } else {
        setActiveTimer(null);
      }
    } catch (e) {
      console.error("Failed to load timer:", e);
    }
  }

  async function startTimer() {
    if (!process) return;
    const procDef = processes.find(p => p.code === process);
    const isGeneric = procDef?.isGeneric || false;
    // For non-generic timers, projectId is required
    if (!isGeneric && !projectId) return;
    
    setLoading(true);
    try {
      const payload: any = { process, notes: notes || undefined };
      // Only include projectId for non-generic processes
      if (!isGeneric) {
        payload.projectId = projectId;
      }
      
      const response = await apiFetch<{ ok: boolean; timer: Timer }>("/workshop/timer/start", {
        method: "POST",
        json: payload,
      });
      
      if (response.ok && response.timer) {
        setActiveTimer(response.timer);
        setShowStart(false);
        setProjectId("");
        setProcess("");
        setNotes("");
        if (onTimerChange) onTimerChange();
      }
    } catch (e: any) {
      alert("Failed to start timer: " + (e?.message || "Unknown error"));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function swapTimer() {
    if (!activeTimer) return;
    if (!process) return;
    const procDef = processes.find(p => p.code === process);
    const isGeneric = procDef?.isGeneric || false;
    // For non-generic timers, projectId is required
    if (!isGeneric && !projectId) return;
    
    setLoading(true);
    try {
      // Stop current timer first
      await apiFetch<{ ok: boolean; timeEntry: any; hours: number | string }>("/workshop/timer/stop", { method: "POST" });
      
      // Start new timer
      const payload: any = { process, notes: notes || undefined };
      if (!isGeneric) {
        payload.projectId = projectId;
      }
      
      const response = await apiFetch<{ ok: boolean; timer: Timer }>("/workshop/timer/start", {
        method: "POST",
        json: payload,
      });
      if (response.ok && response.timer) {
        setActiveTimer(response.timer);
        setShowSwap(false);
        setProjectId("");
        setProcess("");
        setNotes("");
        if (onTimerChange) onTimerChange();
      }
    } catch (e: any) {
      alert("Failed to swap timer: " + (e?.message || "Unknown error"));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function stopTimer() {
    if (!activeTimer) return;
    
    setLoading(true);
    try {
      const response = await apiFetch<{ ok: boolean; timeEntry: any; hours: number | string }>("/workshop/timer/stop", {
        method: "POST",
      });
      
      if (response.ok) {
        setActiveTimer(null);
        setElapsed("");
        if (onTimerChange) onTimerChange();
        
        // Show success message with hours logged
        const logged = Number((response as any).hours);
        if (!isNaN(logged)) {
          alert(`Timer stopped. Logged ${logged.toFixed(2)} hours.`);
        } else if (activeTimer?.startedAt) {
          // Fallback: compute locally if API sent a non-number (e.g., Decimal serialized as string)
          const diffHrs = (Date.now() - new Date(activeTimer.startedAt).getTime()) / (1000 * 60 * 60);
          const rounded = Math.round(diffHrs * 4) / 4;
          alert(`Timer stopped. Logged ${Math.max(0.25, rounded).toFixed(2)} hours.`);
        } else {
          alert(`Timer stopped.`);
        }
      }
    } catch (e: any) {
      alert("Failed to stop timer: " + (e?.message || "Unknown error"));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function cancelTimer() {
    if (!activeTimer) return;
    
    if (!confirm("Cancel this timer without logging time?")) return;
    
    setLoading(true);
    try {
      const response = await apiFetch<{ ok: boolean }>("/workshop/timer", {
        method: "DELETE",
      });
      
      if (response.ok) {
        setActiveTimer(null);
        setElapsed("");
        if (onTimerChange) onTimerChange();
      }
    } catch (e: any) {
      alert("Failed to cancel timer: " + (e?.message || "Unknown error"));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Mobile-optimized UI
  if (activeTimer) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <div className="p-4 space-y-3">
          {/* Timer display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <div>
                <div className="font-semibold text-lg">{elapsed}</div>
                <div className="text-xs text-muted-foreground">Timer running</div>
              </div>
            </div>
          </div>
          
          {/* Project and process info */}
          <div className="space-y-1 pt-2 border-t">
            {activeTimer.projectId && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Project:</span>
                <span className="font-medium text-sm">
                  {activeTimer.project?.title ||
                    projects.find((p) => p.id === activeTimer.projectId)?.title ||
                    "—"}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Process:</span>
              <span className="font-medium text-sm">
                {processes.find((p) => p.code === activeTimer.process)?.name ||
                  formatProcess(activeTimer.process)}
              </span>
            </div>
            {!activeTimer.projectId && (
              <div className="text-xs text-muted-foreground">
                Generic time entry (no project)
              </div>
            )}
            {activeTimer.notes && (
              <div className="text-xs text-muted-foreground pt-1">
                Note: {activeTimer.notes}
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={stopTimer}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop & Log Time
            </Button>
            <Button
              onClick={() => setShowSwap(true)}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              Swap
            </Button>
            <Button
              onClick={cancelTimer}
              disabled={loading}
              variant="outline"
              size="lg"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {showSwap && (() => {
            const swapIsGeneric = processes.find(p => p.code === process)?.isGeneric || false;
            
            return (
              <div className="pt-4 border-t mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Swap Timer</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowSwap(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Process</label>
                  <Select value={process} onValueChange={(v) => { setProcess(v); setProjectId(""); setProjectSearch(""); }}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select process" />
                    </SelectTrigger>
                    <SelectContent>
                      {processes.map((p) => (
                        <SelectItem key={p.code} value={p.code} className="text-base py-3">
                          {p.name} {p.isGeneric && "⭐"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!swapIsGeneric && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Project</label>
                      <Input
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder="Search projects..."
                        className="h-10 mb-2"
                      />
                      <Select value={projectId} onValueChange={setProjectId}>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects
                            .filter((p) =>
                              projectSearch
                                ? p.title.toLowerCase().includes(projectSearch.toLowerCase())
                                : true
                            )
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-base py-3">
                                {p.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add a note..."
                    className="h-12 text-base"
                  />
                </div>

                <Button
                  onClick={swapTimer}
                  disabled={!process || (!swapIsGeneric && !projectId) || loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  Swap & Start New Timer
                </Button>
              </div>
            );
          })()}
        </div>
      </Card>
    );
  }

  // Start timer UI
  if (showStart) {
    return (
      <Card className="bg-white border-2">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Start Timer</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStart(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Process</label>
              <Select value={process} onValueChange={(v) => { setProcess(v); setProjectId(""); setProjectSearch(""); }}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select process" />
                </SelectTrigger>
                <SelectContent>
                  {processes.map((p) => (
                    <SelectItem key={p.code} value={p.code} className="text-base py-3">
                      {p.name} {p.isGeneric && "⭐"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isGenericProcess && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Project</label>
                  <Input
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="h-10 mb-2"
                  />
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects
                        .filter((p) =>
                          projectSearch
                            ? p.title.toLowerCase().includes(projectSearch.toLowerCase())
                            : true
                        )
                        .map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-base py-3">
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <div>
              <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note..."
                className="h-12 text-base"
              />
            </div>
          </div>
          
          <Button
            onClick={startTimer}
            disabled={!process || (!isGenericProcess && !projectId) || loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Timer
          </Button>
        </div>
      </Card>
    );
  }

  // Idle state - show single start button
  return (
    <Button
      onClick={() => setShowStart(true)}
      className="w-full bg-blue-600 hover:bg-blue-700"
      size="lg"
    >
      <Play className="w-4 h-4 mr-2" />
      Start Timer
    </Button>
  );
}
