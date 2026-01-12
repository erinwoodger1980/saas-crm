"use client";

import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Play, Square, X } from "lucide-react";
import ProcessCompletionDialog from "./ProcessCompletionDialog";

interface Project {
  id: string;
  title: string;
}

interface Task {
  id: string;
  title: string;
  taskType: string;
  relatedType: string | null;
  relatedId: string | null;
  dueAt: string | null;
  meta?: Record<string, any> | null;
}

interface Timer {
  id: string;
  projectId: string | null;
  process: string;
  startedAt: string;
  notes?: string | null;
  project?: { id: string; title: string } | null;
  user: { id: string; name: string | null; email: string };
  taskId?: string | null;
  task?: Task | null;
}

interface WorkshopTimerProps {
  projects: Project[];
  processes: Array<{ code: string; name: string; isGeneric?: boolean; isLastManufacturing?: boolean; isLastInstallation?: boolean }>;
  onTimerChange?: () => void;
  currentUser?: { workshopProcessCodes?: string[] } | null;
}

export interface WorkshopTimerHandle {
  openWithProject: (projectId: string) => void;
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

const WorkshopTimer = forwardRef<WorkshopTimerHandle, WorkshopTimerProps>(({ projects, processes, onTimerChange, currentUser }, ref) => {
  const [activeTimer, setActiveTimer] = useState<Timer | null>(null);
  const [elapsed, setElapsed] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [completionMode, setCompletionMode] = useState<"stop" | "swap">("stop");
  
  // Task state for quick-start from tasks
  const [dueTodayTasks, setDueTodayTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  
  // Filter processes based on user's allowed processes
  // If workshopProcessCodes is empty or undefined, show all processes
  const allowedProcesses = processes.filter(p => {
    const userProcessCodes = currentUser?.workshopProcessCodes;
    // If no restrictions (empty array or undefined), show all processes
    if (!userProcessCodes || userProcessCodes.length === 0) {
      return true;
    }
    // Otherwise, only show processes the user is allowed to work on
    return userProcessCodes.includes(p.code);
  });
  
  // Start timer form state
  const [projectId, setProjectId] = useState("");
  const [process, setProcess] = useState("");
  const [notes, setNotes] = useState("");
  
  // Check if selected process is generic
  const selectedProcess = allowedProcesses.find(p => p.code === process);
  const isGenericProcess = selectedProcess?.isGeneric || false;
  
  // Get current timer process details
  const activeTimerProcess = activeTimer ? allowedProcesses.find(p => p.code === activeTimer.process) : null;
  const isLastProcess = activeTimerProcess?.isLastManufacturing || activeTimerProcess?.isLastInstallation || false;

  // Expose method to open timer with a specific project
  useImperativeHandle(ref, () => ({
    openWithProject: (projectId: string) => {
      setShowStart(true);
      setProjectId(projectId);
      setProjectSearch("");
    },
  }));

  // Load active timer on mount
  useEffect(() => {
    loadTimer();
  }, []);

  // Fetch tasks when start modal opens
  useEffect(() => {
    if (showStart) {
      loadTasks();
    }
  }, [showStart]);

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

  async function loadTasks() {
    setLoadingTasks(true);
    try {
      const response = await apiFetch<{ 
        ok: boolean; 
        tasks: Task[];
        counts?: { dueToday: number; overdue: number; dueTodayIds: string[]; overdueIds: string[] };
      }>("/tasks/workshop?includeCounts=true");
      
      if (response.ok && response.counts) {
        // Filter tasks into due today and overdue
        const dueToday = response.tasks.filter(t => response.counts!.dueTodayIds.includes(t.id));
        const overdue = response.tasks.filter(t => response.counts!.overdueIds.includes(t.id));
        setDueTodayTasks(dueToday);
        setOverdueTasks(overdue);
      }
    } catch (e) {
      console.error("Failed to load tasks:", e);
    } finally {
      setLoadingTasks(false);
    }
  }

  async function startTimerWith(payloadBase: { process: string; projectId?: string; notes?: string; taskId?: string }) {
    const procDef = allowedProcesses.find((p) => p.code === payloadBase.process);
    const isGeneric = procDef?.isGeneric || false;
    if (!payloadBase.process) {
      alert("Select a process to start the timer.");
      return;
    }
    if (!procDef) {
      alert("You can’t start a timer for this process (not permitted). Choose a process manually.");
      return;
    }
    if (!isGeneric && !payloadBase.projectId) {
      alert("This timer needs a project. Link the task to a job or pick a project/process manually.");
      return;
    }

    setLoading(true);
    try {
      const payload: any = { process: payloadBase.process, notes: payloadBase.notes || undefined };
      if (!isGeneric) {
        payload.projectId = payloadBase.projectId;
      }
      if (payloadBase.taskId) {
        payload.taskId = payloadBase.taskId;
      }

      // Attempt to capture geolocation
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: false,
            });
          });

          payload.latitude = position.coords.latitude;
          payload.longitude = position.coords.longitude;
          payload.accuracy = position.coords.accuracy;
        } catch (geoError: any) {
          console.warn("Could not capture location:", geoError.message);
        }
      }

      const response = await apiFetch<{ ok: boolean; timer: Timer; warning?: string; outsideGeofence?: boolean }>("/workshop/timer/start", {
        method: "POST",
        json: payload,
      });

      if (response.ok && response.timer) {
        setActiveTimer(response.timer);
        setShowStart(false);
        setProjectId("");
        setProcess("");
        setNotes("");
        setSelectedTaskId(null);
        if (onTimerChange) onTimerChange();

        if (response.warning) {
          alert(response.warning);
        }
      }
    } catch (e: any) {
      alert("Failed to start timer: " + (e?.message || "Unknown error"));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function startTimer() {
    if (!process) return;
    const procDef = allowedProcesses.find((p) => p.code === process);
    const isGeneric = procDef?.isGeneric || false;
    if (!isGeneric && !projectId) return;

    await startTimerWith({
      process,
      projectId: isGeneric ? undefined : projectId,
      notes: notes || undefined,
      taskId: selectedTaskId || undefined,
    });
  }

  async function startFromTask(task: Task) {
    const relatedType = String(task.relatedType || "").toLowerCase();
    const taskProjectId = relatedType === "opportunity" && task.relatedId ? String(task.relatedId) : "";

    const taskProcessCode = String((task.meta as any)?.processCode || "");
    if (!taskProcessCode) {
      alert("This task isn’t linked to a process yet. Select a process on the task, then try again.");
      return;
    }

    // Optimistically update the form so the user sees what started
    setSelectedTaskId(task.id);
    setNotes(task.title);
    if (taskProjectId) {
      setProjectId(taskProjectId);
      setProjectSearch("");
    }

    setProcess(taskProcessCode);

    await startTimerWith({
      process: taskProcessCode,
      projectId: taskProjectId || undefined,
      notes: task.title,
      taskId: task.id,
    });
  }

  async function updateTaskProcessCode(task: Task, nextProcessCode: string | null) {
    setSavingTaskId(task.id);
    try {
      const nextMeta: Record<string, any> = { ...((task.meta as any) || {}) };
      if (nextProcessCode) {
        nextMeta.processCode = nextProcessCode;
      } else {
        delete nextMeta.processCode;
      }

      const updated = await apiFetch<any>(`/tasks/${task.id}`, {
        method: "PATCH",
        json: { meta: nextMeta },
      });

      const applyUpdate = (arr: Task[]) => arr.map((t) => (t.id === task.id ? { ...t, meta: updated?.meta ?? nextMeta } : t));
      setDueTodayTasks(applyUpdate);
      setOverdueTasks(applyUpdate);
    } catch (e: any) {
      alert("Failed to update task process: " + (e?.message || "Unknown error"));
      console.error(e);
    } finally {
      setSavingTaskId(null);
    }
  }

  async function swapTimer() {
    if (!activeTimer) {
      console.error("[swapTimer] No active timer");
      return;
    }
    if (!process) {
      console.error("[swapTimer] No process selected");
      return;
    }
    const procDef = allowedProcesses.find(p => p.code === process);
    const isGeneric = procDef?.isGeneric || false;
    // For non-generic timers, projectId is required
    if (!isGeneric && !projectId) {
      console.error("[swapTimer] No project selected for non-generic process");
      return;
    }
    
    console.log("[swapTimer] Showing completion dialog");
    // Show completion dialog for old process
    setCompletionMode("swap");
    setShowCompletionDialog(true);
  }
  
  async function handleSwapTimerComplete(comments: string) {
    if (!activeTimer) {
      console.error("[handleSwapTimerComplete] No active timer");
      return;
    }
    if (!process) {
      console.error("[handleSwapTimerComplete] No process selected");
      return;
    }
    const procDef = allowedProcesses.find(p => p.code === process);
    const isGeneric = procDef?.isGeneric || false;
    
    console.log("[handleSwapTimerComplete] Starting timer swap with completion");
    setLoading(true);
    try {
      // Stop current timer
      console.log("[handleSwapTimerComplete] Stopping current timer");
      await apiFetch<{ ok: boolean; timeEntry: any; hours: number | string }>("/workshop/timer/stop", { method: "POST" });
      
      // Mark old process as complete if we have a project
      if (activeTimer.projectId && activeTimer.process) {
        console.log("[handleSwapTimerComplete] Marking old process as complete");
        await apiFetch("/workshop/process-status", {
          method: "PATCH",
          json: {
            projectId: activeTimer.projectId,
            processCode: activeTimer.process,
            status: "completed",
            completionComments: comments || undefined,
          },
        });
      }
      
      // Start new timer with location
      const payload: any = { process, notes: notes || undefined };
      if (!isGeneric) {
        payload.projectId = projectId;
      }
      
      // Attempt to capture geolocation
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              timeout: 5000,
              enableHighAccuracy: false 
            });
          });
          
          payload.latitude = position.coords.latitude;
          payload.longitude = position.coords.longitude;
          payload.accuracy = position.coords.accuracy;
        } catch (geoError: any) {
          console.warn("Could not capture location:", geoError.message);
          // Continue without location - it's optional
        }
      }
      
      console.log("[handleSwapTimerComplete] Starting new timer");
      const response = await apiFetch<{ ok: boolean; timer: Timer; warning?: string; outsideGeofence?: boolean }>("/workshop/timer/start", {
        method: "POST",
        json: payload,
      });
      if (response.ok && response.timer) {
        setActiveTimer(response.timer);
        setShowSwap(false);
        setShowCompletionDialog(false);
        setProjectId("");
        setProcess("");
        setNotes("");
        if (onTimerChange) await onTimerChange();
        
        // Show geofence warning if outside designated area
        if (response.warning) {
          alert(response.warning);
        } else {
          alert("Process marked complete and timer swapped.");
        }
      }
    } catch (e: any) {
      console.error("[handleSwapTimerComplete] Error:", e);
      const errorDetails = e?.details || e?.body || e?.message || "Unknown error";
      const errorMsg = typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails);
      alert("Failed to swap timer: " + errorMsg);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSwapTimerSkip() {
    if (!activeTimer) return;
    if (!process) return;
    const procDef = allowedProcesses.find(p => p.code === process);
    const isGeneric = procDef?.isGeneric || false;
    
    setLoading(true);
    try {
      // Stop current timer first
      await apiFetch<{ ok: boolean; timeEntry: any; hours: number | string }>("/workshop/timer/stop", { method: "POST" });
      
      // Start new timer with location
      const payload: any = { process, notes: notes || undefined };
      if (!isGeneric) {
        payload.projectId = projectId;
      }
      
      // Attempt to capture geolocation
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              timeout: 5000,
              enableHighAccuracy: false 
            });
          });
          
          payload.latitude = position.coords.latitude;
          payload.longitude = position.coords.longitude;
          payload.accuracy = position.coords.accuracy;
        } catch (geoError: any) {
          console.warn("Could not capture location:", geoError.message);
          // Continue without location - it's optional
        }
      }
      
      const response = await apiFetch<{ ok: boolean; timer: Timer; warning?: string; outsideGeofence?: boolean }>("/workshop/timer/start", {
        method: "POST",
        json: payload,
      });
      if (response.ok && response.timer) {
        setActiveTimer(response.timer);
        setShowSwap(false);
        setShowCompletionDialog(false);
        setProjectId("");
        setProcess("");
        setNotes("");
        if (onTimerChange) onTimerChange();
        
        // Show geofence warning if outside designated area
        if (response.warning) {
          alert(response.warning);
        }
      }
    } catch (e: any) {
      alert("Failed to swap timer: " + (e?.message || "Unknown error"));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function stopTimer() {
    if (!activeTimer) {
      console.error("[stopTimer] No active timer");
      return;
    }
    
    console.log("[stopTimer] Showing completion dialog");
    // Show completion dialog
    setCompletionMode("stop");
    setShowCompletionDialog(true);
  }
  
  async function handleStopTimerComplete(comments: string) {
    if (!activeTimer) {
      console.error("[handleStopTimerComplete] No active timer");
      return;
    }
    
    console.log("[handleStopTimerComplete] Starting timer stop with completion");
    setLoading(true);
    try {
      const response = await apiFetch<{ ok: boolean; timeEntry: any; hours: number | string }>("/workshop/timer/stop", {
        method: "POST",
      });
      
      if (response.ok) {
        // Mark process as complete if we have a project
        if (activeTimer.projectId && activeTimer.process) {
          console.log("[handleStopTimerComplete] Marking process as complete");
          await apiFetch("/workshop/process-status", {
            method: "PATCH",
            json: {
              projectId: activeTimer.projectId,
              processCode: activeTimer.process,
              status: "completed",
              completionComments: comments || undefined,
            },
          });
        }
        
        // Complete task if timer was linked to a task
        if (activeTimer.taskId) {
          console.log("[handleStopTimerComplete] Completing linked task");
          try {
            await apiFetch(`/tasks/${activeTimer.taskId}/complete`, {
              method: "POST",
              json: {
                completed: true,
                notes: comments || undefined,
              },
            });
          } catch (taskErr) {
            console.error("Failed to complete task:", taskErr);
            // Don't fail the whole operation if task completion fails
          }
        }
        
        setActiveTimer(null);
        setElapsed("");
        setShowCompletionDialog(false);
        if (onTimerChange) await onTimerChange();
        
        // Show success message with hours logged
        const logged = Number((response as any).hours);
        if (!isNaN(logged)) {
          alert(`Process marked complete. Logged ${logged.toFixed(2)} hours.`);
        } else {
          alert(`Process marked complete.`);
        }
      }
    } catch (e: any) {
      console.error("[handleStopTimerComplete] Error:", e);
      const errorDetails = e?.details || e?.body || e?.message || "Unknown error";
      const errorMsg = typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails);
      alert("Failed to stop timer: " + errorMsg);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleStopTimerSkip() {
    if (!activeTimer) return;
    
    setLoading(true);
    try {
      const response = await apiFetch<{ ok: boolean; timeEntry: any; hours: number | string }>("/workshop/timer/stop", {
        method: "POST",
      });
      
      if (response.ok) {
        // Complete task if timer was linked to a task (even if skipping process completion)
        if (activeTimer.taskId) {
          console.log("[handleStopTimerSkip] Completing linked task");
          try {
            await apiFetch(`/tasks/${activeTimer.taskId}/complete`, {
              method: "POST",
              json: {
                completed: true,
              },
            });
          } catch (taskErr) {
            console.error("Failed to complete task:", taskErr);
            // Don't fail the whole operation if task completion fails
          }
        }
        
        setActiveTimer(null);
        setElapsed("");
        setShowCompletionDialog(false);
        if (onTimerChange) onTimerChange();
        
        // Show success message with hours logged
        const logged = Number((response as any).hours);
        if (!isNaN(logged)) {
          const hours = Math.floor(logged);
          const minutes = Math.round((logged - hours) * 60);
          const display = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          alert(`Timer stopped. Logged ${display} (${logged.toFixed(2)} hours).`);
        } else if (activeTimer?.startedAt) {
          // Fallback: compute locally if API sent a non-number (e.g., Decimal serialized as string)
          const diffHrs = (Date.now() - new Date(activeTimer.startedAt).getTime()) / (1000 * 60 * 60);
          const hours = Math.floor(diffHrs);
          const minutes = Math.round((diffHrs - hours) * 60);
          const display = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          alert(`Timer stopped. Logged ${display} (${diffHrs.toFixed(2)} hours).`);
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
            {activeTimer.taskId && activeTimer.task && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-700">Linked Task:</span>
                  <span className="text-xs text-blue-600">{activeTimer.task.taskType}</span>
                </div>
                <div className="text-sm font-medium mt-1">{activeTimer.task.title}</div>
                {activeTimer.task.dueAt && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Due: {new Date(activeTimer.task.dueAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}
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
                {allowedProcesses.find((p) => p.code === activeTimer.process)?.name ||
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
              onClick={() => {
                console.log("[Button] Stop & Log Time clicked");
                stopTimer();
              }}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop & Log Time
            </Button>
            <Button
              onClick={() => {
                console.log("[Button] Swap clicked");
                setShowSwap(true);
              }}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              Swap
            </Button>
            <Button
              onClick={() => {
                console.log("[Button] Cancel clicked");
                cancelTimer();
              }}
              disabled={loading}
              variant="outline"
              size="lg"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {showSwap && (() => {
            const swapIsGeneric = allowedProcesses.find(p => p.code === process)?.isGeneric || false;
            const filteredProjects = projects.filter((p) =>
              projectSearch
                ? p.title.toLowerCase().includes(projectSearch.toLowerCase())
                : true
            );
            
            return (
              <div className="pt-4 border-t mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Swap Timer</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowSwap(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {!swapIsGeneric && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Project</label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Search or select project..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="sticky top-0 bg-white z-10 p-2 border-b">
                          <Input
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                            placeholder="Type to search projects..."
                            className="h-9"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {filteredProjects.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground">No projects found</div>
                          ) : (
                            filteredProjects.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-base py-3">
                                {p.title}
                              </SelectItem>
                            ))
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1 block">Process</label>
                  <Select value={process} onValueChange={(v) => { setProcess(v); }}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select process" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedProcesses.map((p) => (
                        <SelectItem key={p.code} value={p.code} className="text-base py-3">
                          {p.name} {p.isGeneric && "⭐"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                  onClick={() => {
                    console.log("[Button] Swap & Start New Timer clicked", {
                      process,
                      projectId,
                      swapIsGeneric,
                      loading,
                      disabled: !process || (!swapIsGeneric && !projectId) || loading
                    });
                    swapTimer();
                  }}
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
        
        {/* Completion dialog for active timer */}
        {showCompletionDialog && (
          <ProcessCompletionDialog
            processName={activeTimerProcess?.name || formatProcess(activeTimer.process)}
            onComplete={completionMode === "stop" ? handleStopTimerComplete : handleSwapTimerComplete}
            onSkip={completionMode === "stop" ? handleStopTimerSkip : handleSwapTimerSkip}
            isLastProcess={isLastProcess}
          />
        )}
      </Card>
    );
  }

  // Start timer UI
  if (showStart) {
    const filteredProjects = projects.filter((p) =>
      projectSearch
        ? p.title.toLowerCase().includes(projectSearch.toLowerCase())
        : true
    );

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

          {/* Tasks due today section */}
          {loadingTasks && (
            <div className="text-sm text-muted-foreground">Loading tasks...</div>
          )}
          
          {!loadingTasks && overdueTasks.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium text-red-700">⚠️ Overdue Tasks</div>
              {overdueTasks.map(task => (
                <div key={task.id} className="bg-white rounded p-2 space-y-1">
                  <div className="text-sm font-medium">{task.title}</div>
                  {task.dueAt && (
                    <div className="text-xs text-red-600">
                      Due: {new Date(task.dueAt).toLocaleDateString()}
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Process</div>
                    <Select
                      value={String((task.meta as any)?.processCode || "__NONE__")}
                      onValueChange={(v) => updateTaskProcessCode(task, v === "__NONE__" ? null : v)}
                      disabled={savingTaskId === task.id || loading}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select process..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">No process</SelectItem>
                        {allowedProcesses.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full mt-1"
                    onClick={() => startFromTask(task)}
                  >
                    Start Timer for This Task
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {!loadingTasks && dueTodayTasks.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium text-blue-700">📅 Due Today</div>
              {dueTodayTasks.map(task => (
                <div key={task.id} className="bg-white rounded p-2 space-y-1">
                  <div className="text-sm font-medium">{task.title}</div>
                  {task.dueAt && (
                    <div className="text-xs text-muted-foreground">
                      Due: {new Date(task.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Process</div>
                    <Select
                      value={String((task.meta as any)?.processCode || "__NONE__")}
                      onValueChange={(v) => updateTaskProcessCode(task, v === "__NONE__" ? null : v)}
                      disabled={savingTaskId === task.id || loading}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select process..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">No process</SelectItem>
                        {allowedProcesses.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full mt-1"
                    onClick={() => startFromTask(task)}
                  >
                    Start Timer for This Task
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <div className="space-y-3">
            {!isGenericProcess && (
              <div>
                <label className="text-sm font-medium mb-1 block">Project</label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Search or select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 bg-white z-10 p-2 border-b">
                      <Input
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder="Type to search projects..."
                        className="h-9"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {filteredProjects.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">No projects found</div>
                      ) : (
                        filteredProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-base py-3">
                            {p.title}
                          </SelectItem>
                        ))
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Process</label>
              <Select value={process} onValueChange={(v) => { setProcess(v); }}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select process" />
                </SelectTrigger>
                <SelectContent>
                  {allowedProcesses.map((p) => (
                    <SelectItem key={p.code} value={p.code} className="text-base py-3">
                      {p.name} {p.isGeneric && "⭐"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
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
  const idleState = (
    <Button
      onClick={() => setShowStart(true)}
      className="w-full bg-blue-600 hover:bg-blue-700"
      size="lg"
    >
      <Play className="w-4 h-4 mr-2" />
      Start Timer
    </Button>
  );
  
  // Render completion dialog if showing
  const completionDialog = showCompletionDialog && activeTimer ? (
    <ProcessCompletionDialog
      processName={activeTimerProcess?.name || formatProcess((activeTimer as Timer).process)}
      onComplete={completionMode === "stop" ? handleStopTimerComplete : handleSwapTimerComplete}
      onSkip={completionMode === "stop" ? handleStopTimerSkip : handleSwapTimerSkip}
      isLastProcess={isLastProcess}
    />
  ) : null;
  
  return (
    <>
      {idleState}
      {completionDialog}
    </>
  );
});

WorkshopTimer.displayName = "WorkshopTimer";

export default WorkshopTimer;
