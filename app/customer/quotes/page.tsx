"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, FileText, Download, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Quote {
  id: string;
  title: string;
  status: string;
  totalGBP: number;
  currency: string;
  proposalPdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    contactName: string | null;
    email: string | null;
  } | null;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SENT: "bg-blue-100 text-blue-800",
  VIEWED: "bg-purple-100 text-purple-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  EXPIRED: "bg-orange-100 text-orange-800",
};

export default function CustomerQuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    if (!token) {
      router.push("/customer/login");
      return;
    }

    fetch("/api/customer-portal/quotes", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setQuotes(data.quotes);
        setFilteredQuotes(data.quotes);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = quotes.filter(
        (quote) =>
          quote.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          quote.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
          quote.lead?.contactName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredQuotes(filtered);
    } else {
      setFilteredQuotes(quotes);
    }
  }, [searchTerm, quotes]);

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
          <h1 className="text-3xl font-bold text-gray-900">Quotes</h1>
          <p className="text-gray-600 mt-2">View and download your quotes</p>
        </div>
        <Button onClick={() => router.push("/questionnaire")}>
          <FileText className="h-4 w-4 mr-2" />
          Request New Quote
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Quotes</CardTitle>
              <CardDescription>
                {filteredQuotes.length} {filteredQuotes.length === 1 ? "quote" : "quotes"}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search quotes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? "Try adjusting your search" : "Get started by requesting a new quote"}
              </p>
              {!searchTerm && (
                <Button onClick={() => router.push("/questionnaire")}>Request a Quote</Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => (
                    <TableRow key={quote.id} className="cursor-pointer hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium">{quote.title}</div>
                        <div className="text-sm text-gray-500">#{quote.id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[quote.status] || "bg-gray-100 text-gray-800"}
                        >
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {quote.lead?.contactName || "-"}
                          {quote.lead?.email && (
                            <div className="text-gray-500">{quote.lead.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(quote.createdAt)}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(quote.totalGBP)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/customer/quotes/${quote.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {quote.proposalPdfUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(quote.proposalPdfUrl!, "_blank");
                              }}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                          )}
                        </div>
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
