"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
import { ArrowLeft, Link as LinkIcon } from "lucide-react";
import Link from "next/link";

interface AccountingDocument {
  id: string;
  externalType: string;
  documentNumber: string | null;
  referenceText: string | null;
  contactName: string | null;
  issueDate: string | null;
  total: number;
  currency: string;
}

interface Opportunity {
  id: string;
  title: string;
  number: string | null;
}

export default function UnlinkedAccountingDocumentsPage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<AccountingDocument[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "sales" | "purchase">("all");
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);
      
      // Load unlinked documents
      const params = filter !== "all" ? `?type=${filter}` : "";
      const docsResult = await apiFetch<{ documents: AccountingDocument[] }>(
        `/accounting/sage/unlinked${params}`
      );
      setDocuments(docsResult.documents);

      // Load opportunities for linking
      const oppsResult = await apiFetch<any>("/opportunities");
      setOpportunities(oppsResult.opportunities || oppsResult || []);
    } catch (error: any) {
      console.error("Failed to load data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLink(documentId: string, opportunityId: string) {
    if (!opportunityId) return;

    setLinking(documentId);
    try {
      await apiFetch("/accounting/sage/link", {
        method: "POST",
        body: JSON.stringify({
          accountingDocumentId: documentId,
          opportunityId,
        }),
      });

      toast({
        title: "Linked",
        description: "Document has been linked to the project",
      });

      // Reload to remove from list
      await loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to link document",
        variant: "destructive",
      });
    } finally {
      setLinking(null);
    }
  }

  function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(amount);
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-GB");
  }

  function getDocumentTypeLabel(type: string) {
    const labels: Record<string, string> = {
      sales_invoice: "Sales Invoice",
      sales_credit: "Sales Credit",
      purchase_invoice: "Purchase Invoice",
      purchase_credit: "Purchase Credit",
    };
    return labels[type] || type;
  }

  function getDocumentTypeBadge(type: string) {
    if (type.startsWith("sales")) {
      return <Badge variant="default" className="bg-blue-100 text-blue-800">Sales</Badge>;
    }
    return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Purchase</Badge>;
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Unlinked Accounting Documents
          </CardTitle>
          <CardDescription>
            Link Sage documents to JoineryAI projects for accurate WIP tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(val: any) => setFilter(val)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Documents</SelectItem>
                <SelectItem value="sales">Sales Only</SelectItem>
                <SelectItem value="purchase">Purchase Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No unlinked documents found. All documents are linked!
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Link to Project</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="space-y-1">
                          {getDocumentTypeBadge(doc.externalType)}
                          <div className="text-xs text-muted-foreground">
                            {getDocumentTypeLabel(doc.externalType)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(doc.issueDate)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {doc.documentNumber || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{doc.referenceText || "—"}</div>
                      </TableCell>
                      <TableCell>{doc.contactName || "—"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(doc.total, doc.currency)}
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={linking === doc.id}
                          onValueChange={(oppId) => handleLink(doc.id, oppId)}
                        >
                          <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select project..." />
                          </SelectTrigger>
                          <SelectContent>
                            {opportunities.map((opp) => (
                              <SelectItem key={opp.id} value={opp.id}>
                                {opp.number || opp.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
