"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Briefcase, DoorOpen, ArrowRight, Loader2 } from "lucide-react";

interface DashboardData {
  summary: {
    quoteCount: number;
    opportunityCount: number;
    fireDoorJobCount: number;
  };
  recentQuotes: Array<{
    id: string;
    title: string;
    status: string;
    totalGBP: number;
    createdAt: string;
  }>;
  recentOpportunities: Array<{
    id: string;
    title: string;
    stage: string;
    valueGBP: number;
    createdAt: string;
  }>;
}

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    if (!token) {
      router.push("/customer/login");
      return;
    }

    fetch("/api/customer-portal/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500">Failed to load dashboard</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to your customer portal</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
            <FileText className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.quoteCount}</div>
            <Button
              variant="link"
              className="px-0 h-auto text-sm text-blue-600"
              onClick={() => router.push("/customer/quotes")}
            >
              View all quotes <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.opportunityCount}</div>
            <Button
              variant="link"
              className="px-0 h-auto text-sm text-blue-600"
              onClick={() => router.push("/customer/projects")}
            >
              View projects <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fire Door Orders</CardTitle>
            <DoorOpen className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.fireDoorJobCount}</div>
            <Button
              variant="link"
              className="px-0 h-auto text-sm text-blue-600"
              onClick={() => router.push("/customer/fire-doors")}
            >
              View orders <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Quotes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Quotes</CardTitle>
          <CardDescription>Your latest quotes and proposals</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentQuotes.length === 0 ? (
            <p className="text-gray-500 text-sm">No quotes yet</p>
          ) : (
            <div className="space-y-4">
              {data.recentQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/customer/quotes/${quote.id}`)}
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{quote.title}</h4>
                    <p className="text-sm text-gray-500">{formatDate(quote.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{formatCurrency(quote.totalGBP)}</div>
                    <div className="text-xs text-gray-500 uppercase">{quote.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>Your active and completed projects</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentOpportunities.length === 0 ? (
            <p className="text-gray-500 text-sm">No projects yet</p>
          ) : (
            <div className="space-y-4">
              {data.recentOpportunities.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/customer/projects/${project.id}`)}
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{project.title}</h4>
                    <p className="text-sm text-gray-500">{formatDate(project.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {project.valueGBP ? formatCurrency(project.valueGBP) : "TBC"}
                    </div>
                    <div className="text-xs text-gray-500 uppercase">{project.stage}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with common tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => router.push("/questionnaire")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Request a New Quote
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => router.push("/customer/quotes")}
          >
            <FileText className="h-4 w-4 mr-2" />
            View All Quotes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
