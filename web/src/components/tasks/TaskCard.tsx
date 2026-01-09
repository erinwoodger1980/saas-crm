"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormRenderer } from "./FormRenderer";
import { 
  CheckSquare, 
  FileText, 
  Phone, 
  Calendar, 
  Edit2, 
  ChevronDown, 
  ChevronUp,
  Clock,
  AlertCircle
} from "lucide-react";

type TaskType = "MANUAL" | "COMMUNICATION" | "FOLLOW_UP" | "SCHEDULED" | "FORM" | "CHECKLIST";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  taskType: TaskType;
  dueAt?: string | null;
  status: string;
  priority: string;
  formSchema?: { fields?: any[] } | null;
  formSubmissions?: any[] | null;
  checklistItems?: Array<{ id: string; label: string; completed?: boolean }>;
  meta?: any;
};

interface TaskCardProps {
  task: Task;
  onComplete?: () => void;
  onEdit?: () => void;
  onChecklistToggle?: (itemId: string) => void;
  compact?: boolean;
}

const taskTypeIcons: Record<TaskType, any> = {
  MANUAL: FileText,
  FORM: FileText,
  COMMUNICATION: Phone,
  FOLLOW_UP: Calendar,
  SCHEDULED: Clock,
  CHECKLIST: CheckSquare,
};

const taskTypeColors: Record<TaskType, string> = {
  MANUAL: "bg-blue-50 border-blue-200 text-blue-700",
  FORM: "bg-purple-50 border-purple-200 text-purple-700",
  COMMUNICATION: "bg-green-50 border-green-200 text-green-700",
  FOLLOW_UP: "bg-orange-50 border-orange-200 text-orange-700",
  SCHEDULED: "bg-indigo-50 border-indigo-200 text-indigo-700",
  CHECKLIST: "bg-pink-50 border-pink-200 text-pink-700",
};

export function TaskCard({ task, onComplete, onEdit, onChecklistToggle, compact = false }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(!!task.formSubmissions?.length);
  
  const Icon = taskTypeIcons[task.taskType];
  const colorClass = taskTypeColors[task.taskType];
  
  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "DONE";
  const isDueToday = task.dueAt && new Date(task.dueAt).toDateString() === new Date().toDateString();

  // For FORM tasks, show form inline in compact view
  if (task.taskType === "FORM" && !isExpanded && task.formSchema?.fields) {
    return (
      <Card className={`${colorClass} border-2 p-4`}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{task.title}</h3>
                {isOverdue && (
                  <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    Overdue
                  </div>
                )}
                {!isOverdue && isDueToday && (
                  <div className="text-xs text-orange-600 mt-1">Due today</div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="flex-shrink-0"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Form inline */}
          {!formSubmitted ? (
            <div className="pt-2 border-t">
              <FormRenderer
                taskId={task.id}
                formSchema={task.formSchema}
                requiresSignature={task.meta?.requiresSignature || false}
                onSubmitted={() => {
                  setFormSubmitted(true);
                  onComplete?.();
                }}
              />
            </div>
          ) : (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-green-600">
                <CheckSquare className="w-5 h-5" />
                <span className="text-sm font-medium">Form submitted</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(true)}
                className="mt-2 w-full"
              >
                View Details
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // For CHECKLIST tasks, show checklist inline
  if (task.taskType === "CHECKLIST" && !isExpanded && task.checklistItems) {
    const completedCount = task.checklistItems.filter(item => item.completed).length;
    const totalCount = task.checklistItems.length;
    const allCompleted = completedCount === totalCount;

    return (
      <Card className={`${colorClass} border-2 p-4`}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{task.title}</h3>
                <div className="text-xs mt-1">
                  {completedCount} of {totalCount} completed
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="flex-shrink-0"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Checklist items */}
          <div className="space-y-2 pt-2 border-t">
            {task.checklistItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-white/50 cursor-pointer touch-manipulation"
              >
                <input
                  type="checkbox"
                  checked={item.completed || false}
                  onChange={() => onChecklistToggle?.(item.id)}
                  className="w-5 h-5 rounded border-2 flex-shrink-0"
                />
                <span className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>

          {allCompleted && (
            <Button
              onClick={onComplete}
              className="w-full mt-2"
              size="lg"
            >
              Complete Task
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Compact view for other task types
  if (compact && !isExpanded) {
    return (
      <Card className={`${colorClass} border-2 p-4`}>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-shrink-0"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {isOverdue && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="w-3 h-3" />
              Overdue: {new Date(task.dueAt!).toLocaleDateString()}
            </div>
          )}

          {!isOverdue && task.dueAt && (
            <div className="text-xs text-muted-foreground">
              Due: {new Date(task.dueAt).toLocaleDateString()}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={onComplete}
              className="flex-1"
              size="lg"
            >
              Complete
            </Button>
            <Button
              variant="outline"
              onClick={onEdit}
              size="lg"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Expanded view with all details
  return (
    <Card className={`${colorClass} border-2 p-4`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Icon className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg">{task.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="px-2 py-0.5 bg-white/50 rounded">{task.taskType}</span>
                <span className="px-2 py-0.5 bg-white/50 rounded">{task.priority}</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
        </div>

        {/* Description */}
        {task.description && (
          <div className="pt-2 border-t">
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {/* Due date */}
        {task.dueAt && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />
            <span>Due: {new Date(task.dueAt).toLocaleString()}</span>
            {isOverdue && (
              <span className="text-red-600 font-medium">(Overdue)</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            onClick={onComplete}
            className="flex-1"
            size="lg"
          >
            Complete Task
          </Button>
          <Button
            variant="outline"
            onClick={onEdit}
            size="lg"
          >
            Edit Details
          </Button>
        </div>
      </div>
    </Card>
  );
}
