"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Download, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface QuoteLine {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

interface Quote {
  id: string;
  title: string;
  status: string;
  totalGBP: number;
  currency: string;
  subtotalMaterialGBP: number;
  subtotalLabourGBP: number;
  deliveryCost: number;
  proposalPdfUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: QuoteLine[];
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

export default function CustomerQuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params.id as string;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    if (!token) {
      router.push("/customer/login");
      return;
    }

    fetch(`/api/customer-portal/quotes/${quoteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setQuote(data.quote);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router, quoteId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatDate = (date: string) => {
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

  if (!quote) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Quote not found</h3>
        <Button onClick={() => router.push("/customer/quotes")}>Back to Quotes</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/customer/quotes")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{quote.title}</h1>
            <p className="text-gray-600 mt-1">Quote #{quote.id.slice(0, 8)}</p>
          </div>
        </div>
        {quote.proposalPdfUrl && (
          <Button onClick={() => window.open(quote.proposalPdfUrl!, "_blank")}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        )}
      </div>

      {/* Quote Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge
              variant="secondary"
              className={`${statusColors[quote.status] || "bg-gray-100 text-gray-800"} text-base px-3 py-1`}
            >
              {quote.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Amount</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(quote.totalGBP)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">{formatDate(quote.createdAt)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Information */}
      {quote.lead && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quote.lead.contactName && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Contact Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{quote.lead.contactName}</dd>
                </div>
              )}
              {quote.lead.email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{quote.lead.email}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Quote Items</CardTitle>
          <CardDescription>Detailed breakdown of items and pricing</CardDescription>
        </CardHeader>
        <CardContent>
          {quote.lines.length === 0 ? (
            <p className="text-gray-500 text-sm">No line items</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.description}</TableCell>
                      <TableCell className="text-right">{line.qty}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="border-t bg-gray-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Materials Subtotal</span>
                  <span className="font-medium">{formatCurrency(quote.subtotalMaterialGBP)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Labour Subtotal</span>
                  <span className="font-medium">{formatCurrency(quote.subtotalLabourGBP)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery</span>
                  <span className="font-medium">{formatCurrency(quote.deliveryCost)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatCurrency(quote.totalGBP)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
