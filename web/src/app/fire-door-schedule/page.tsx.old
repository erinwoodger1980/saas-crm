"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface FireDoorProject {
  id: string;
  mjsNumber?: string;
  jobName?: string;
  clientName?: string;
  dateReceived?: string;
  dateRequired?: string;
  poNumber?: string;
  jobLocation?: string;
  signOffStatus?: string;
  scheduledBy?: string;
  orderingStatus?: string;
  overallProgress?: number;
  // ... all other fields
  [key: string]: any;
}

interface Stats {
  totalProjects: number;
  byLocation: {
    redFolder: number;
    inProgress: number;
    complete: number;
  };
  bySignOff: {
    awaitingSignOff: number;
    signedOff: number;
  };
  production: {
    inProduction: number;
  };
}

export default function FireDoorSchedulePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<FireDoorProject[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [jobLocationFilter, setJobLocationFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadData();
  }, [jobLocationFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (jobLocationFilter !== "all") {
        params.append("jobLocation", jobLocationFilter);
      }

      const [projectsData, statsData] = await Promise.all([
        apiFetch<{ projects: FireDoorProject[] }>(`/fire-door-schedule?${params.toString()}`),
        apiFetch<Stats>("/fire-door-schedule/stats/summary"),
      ]);

      setProjects(projectsData.projects);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading fire door schedule:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProjects = projects.filter((project) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      project.mjsNumber?.toLowerCase().includes(searchLower) ||
      project.jobName?.toLowerCase().includes(searchLower) ||
      project.clientName?.toLowerCase().includes(searchLower) ||
      project.poNumber?.toLowerCase().includes(searchLower)
    );
  });

  function getStatusBadgeVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
    if (!status) return "outline";
    if (status.includes("COMPLETE") || status.includes("SIGNED OFF")) return "default";
    if (status.includes("PROGRESS") || status.includes("WORKING")) return "secondary";
    if (status.includes("AWAITING") || status.includes("RED FOLDER")) return "outline";
    return "outline";
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Fire Door Schedule</h1>
          <p className="text-muted-foreground">
            Track projects from enquiry to completion
          </p>
        </div>
        <Button onClick={() => router.push("/fire-door-schedule/new")}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Red Folder</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byLocation.redFolder}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byLocation.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Complete</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byLocation.complete}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by job name, MJS#, client, PO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={jobLocationFilter} onValueChange={setJobLocationFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="RED FOLDER">Red Folder</SelectItem>
                <SelectItem value="IN PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETE">Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed View */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="design">Design & Sign-Off</TabsTrigger>
              <TabsTrigger value="bom">BOM & Ordering</TabsTrigger>
              <TabsTrigger value="production">Production & QA</TabsTrigger>
              <TabsTrigger value="paperwork">Paperwork</TabsTrigger>
              <TabsTrigger value="delivery">Delivery</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* Tab: Overview */}
            <TabsContent value="overview" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MJS#</TableHead>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date Received</TableHead>
                      <TableHead>Date Required</TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sign Off</TableHead>
                      <TableHead>Scheduled By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          No projects found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProjects.map((project) => (
                        <TableRow
                          key={project.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/fire-door-schedule/${project.id}`)}
                        >
                          <TableCell className="font-medium">{project.mjsNumber || "-"}</TableCell>
                          <TableCell>{project.jobName || "-"}</TableCell>
                          <TableCell>{project.clientName || "-"}</TableCell>
                          <TableCell>{formatDate(project.dateReceived)}</TableCell>
                          <TableCell>{formatDate(project.dateRequired)}</TableCell>
                          <TableCell>{project.poNumber || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(project.jobLocation)}>
                              {project.jobLocation || "Unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(project.signOffStatus)}>
                              {project.signOffStatus || "Unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell>{project.scheduledBy || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab: Design & Sign-Off */}
            <TabsContent value="design" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MJS#</TableHead>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Sign Off Status</TableHead>
                      <TableHead>Sign Off Date</TableHead>
                      <TableHead>Scheduled By</TableHead>
                      <TableHead>Lead Time (weeks)</TableHead>
                      <TableHead>Approx Delivery</TableHead>
                      <TableHead>Days Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/fire-door-schedule/${project.id}`)}
                      >
                        <TableCell className="font-medium">{project.mjsNumber || "-"}</TableCell>
                        <TableCell>{project.jobName || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(project.signOffStatus)}>
                            {project.signOffStatus || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(project.signOffDate)}</TableCell>
                        <TableCell>{project.scheduledBy || "-"}</TableCell>
                        <TableCell>{project.leadTimeWeeks || "-"}</TableCell>
                        <TableCell>{formatDate(project.approxDeliveryDate)}</TableCell>
                        <TableCell>
                          {project.workingDaysRemaining !== null && project.workingDaysRemaining !== undefined
                            ? `${project.workingDaysRemaining} days`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab: BOM & Ordering */}
            <TabsContent value="bom" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MJS#</TableHead>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Ordering Status</TableHead>
                      <TableHead>Blanks</TableHead>
                      <TableHead>Lippings</TableHead>
                      <TableHead>Facings</TableHead>
                      <TableHead>Glass</TableHead>
                      <TableHead>Ironmongery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/fire-door-schedule/${project.id}`)}
                      >
                        <TableCell className="font-medium">{project.mjsNumber || "-"}</TableCell>
                        <TableCell>{project.jobName || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(project.orderingStatus)}>
                            {project.orderingStatus || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {project.blanksStatus || "-"}
                          {project.blanksChecked && <span className="ml-1">✓</span>}
                        </TableCell>
                        <TableCell>
                          {project.lippingsStatus || "-"}
                          {project.lippingsChecked && <span className="ml-1">✓</span>}
                        </TableCell>
                        <TableCell>
                          {project.facingsStatus || "-"}
                          {project.facingsChecked && <span className="ml-1">✓</span>}
                        </TableCell>
                        <TableCell>
                          {project.glassStatus || "-"}
                          {project.glassChecked && <span className="ml-1">✓</span>}
                        </TableCell>
                        <TableCell>
                          {project.ironmongeryStatus || "-"}
                          {project.ironmongeryChecked && <span className="ml-1">✓</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab: Production & QA */}
            <TabsContent value="production" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MJS#</TableHead>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Overall Progress</TableHead>
                      <TableHead>Blanks Cut</TableHead>
                      <TableHead>Edgeband</TableHead>
                      <TableHead>Facings</TableHead>
                      <TableHead>Final CNC</TableHead>
                      <TableHead>Spray</TableHead>
                      <TableHead>Build</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/fire-door-schedule/${project.id}`)}
                      >
                        <TableCell className="font-medium">{project.mjsNumber || "-"}</TableCell>
                        <TableCell>{project.jobName || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${project.overallProgress || 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{project.overallProgress || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{project.blanksCutPercent || 0}%</TableCell>
                        <TableCell>{project.edgebandPercent || 0}%</TableCell>
                        <TableCell>{project.facingsPercent || 0}%</TableCell>
                        <TableCell>{project.finalCncPercent || 0}%</TableCell>
                        <TableCell>{project.sprayPercent || 0}%</TableCell>
                        <TableCell>{project.buildPercent || 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab: Paperwork */}
            <TabsContent value="paperwork" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MJS#</TableHead>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Paperwork Status</TableHead>
                      <TableHead>Door Paperwork</TableHead>
                      <TableHead>Final CNC Sheet</TableHead>
                      <TableHead>Delivery Checklist</TableHead>
                      <TableHead>Certification</TableHead>
                      <TableHead>FSC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/fire-door-schedule/${project.id}`)}
                      >
                        <TableCell className="font-medium">{project.mjsNumber || "-"}</TableCell>
                        <TableCell>{project.jobName || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(project.paperworkStatus)}>
                            {project.paperworkStatus || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>{project.doorPaperworkStatus || "-"}</TableCell>
                        <TableCell>{project.finalCncSheetStatus || "-"}</TableCell>
                        <TableCell>{project.deliveryChecklistStatus || "-"}</TableCell>
                        <TableCell>{project.certificationRequired || "-"}</TableCell>
                        <TableCell>{project.fscRequired ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab: Delivery */}
            <TabsContent value="delivery" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MJS#</TableHead>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Transport Status</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      <TableHead>Install Start</TableHead>
                      <TableHead>Install End</TableHead>
                      <TableHead>Snagging</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/fire-door-schedule/${project.id}`)}
                      >
                        <TableCell className="font-medium">{project.mjsNumber || "-"}</TableCell>
                        <TableCell>{project.jobName || "-"}</TableCell>
                        <TableCell>{project.transportStatus || "-"}</TableCell>
                        <TableCell>{formatDate(project.deliveryDate)}</TableCell>
                        <TableCell>{formatDate(project.installStart)}</TableCell>
                        <TableCell>{formatDate(project.installEnd)}</TableCell>
                        <TableCell>
                          {project.snaggingComplete ? (
                            <Badge variant="default">Complete</Badge>
                          ) : project.snaggingStatus ? (
                            <Badge variant="secondary">{project.snaggingStatus}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab: Notes */}
            <TabsContent value="notes" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MJS#</TableHead>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Communication Notes</TableHead>
                      <TableHead>Internal Notes</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Updated By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/fire-door-schedule/${project.id}`)}
                      >
                        <TableCell className="font-medium">{project.mjsNumber || "-"}</TableCell>
                        <TableCell>{project.jobName || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {project.communicationNotes || "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {project.internalNotes || "-"}
                        </TableCell>
                        <TableCell>{formatDate(project.lastUpdatedAt)}</TableCell>
                        <TableCell>{project.lastUpdatedBy || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>
    </div>
  );
}
