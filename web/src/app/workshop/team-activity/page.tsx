"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Clock, User, CheckCircle2, Circle } from "lucide-react";

type TimeEntry = {
  id: string;
  process: string;
  hours: number;
  notes: string | null;
  project: { id: string; title: string } | null;
};

type UserActivity = {
  user: { id: string; name: string; email: string; workshopColor: string | null };
  days: Record<string, TimeEntry[]>;
};

export default function TeamActivityPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [from, setFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6); // Last 7 days
    return d;
  });
  const [to, setTo] = useState<Date>(new Date());

  useEffect(() => {
    loadActivity();
  }, [from, to]);

  async function loadActivity() {
    setLoading(true);
    try {
      const fromStr = from.toISOString().split("T")[0];
      const toStr = to.toISOString().split("T")[0];
      const res = await apiFetch<{ users: UserActivity[] }>(
        `/workshop/team-activity?from=${fromStr}&to=${toStr}`
      );
      setUsers(res.users || []);
    } catch (e) {
      console.error("Failed to load team activity:", e);
    } finally {
      setLoading(false);
    }
  }

  function shiftWeek(direction: number) {
    const days = 7 * direction;
    setFrom((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
    setTo((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
  }

  function goToToday() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    setFrom(weekStart);
    setTo(today);
  }

  // Generate list of dates in range
  const dateRange: Date[] = [];
  const current = new Date(from);
  while (current <= to) {
    dateRange.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const formatDate = (d: Date) => {
    const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
    return d.toLocaleDateString("en-GB", options);
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const getTotalHoursForDay = (entries: TimeEntry[]) => {
    return entries.reduce((sum, e) => sum + e.hours, 0);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading team activity...</div>
      </div>
    );
  }

  const selectedUser = selectedUserId ? users.find(u => u.user.id === selectedUserId) : null;

  // Check if user is logged in today
  const isLoggedInToday = (ua: UserActivity) => {
    const today = new Date().toISOString().split("T")[0];
    return ua.days[today] && ua.days[today].length > 0;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Activity</h1>
          <p className="text-muted-foreground">View daily logged work for all team members</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        {formatDate(from)} – {formatDate(to)}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* User list sidebar */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Team Members</CardTitle>
            <CardDescription>Click to view activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <Button
              variant={selectedUserId === null ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedUserId(null)}
            >
              <User className="h-4 w-4 mr-2" />
              All Users
            </Button>
            {users.map((ua) => {
              const isActive = isLoggedInToday(ua);
              const totalHours = Object.values(ua.days).reduce(
                (sum, entries) => sum + getTotalHoursForDay(entries),
                0
              );

              return (
                <Button
                  key={ua.user.id}
                  variant={selectedUserId === ua.user.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedUserId(ua.user.id)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: ua.user.workshopColor || "#6b7280" }}
                    />
                    <span className="truncate flex-1 text-left">{ua.user.name || ua.user.email}</span>
                    {isActive ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Activity detail view */}
        <div className="col-span-9 space-y-4">
          {selectedUser ? (
            // Single user view
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedUser.user.workshopColor || "#6b7280" }}
                    />
                    <div>
                      <CardTitle className="text-lg">{selectedUser.user.name || selectedUser.user.email}</CardTitle>
                      <CardDescription>{selectedUser.user.email}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    <Clock className="h-3 w-3 mr-1" />
                    {Object.values(selectedUser.days).reduce((sum, entries) => sum + getTotalHoursForDay(entries), 0).toFixed(1)}h total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dateRange.map((date) => {
                    const dateKey = date.toISOString().split("T")[0];
                    const entries = selectedUser.days[dateKey] || [];
                    const dayHours = getTotalHoursForDay(entries);

                    if (entries.length === 0) return null;

                    return (
                      <div
                        key={dateKey}
                        className={`border rounded-lg p-3 ${
                          isToday(date) ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm">{formatDate(date)}</div>
                          <Badge variant="outline" className="text-xs">
                            {dayHours.toFixed(1)}h
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-start gap-2 text-sm bg-background/50 rounded p-2"
                            >
                              <div className="flex-1">
                                <div className="font-medium">
                                  {entry.project ? (
                                    <span className="text-primary">{entry.project.title}</span>
                                  ) : (
                                    <span className="text-muted-foreground capitalize">
                                      {entry.process.toLowerCase().replace(/_/g, " ")}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {entry.process.replace(/_/g, " ")}
                                  {entry.notes && ` • ${entry.notes}`}
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {entry.hours}h
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {dateRange.every((d) => !selectedUser.days[d.toISOString().split("T")[0]]) && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No logged time in this period
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            // All users view
            users.map((ua) => {
              const totalHours = Object.values(ua.days).reduce(
                (sum, entries) => sum + getTotalHoursForDay(entries),
                0
              );

              return (
                <Card key={ua.user.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: ua.user.workshopColor || "#6b7280" }}
                        />
                        <div>
                          <CardTitle className="text-lg">{ua.user.name || ua.user.email}</CardTitle>
                          <CardDescription>{ua.user.email}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        <Clock className="h-3 w-3 mr-1" />
                        {totalHours.toFixed(1)}h total
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dateRange.map((date) => {
                        const dateKey = date.toISOString().split("T")[0];
                        const entries = ua.days[dateKey] || [];
                        const dayHours = getTotalHoursForDay(entries);

                        if (entries.length === 0) return null;

                        return (
                          <div
                            key={dateKey}
                            className={`border rounded-lg p-3 ${
                              isToday(date) ? "border-primary bg-primary/5" : "border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium text-sm">{formatDate(date)}</div>
                              <Badge variant="outline" className="text-xs">
                                {dayHours.toFixed(1)}h
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {entries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="flex items-start gap-2 text-sm bg-background/50 rounded p-2"
                                >
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {entry.project ? (
                                        <span className="text-primary">{entry.project.title}</span>
                                      ) : (
                                        <span className="text-muted-foreground capitalize">
                                          {entry.process.toLowerCase().replace(/_/g, " ")}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {entry.process.replace(/_/g, " ")}
                                      {entry.notes && ` • ${entry.notes}`}
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {entry.hours}h
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {dateRange.every((d) => !ua.days[d.toISOString().split("T")[0]]) && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No logged time in this period
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
