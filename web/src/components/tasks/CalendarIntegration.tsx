// web/src/components/tasks/CalendarIntegration.tsx
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar,
  Link2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  Settings,
  Trash2,
} from "lucide-react";

type CalendarConnection = {
  id: string;
  provider: "google" | "outlook" | "ical";
  accountName: string;
  calendarName: string;
  syncEnabled: boolean;
  lastSyncAt?: string;
  syncStatus: "connected" | "error" | "syncing";
  syncDirection: "both" | "to-calendar" | "from-calendar";
  taskTypesFilter?: string[];
  createdAt: string;
};

const CALENDAR_PROVIDERS = [
  {
    id: "google",
    name: "Google Calendar",
    description: "Sync with Google Calendar",
    icon: "📅",
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    description: "Sync with Outlook Calendar",
    icon: "📆",
  },
  {
    id: "ical",
    name: "iCal/CalDAV",
    description: "Sync with Apple Calendar or CalDAV",
    icon: "🗓️",
  },
];

const TASK_TYPES = [
  "GENERAL",
  "FOLLOW_UP",
  "MEETING",
  "PHONE_CALL",
  "EMAIL",
  "FORM",
  "COMMUNICATION",
];

export function CalendarIntegration() {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";

  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  // Add connection form state
  const [accountName, setAccountName] = useState("");
  const [calendarName, setCalendarName] = useState("");
  const [syncDirection, setSyncDirection] = useState<"both" | "to-calendar" | "from-calendar">(
    "to-calendar"
  );
  const [selectedTaskTypes, setSelectedTaskTypes] = useState<string[]>([]);
  const [iCalUrl, setICalUrl] = useState("");

  useEffect(() => {
    loadConnections();
  }, [tenantId]);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/tasks/calendar-connections", {
        headers: { "x-tenant-id": tenantId },
      });
      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error("Failed to load calendar connections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddConnection = async () => {
    try {
      let authUrl = "";

      if (selectedProvider === "google") {
        // Initiate Google OAuth flow
        const response = await apiFetch("/tasks/calendar-connections/google/auth-url", {
          headers: { "x-tenant-id": tenantId },
        });
        const data = await response.json();
        authUrl = data.url;
      } else if (selectedProvider === "outlook") {
        // Initiate Microsoft OAuth flow
        const response = await apiFetch("/tasks/calendar-connections/outlook/auth-url", {
          headers: { "x-tenant-id": tenantId },
        });
        const data = await response.json();
        authUrl = data.url;
      } else if (selectedProvider === "ical") {
        // Add iCal connection directly
        await apiFetch("/tasks/calendar-connections", {
          method: "POST",
          headers: {
            "x-tenant-id": tenantId,
            "Content-Type": "application/json",
          },
          json: {
            provider: "ical",
            accountName,
            calendarName,
            syncDirection,
            taskTypesFilter: selectedTaskTypes,
            iCalUrl,
          },
        });

        setShowAddDialog(false);
        loadConnections();
        return;
      }

      if (authUrl) {
        // Open OAuth popup
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        window.open(
          authUrl,
          "calendar-auth",
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Listen for OAuth completion
        window.addEventListener("message", (event) => {
          if (event.data.type === "calendar-auth-success") {
            setShowAddDialog(false);
            loadConnections();
          }
        });
      }
    } catch (error) {
      console.error("Failed to add calendar connection:", error);
      alert("Failed to connect calendar");
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncing((prev) => ({ ...prev, [connectionId]: true }));
    try {
      await apiFetch(`/tasks/calendar-connections/${connectionId}/sync`, {
        method: "POST",
        headers: { "x-tenant-id": tenantId },
      });

      // Success notification
      const toast = document.createElement("div");
      toast.textContent = "✓ Calendar sync completed";
      toast.className =
        "fixed bottom-6 right-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);

      loadConnections();
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Calendar sync failed");
    } finally {
      setSyncing((prev) => ({ ...prev, [connectionId]: false }));
    }
  };

  const handleToggleSync = async (connectionId: string, enabled: boolean) => {
    try {
      await apiFetch(`/tasks/calendar-connections/${connectionId}`, {
        method: "PATCH",
        headers: {
          "x-tenant-id": tenantId,
          "Content-Type": "application/json",
        },
        json: { syncEnabled: enabled },
      });
      loadConnections();
    } catch (error) {
      console.error("Failed to toggle sync:", error);
      alert("Failed to update sync settings");
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm("Are you sure you want to disconnect this calendar?")) return;

    try {
      await apiFetch(`/tasks/calendar-connections/${connectionId}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      loadConnections();
    } catch (error) {
      console.error("Failed to delete connection:", error);
      alert("Failed to disconnect calendar");
    }
  };

  const handleExportICal = async () => {
    try {
      const response = await apiFetch("/tasks/calendar-export/ical", {
        headers: { "x-tenant-id": tenantId },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks-${new Date().toISOString().split("T")[0]}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export calendar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading calendar connections...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Calendar Integration</h2>
          <p className="text-sm text-muted-foreground">
            Sync tasks with external calendar systems
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Calendar events include deep links back to tasks, leads, and workshop processes
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportICal} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export iCal
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Connect Calendar
          </Button>
        </div>
      </div>

      {/* Connections List */}
      {connections.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No calendar connections</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your calendar to sync tasks automatically
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Connect Your First Calendar
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((connection) => (
            <Card key={connection.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">
                      {CALENDAR_PROVIDERS.find((p) => p.id === connection.provider)?.icon}
                    </span>
                    <div>
                      <h3 className="font-semibold">{connection.accountName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {connection.calendarName}
                      </p>
                    </div>
                    <Badge
                      variant={
                        connection.syncStatus === "connected"
                          ? "default"
                          : connection.syncStatus === "error"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {connection.syncStatus === "connected" && (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      {connection.syncStatus === "error" && (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {connection.syncStatus === "syncing" && (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      )}
                      {connection.syncStatus}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline">
                      {connection.syncDirection === "both"
                        ? "Two-way sync"
                        : connection.syncDirection === "to-calendar"
                        ? "To calendar only"
                        : "From calendar only"}
                    </Badge>
                    {connection.taskTypesFilter && connection.taskTypesFilter.length > 0 && (
                      <Badge variant="secondary">
                        {connection.taskTypesFilter.length} task types
                      </Badge>
                    )}
                    {connection.lastSyncAt && (
                      <span className="text-xs text-muted-foreground">
                        Last synced: {new Date(connection.lastSyncAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`sync-${connection.id}`} className="text-sm">
                      Auto-sync
                    </Label>
                    <Switch
                      id={`sync-${connection.id}`}
                      checked={connection.syncEnabled}
                      onCheckedChange={(checked) =>
                        handleToggleSync(connection.id, checked)
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSync(connection.id)}
                    disabled={syncing[connection.id]}
                  >
                    {syncing[connection.id] ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteConnection(connection.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Connection Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect Calendar</DialogTitle>
            <DialogDescription>
              Choose a calendar provider to sync your tasks
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Calendar Provider</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {CALENDAR_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`p-4 border-2 rounded-lg text-center transition-all hover:border-primary ${
                      selectedProvider === provider.id
                        ? "border-primary bg-primary/5"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="text-3xl mb-2">{provider.icon}</div>
                    <div className="font-medium text-sm">{provider.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedProvider === "ical" && (
              <>
                <div>
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="My Calendar"
                  />
                </div>
                <div>
                  <Label htmlFor="iCalUrl">iCal URL</Label>
                  <Input
                    id="iCalUrl"
                    value={iCalUrl}
                    onChange={(e) => setICalUrl(e.target.value)}
                    placeholder="https://calendar.example.com/ical"
                  />
                </div>
              </>
            )}

            {selectedProvider && (
              <>
                <div>
                  <Label>Sync Direction</Label>
                  <Select value={syncDirection} onValueChange={setSyncDirection as any}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to-calendar">
                        <div className="flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Tasks → Calendar only
                        </div>
                      </SelectItem>
                      <SelectItem value="from-calendar">
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Calendar → Tasks only
                        </div>
                      </SelectItem>
                      <SelectItem value="both">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Two-way sync
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Task Types to Sync</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {TASK_TYPES.map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTaskTypes.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTaskTypes([...selectedTaskTypes, type]);
                            } else {
                              setSelectedTaskTypes(
                                selectedTaskTypes.filter((t) => t !== type)
                              );
                            }
                          }}
                          className="rounded"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddConnection}
              disabled={!selectedProvider}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
