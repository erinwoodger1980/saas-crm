"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/use-current-user";
import OnboardingWizard from "@/components/OnboardingWizard";
import { CheckCircle2, Clock, Target, TrendingUp, Sparkles, Coffee, Heart } from "lucide-react";

interface SearchResult {
  id: string;
  type: 'lead' | 'opportunity' | 'task' | 'setting' | 'navigation';
  title: string;
  subtitle?: string;
  description?: string;
  action: {
    type: 'navigate' | 'modal' | 'function';
    target: string;
    params?: Record<string, any>;
  };
  score?: number;
}

interface SearchResponse {
  results: SearchResult[];
  directAnswer?: string;
  suggestedAction?: {
    label: string;
    action: SearchResult['action'];
  };
}

interface AssistantInsight {
  type: "celebration" | "encouragement" | "reminder" | "achievement" | "ritual";
  message: string;
  icon: any;
  color: string;
}

interface TaskStats {
  late: number;
  dueToday: number;
  completed: number;
  total: number;
}

export default function AISearchBar() {
  const { user } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskData, setTaskData] = useState<any>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardType, setWizardType] = useState<'onboarding' | 'import-data' | 'workshop-setup' | 'automation-setup'>('onboarding');
  const [insight, setInsight] = useState<AssistantInsight | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats>({ late: 0, dueToday: 0, completed: 0, total: 0 });
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Ensure component is mounted before enabling functionality
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load AI assistant insights when component mounts
  useEffect(() => {
    if (!isMounted) return;
    
    loadAIInsights();
    const interval = setInterval(loadAIInsights, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [isMounted]);

  async function loadAIInsights() {
    try {
      // Fetch task statistics
      const tasksData = await apiFetch<any>("/tasks/stats");
      if (tasksData) {
        setTaskStats({
          late: tasksData.late || 0,
          dueToday: tasksData.dueToday || 0,
          completed: tasksData.completedToday || 0,
          total: tasksData.total || 0,
        });
      }

      // Generate AI-powered insight
      const insightData = await apiFetch<AssistantInsight>("/ai/assistant-insight");
      if (insightData) {
        setInsight(insightData);
      }
    } catch (error) {
      console.error("Failed to load AI insights:", error);
    }
  }

  const getDefaultInsight = (): AssistantInsight => {
    const hour = new Date().getHours();
    const firstName = user?.firstName || "there";
    
    // Monday morning check-in
    if (new Date().getDay() === 1 && hour < 12) {
      return {
        type: "ritual",
        message: `Monday Morning Check-in, ${firstName}. Let's plan a great week.`,
        icon: Coffee,
        color: "from-amber-500 to-orange-500",
      };
    }

    // Friday wrap
    if (new Date().getDay() === 5 && hour > 15) {
      return {
        type: "celebration",
        message: `Friday Wrap, ${firstName}. You've moved your business forward this week! 🎉`,
        icon: Heart,
        color: "from-pink-500 to-rose-500",
      };
    }

    // Late tasks warning
    if (taskStats.late > 0) {
      return {
        type: "reminder",
        message: `${taskStats.late} ${taskStats.late === 1 ? 'task needs' : 'tasks need'} attention. You've got this!`,
        icon: Clock,
        color: "from-orange-500 to-red-500",
      };
    }

    // Celebrations for completed tasks
    if (taskStats.completed > 0) {
      return {
        type: "achievement",
        message: `${taskStats.completed} ${taskStats.completed === 1 ? 'task' : 'tasks'} completed today! You're on fire! 🔥`,
        icon: TrendingUp,
        color: "from-emerald-500 to-teal-500",
      };
    }

    // Today's agenda
    if (taskStats.dueToday > 0) {
      return {
        type: "encouragement",
        message: `${taskStats.dueToday} ${taskStats.dueToday === 1 ? 'task' : 'tasks'} on your plate today. Let's make it happen!`,
        icon: Target,
        color: "from-blue-500 to-indigo-500",
      };
    }

    // Default message based on actual stats
    if (taskStats.total > 0) {
      return {
        type: "encouragement",
        message: `${taskStats.total} ${taskStats.total === 1 ? 'active task' : 'active tasks'}. You're organized.`,
        icon: CheckCircle2,
        color: "from-emerald-500 to-teal-500",
      };
    }

    return {
      type: "encouragement",
      message: "All caught up. Ready for what's next.",
      icon: Sparkles,
      color: "from-blue-500 to-cyan-500",
    };
  };

  // Click outside to close
  useEffect(() => {
    if (!isMounted) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isMounted]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isMounted) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      
      // Escape to close
      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMounted]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!isMounted || !searchQuery.trim()) {
      setResults(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<SearchResponse>('/ai/search', {
        method: 'POST',
        json: { query: searchQuery }
      });
      
      setResults(response);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [isMounted]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isMounted) return;
    
    const value = e.target.value;
    setQuery(value);
  };

  // Debounced search effect
  useEffect(() => {
    if (!isMounted || !query.trim()) {
      setResults(null);
      return;
    }
    const timeoutId = setTimeout(() => { handleSearch(query); }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, isMounted, handleSearch]);

  const executeAction = async (action: SearchResult['action'], result?: SearchResult) => {
    if (!isMounted) return;
    
    setIsOpen(false);
    setQuery("");
    setResults(null);

    try {
      switch (action.type) {
        case 'navigate':
          router.push(action.target);
          break;
          
        case 'modal':
          // Check if this is a wizard modal
          if (action.params && action.params.wizard) {
            setWizardType(action.params.wizard as any);
            setShowWizard(true);
          }
          // Check if this is a task creation modal
          else if (action.params && action.params.action === 'create' && action.target === '/tasks/center') {
            setTaskData(action.params);
            setShowTaskModal(true);
          } else if (action.params) {
            // For other modal actions, navigate to the page with URL params
            const url = new URL(action.target, window.location.origin);
            Object.entries(action.params).forEach(([key, value]) => {
              url.searchParams.set(key, String(value));
            });
            router.push(url.pathname + url.search);
          } else {
            router.push(action.target);
          }
          break;
          
        case 'function':
          // For function actions like settings changes
          await apiFetch(action.target, {
            method: 'POST',
            json: action.params || {}
          });
          
          // Show success message or navigate to relevant page
          if (result?.description?.includes('year end')) {
            router.push('/dashboard?tab=settings&section=financial');
          }
          break;
          
        default:
          console.warn('Unknown action type:', action.type);
      }
    } catch (err: any) {
      console.error('Action execution error:', err);
      setError(err.message || 'Action failed');
      
      // Show error briefly then clear it
      setTimeout(() => setError(null), 3000);
    }
  };

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'lead':
        return '👤';
      case 'opportunity':
        return '💰';
      case 'task':
        return '✓';
      case 'setting':
        return '⚙️';
      case 'navigation':
        return '🧭';
      default:
        return '🔍';
    }
  };

  const getResultTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'lead':
        return 'Lead';
      case 'opportunity':
        return 'Opportunity';
      case 'task':
        return 'Task';
      case 'setting':
        return 'Setting';
      case 'navigation':
        return 'Navigate';
      default:
        return 'Result';
    }
  };

  return (
    <div className="relative flex-1 max-w-2xl" ref={searchRef}>
      {/* Search Input with AI Assistant Pill */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => isMounted && setIsOpen(true)}
            placeholder={isMounted ? "Search anything or ask Joinery AI... (⌘K)" : "Search..."}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full bg-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!isMounted}
          />
          {isLoading && isMounted && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          )}
        </div>

        {/* AI Assistant Live Indicator Pill */}
        {isMounted && (insight || taskStats.total > 0) && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r ${(insight || getDefaultInsight()).color} text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer`}
            title="Click to see your AI assistant insights"
          >
            <div className="relative">
              {(() => {
                const Icon = (insight || getDefaultInsight()).icon;
                return <Icon className="h-4 w-4" />;
              })()}
              {taskStats.late > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
              )}
            </div>
            <span className="text-xs font-semibold whitespace-nowrap">
              {taskStats.late > 0 ? `${taskStats.late} Late` : 
               taskStats.completed > 0 ? `${taskStats.completed} Done` : 
               taskStats.dueToday > 0 ? `${taskStats.dueToday} Today` : 
               'AI Assistant'}
            </span>
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isMounted && isOpen && (query.trim() || results || error) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {error && (
            <div className="p-4 text-red-600 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
          )}

          {results?.directAnswer && (
            <div className="p-4 bg-blue-50 border-b border-gray-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  AI
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{results.directAnswer}</p>
                  {results.suggestedAction && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => executeAction(results.suggestedAction!.action)}
                    >
                      {results.suggestedAction.label}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {results?.results && results.results.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">
                Search Results ({results.results.length})
              </div>
              {results.results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  onClick={() => executeAction(result.action, result)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 focus:outline-none focus:bg-gray-50 text-left transition-colors"
                >
                  <div className="flex-shrink-0 text-lg">
                    {getResultIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{result.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {getResultTypeLabel(result.type)}
                      </span>
                    </div>
                    {result.subtitle && (
                      <p className="text-sm text-gray-600 truncate mt-0.5">{result.subtitle}</p>
                    )}
                    {result.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{result.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && query.trim() && (!results?.results || results.results.length === 0) && !error && (
            <div className="p-4 text-center text-gray-500 text-sm">
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>No results found for "{query}"</p>
                <p className="text-xs">Try searching for leads, opportunities, or asking a question.</p>
              </div>
            </div>
          )}

          {!query.trim() && (
            <div className="p-4">
              {/* AI Assistant Insight */}
              {insight || taskStats.total > 0 ? (
                <div className="space-y-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${(insight || getDefaultInsight()).color} flex items-center justify-center shadow-lg`}>
                      {(() => {
                        const Icon = (insight || getDefaultInsight()).icon;
                        return <Icon className="h-4 w-4 text-white" />;
                      })()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-900">Your AI Assistant</h4>
                      <p className="text-xs text-gray-500">Real-time insights from your workspace</p>
                    </div>
                  </div>
                  
                  <div className={`rounded-xl bg-gradient-to-br ${(insight || getDefaultInsight()).color} p-3 text-white shadow-lg`}>
                    <p className="text-sm font-medium leading-relaxed">{(insight || getDefaultInsight()).message}</p>
                  </div>

                  {/* Task Statistics */}
                  <div className="grid grid-cols-2 gap-2">
                    {taskStats.late > 0 && (
                      <div className="rounded-lg bg-gradient-to-br from-orange-50 to-red-50 p-3 border border-orange-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3 w-3 text-orange-600" />
                          <span className="text-xs font-semibold text-orange-900 uppercase tracking-wide">Late</span>
                        </div>
                        <p className="text-xl font-bold text-orange-600">{taskStats.late}</p>
                      </div>
                    )}
                    
                    {taskStats.dueToday > 0 && (
                      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-3 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Today</span>
                        </div>
                        <p className="text-xl font-bold text-blue-600">{taskStats.dueToday}</p>
                      </div>
                    )}

                    {taskStats.completed > 0 && (
                      <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 p-3 border border-emerald-200">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">Done</span>
                        </div>
                        <p className="text-xl font-bold text-emerald-600">{taskStats.completed}</p>
                      </div>
                    )}

                    <div className="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 p-3 border border-purple-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-3 w-3 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-900 uppercase tracking-wide">Total</span>
                      </div>
                      <p className="text-xl font-bold text-purple-600">{taskStats.total}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push('/tasks/center');
                    }}
                    className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-2 text-sm shadow-lg hover:shadow-xl transition-all"
                  >
                    View All Tasks
                  </button>
                </div>
              ) : null}

              <div className="text-sm text-gray-500 border-t border-gray-200 pt-4">
                <div className="space-y-2">
                  <p className="font-medium">Try searching for:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• "Erin Woodger" - Find leads or opportunities</li>
                    <li>• "How do I set my year end?" - Get help with settings</li>
                    <li>• "Show me my tasks" - Navigate to your tasks</li>
                    <li>• "What are my sales this month?" - Get analytics</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Creation Modal */}
      {showTaskModal && taskData && (
        <TaskCreationModal
          open={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            setTaskData(null);
          }}
          initialData={taskData}
        />
      )}

      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        wizardType={wizardType}
      />
    </div>
  );
}

