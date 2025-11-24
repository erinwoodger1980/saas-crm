"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Briefcase, Eye } from "lucide-react";
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
  lead: {
    id: string;
    contactName: string | null;
    email: string | null;
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

export default function CustomerProjectsPage() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    if (!token) {
      router.push("/customer/login");
      return;
    }

    fetch("/api/customer-portal/opportunities", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setOpportunities(data.opportunities);
        setFilteredOpportunities(data.opportunities);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = opportunities.filter(
        (opp) =>
          opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          opp.stage.toLowerCase().includes(searchTerm.toLowerCase()) ||
          opp.lead?.contactName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOpportunities(filtered);
    } else {
      setFilteredOpportunities(opportunities);
    }
  }, [searchTerm, opportunities]);

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
      month: "short",
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-2">Track the progress of your active projects</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Projects</CardTitle>
              <CardDescription>
                {filteredOpportunities.length}{" "}
                {filteredOpportunities.length === 1 ? "project" : "projects"}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOpportunities.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Your active projects will appear here"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOpportunities.map((opp) => (
                    <TableRow key={opp.id} className="cursor-pointer hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium">{opp.title}</div>
                        <div className="text-sm text-gray-500">#{opp.id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={stageColors[opp.stage] || "bg-gray-100 text-gray-800"}
                        >
                          {opp.stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {opp.lead?.contactName || "-"}
                          {opp.lead?.email && (
                            <div className="text-gray-500">{opp.lead.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(opp.startDate)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(opp.deliveryDate)}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(opp.valueGBP)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/customer/projects/${opp.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
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
  );
}
