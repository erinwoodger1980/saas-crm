"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Calendar, DollarSign, User, Mail, Phone, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Opportunity {
  id: string;
  title: string;
  stage: string;
  valueGBP: number | null;
  startDate: string | null;
  deliveryDate: string | null;
  createdAt: string;
  notes: string | null;
  lead: {
    id: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
  } | null;
}

const stageColors: Record<string, string> = {
  LEAD: "bg-gray-100 text-gray-800",
  QUOTED: "bg-blue-100 text-blue-800",
  WON: "bg-green-100 text-green-800",
  PRODUCTION: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-teal-100 text-teal-800",
  INVOICED: "bg-indigo-100 text-indigo-800",
  LOST: "bg-red-100 text-red-800",
};

const stageDescriptions: Record<string, string> = {
  LEAD: "Initial enquiry received",
  QUOTED: "Quote provided to customer",
  WON: "Order confirmed",
  PRODUCTION: "Manufacturing in progress",
  DELIVERED: "Goods delivered to site",
  INVOICED: "Invoice issued",
  LOST: "Opportunity not won",
};

export default function CustomerProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const token = localStorage.getItem("customerToken");
    if (!token) {
      router.push("/customer/login");
      return;
    }

    fetch(`/api/customer-portal/opportunities/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setProject(data.opportunity);
          setLoading(false);
        }
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [projectId, router]);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "TBC";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/customer/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Project not found</h3>
              <p className="text-gray-500">
                This project doesn't exist or you don't have access to it.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/customer/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
        <p className="text-gray-600 mt-2">Project #{project.id.slice(0, 8)}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge
              variant="secondary"
              className={`${stageColors[project.stage] || "bg-gray-100 text-gray-800"} text-sm px-3 py-1`}
            >
              {project.stage}
            </Badge>
            <p className="text-xs text-gray-500 mt-2">
              {stageDescriptions[project.stage] || "Project in progress"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Project Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-2xl font-bold">{formatCurrency(project.valueGBP)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Start Date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium">{formatDate(project.startDate)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Delivery Date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium">{formatDate(project.deliveryDate)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Information */}
      {project.lead && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Primary contact for this project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Contact Name</p>
                  <p className="text-base">{project.lead.contactName || "-"}</p>
                </div>
              </div>

              {project.lead.companyName && (
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Company</p>
                    <p className="text-base">{project.lead.companyName}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base">{project.lead.email || "-"}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-base">{project.lead.phone || "-"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
          <CardDescription>Track the progress of your project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Timeline visualization */}
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              
              <div className="relative flex items-start space-x-4 pb-6">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  project.stage !== 'LEAD' ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  <div className="w-3 h-3 rounded-full bg-white" />
                </div>
                <div className="flex-grow pt-1">
                  <p className="font-medium">Lead Created</p>
                  <p className="text-sm text-gray-500">{formatDate(project.createdAt)}</p>
                </div>
              </div>

              {['QUOTED', 'WON', 'PRODUCTION', 'DELIVERED', 'INVOICED'].map((stage) => (
                <div key={stage} className="relative flex items-start space-x-4 pb-6">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    ['QUOTED', 'WON', 'PRODUCTION', 'DELIVERED', 'INVOICED'].indexOf(project.stage) >= 
                    ['QUOTED', 'WON', 'PRODUCTION', 'DELIVERED', 'INVOICED'].indexOf(stage)
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                  }`}>
                    <div className="w-3 h-3 rounded-full bg-white" />
                  </div>
                  <div className="flex-grow pt-1">
                    <p className="font-medium">{stage}</p>
                    <p className="text-sm text-gray-500">{stageDescriptions[stage]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {project.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Project Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{project.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