// Task Creation Modal Component
function TaskCreationModal({ open, onClose, initialData }: { open: boolean; onClose: () => void; initialData: any }) {
  const [title, setTitle] = useState(initialData.title || "");
  const [description, setDescription] = useState(initialData.description || "");
  const [type, setType] = useState(initialData.type || "MANUAL");
  const [priority, setPriority] = useState(initialData.priority || "MEDIUM");
  const [assignedTo, setAssignedTo] = useState(initialData.assignedToUserId || "");
  const [dueDate, setDueDate] = useState(initialData.dueDate || "");
  const [relatedType, setRelatedType] = useState(initialData.relatedType || "OTHER");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      apiFetch<Array<{ id: string; name: string; email: string }>>('/tenant/users')
        .then((data) => {
          console.log('Loaded users:', data);
          setUsers(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          console.error('Failed to load users:', err);
          setUsers([]);
        });
    }
  }, [open]);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert('Please enter a task title');
      return;
    }

    setSaving(true);
    try {
      const taskData: any = {
        title,
        description: description || undefined,
        taskType: type,
        relatedType,
        priority,
        dueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
        status: 'OPEN'
      };

      // Add assignee if selected
      if (assignedTo) {
        taskData.assignees = [{ userId: assignedTo, role: 'OWNER' }];
      }

      await apiFetch('/tasks', {
        method: 'POST',
        json: taskData
      });

      onClose();
      router.push('/tasks/center');
    } catch (err: any) {
      console.error('Failed to create task:', err);
      alert(err.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h2 className="text-xl font-bold">Create Task</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {initialData.assignedToName && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <strong>AI Suggestion:</strong> Task for {initialData.assignedToName}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Order materials for Wealden project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Optional details..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MANUAL">Manual Task</option>
                <option value="COMMUNICATION">Communication</option>
                <option value="FOLLOW_UP">Follow Up</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="FORM">Form</option>
                <option value="CHECKLIST">Checklist</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Related To</label>
              <select
                value={relatedType}
                onChange={(e) => setRelatedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="OTHER">General</option>
                <option value="LEAD">Lead</option>
                <option value="PROJECT">Project</option>
                <option value="QUOTE">Quote</option>
                <option value="EMAIL">Email</option>
                <option value="QUESTIONNAIRE">Questionnaire</option>
                <option value="WORKSHOP">Workshop</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Assign To</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !title.trim()}
            className="flex-1"
          >
            {saving ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </div>
    </div>
  );
}