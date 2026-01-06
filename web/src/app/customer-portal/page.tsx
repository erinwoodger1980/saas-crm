"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  clearCustomerPortalToken,
  customerPortalFetch,
  getCustomerPortalToken,
} from "@/lib/customer-portal-auth";
import { Package, Clock, CheckCircle2, AlertCircle, TrendingUp, BarChart3 } from "lucide-react";

type CustomerMe = {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    clientAccount?: {
      companyName?: string;
    };
  };
};

type FireDoorProject = {
  id: string;
  mjsNumber?: string;
  jobName?: string;
  dateRequired?: string;
  jobLocation?: string;
  signOffStatus?: string;
  orderingStatus?: string;
  overallProgress?: number;
  totalPrice?: any;
  submittedAt?: string;
  type?: "fire-door-job" | "opportunity";
};

interface Stats {
  totalProjects: number;
  redFolder: number;
  inProgress: number;
  complete: number;
  totalValue: number;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoneyGBP(value?: any) {
  if (value == null) return "£0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "£0";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function locationBadgeClass(location?: string) {
  const loc = location?.toUpperCase();
  if (loc?.includes("RED FOLDER")) return "bg-red-100 text-red-800";
  if (loc?.includes("IN PROGRESS")) return "bg-blue-100 text-blue-800";
  if (loc?.includes("COMPLETE")) return "bg-green-100 text-green-800";
  return "bg-gray-100 text-gray-800";
}

function progressColor(progress?: number) {
  if (!progress) return "bg-gray-200";
  if (progress >= 80) return "bg-green-500";
  if (progress >= 50) return "bg-blue-500";
  if (progress >= 25) return "bg-yellow-500";
  return "bg-red-500";
}

export default function CustomerPortalJobsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<CustomerMe | null>(null);
  const [projects, setProjects] = useState<FireDoorProject[]>([]);
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const companyName = useMemo(() => {
    return me?.user?.clientAccount?.companyName || me?.user?.companyName || "Customer";
  }, [me]);

  // Calculate stats
  const stats = useMemo<Stats>(() => {
    const totalValue = projects.reduce((sum, p) => {
      const val = typeof p.totalPrice === "string" ? parseFloat(p.totalPrice) : (p.totalPrice || 0);
      return sum + val;
    }, 0);

    return {
      totalProjects: projects.length,
      redFolder: projects.filter(p => p.jobLocation?.toUpperCase().includes("RED FOLDER")).length,
      inProgress: projects.filter(p => p.jobLocation?.toUpperCase().includes("IN PROGRESS")).length,
      complete: projects.filter(p => p.jobLocation?.toUpperCase().includes("COMPLETE")).length,
      totalValue,
    };
  }, [projects]);

  // Filter projects by tab
  const filteredProjects = useMemo(() => {
    if (activeTab === "ALL") return projects;
    if (activeTab === "RED_FOLDER") return projects.filter(p => p.jobLocation?.toUpperCase().includes("RED FOLDER"));
    if (activeTab === "IN_PROGRESS") return projects.filter(p => p.jobLocation?.toUpperCase().includes("IN PROGRESS"));
    if (activeTab === "COMPLETE") return projects.filter(p => p.jobLocation?.toUpperCase().includes("COMPLETE"));
    return projects;
  }, [projects, activeTab]);

  useEffect(() => {
    const token = getCustomerPortalToken();
    if (!token) {
      router.replace("/customer-portal/login");
      return;
    }

    (async () => {
      try {
        const [meData, jobsData] = await Promise.all([
          customerPortalFetch<CustomerMe>("/customer-auth/me"),
          customerPortalFetch<{ jobs: FireDoorProject[] }>("/customer-portal/fire-door-jobs"),
        ]);
        setMe(meData);
        setProjects(jobsData?.jobs || []);
      } catch (err: any) {
        const status = err?.status;
        if (status === 401 || status === 403) {
          clearCustomerPortalToken();
          router.replace("/customer-portal/login");
          return;
        }
        toast({
          title: "Could not load projects",
          description: err?.message || "Please try again",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [router, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading your projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="mx-auto w-full px-6 py-8 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Fire Door Schedule
              </h1>
              <p className="text-slate-600 mt-2">{companyName} • Track from enquiry to delivery</p>
            </div>
            <Button
              variant="outline"
              className="bg-white/50"
              onClick={() => {
                clearCustomerPortalToken();
                router.replace("/customer-portal/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Projects */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-blue-700">Total Current Projects</div>
                  <div className="text-3xl font-bold text-blue-900">{stats.totalProjects}</div>
                  <div className="text-xs text-blue-600 mt-1">Active fire door projects</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Red Folder */}
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-red-700">Red Folder</div>
                  <div className="text-3xl font-bold text-red-900">{stats.redFolder}</div>
                  <div className="text-xs text-red-600 mt-1">Awaiting sign-off</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* In Progress */}
          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/10 rounded-lg">
                  <Package className="h-6 w-6 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-cyan-700">In Progress</div>
                  <div className="text-3xl font-bold text-cyan-900">{stats.inProgress}</div>
                  <div className="text-xs text-cyan-600 mt-1">Active production</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Complete */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-green-700">Complete in Factory</div>
                  <div className="text-3xl font-bold text-green-900">{stats.complete}</div>
                  <div className="text-xs text-green-600 mt-1">Ready for delivery</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Value */}
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-emerald-700">Total Value</div>
                  <div className="text-3xl font-bold text-emerald-900">{formatMoneyGBP(stats.totalValue)}</div>
                  <div className="text-xs text-emerald-600 mt-1">{stats.totalProjects} projects</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "ALL", label: "All" },
            { id: "RED_FOLDER", label: "Red Folder" },
            { id: "IN_PROGRESS", label: "BOM & Materials" },
            { id: "COMPLETE", label: "Production" },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Projects Table */}
        <Card className="bg-white/70 backdrop-blur border-slate-200">
          <CardContent className="p-6">
            {filteredProjects.length === 0 ? (
              <div className="py-10 text-center text-slate-600">
                No projects found in this category.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MJS</TableHead>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Sign-Off</TableHead>
                      <TableHead>Ordering</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Required Date</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-mono font-medium">
                          {project.mjsNumber || "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {project.jobName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={locationBadgeClass(project.jobLocation)}>
                            {project.jobLocation || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {project.signOffStatus || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {project.orderingStatus || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${progressColor(project.overallProgress)}`}
                                style={{ width: `${project.overallProgress || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-600 min-w-[3ch]">
                              {project.overallProgress || 0}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(project.dateRequired)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoneyGBP(project.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
