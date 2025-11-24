"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, AlertCircle, CheckCircle2, Package, TrendingUp, Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface MaterialItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  cost: number;
  currency: string;
  unit: string;
  stockQuantity: number;
  minStockLevel?: number;
  isActive: boolean;
  supplier?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface MaterialStats {
  total: number;
  withCost: number;
  zeroCost: number;
  active: number;
  inactive: number;
  byCategory: Record<string, number>;
}

interface MaterialDebugResponse {
  ok: boolean;
  materials: MaterialItem[];
  stats: MaterialStats;
  query: {
    tenantId: string;
    includeInactive?: boolean;
    category?: string;
    search?: string;
  };
}

export default function MaterialCostDebugPanel() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [stats, setStats] = useState<MaterialStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [includeInactive, setIncludeInactive] = useState(false);

  // Load materials
  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (includeInactive) params.append("includeInactive", "true");

      const data = await apiFetch<MaterialDebugResponse>(
        `/material-debug?${params.toString()}`
      );

      setMaterials(data.materials || []);
      setStats(data.stats || null);
    } catch (error: any) {
      console.error("[MaterialCostDebugPanel] Load error:", error);
      toast({
        title: "Failed to load materials",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load categories
  const loadCategories = async () => {
    try {
      const data = await apiFetch<{ ok: boolean; categories: string[] }>(
        "/material-debug/categories/list"
      );
      setCategories(data.categories || []);
    } catch (error: any) {
      console.error("[MaterialCostDebugPanel] Categories error:", error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [search, categoryFilter, includeInactive]);

  // Load material details
  const loadMaterialDetails = async (id: string) => {
    setIsLoadingDetails(true);
    try {
      const data = await apiFetch<{ ok: boolean; material: MaterialItem }>(
        `/material-debug/${id}`
      );
      setSelectedMaterial(data.material);
    } catch (error: any) {
      console.error("[MaterialCostDebugPanel] Details error:", error);
      toast({
        title: "Failed to load material details",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number, currency: string = "GBP") => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(value);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const costIssues = materials.filter((m) => m.cost === 0);
  const hasIssues = costIssues.length > 0;

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.active} active, {stats.inactive} inactive
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">With Costs</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.withCost}</div>
                <p className="text-xs text-muted-foreground">
                  {((stats.withCost / stats.total) * 100).toFixed(1)}% of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Missing Costs</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.zeroCost}</div>
                <p className="text-xs text-muted-foreground">Need cost data</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Object.keys(stats.byCategory).length}</div>
                <p className="text-xs text-muted-foreground">
                  {Object.keys(stats.byCategory).join(", ").slice(0, 30)}...
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Material Cost Database</CardTitle>
            <CardDescription>
              Debug panel to verify material costs are visible and correct.
              Missing costs will cause pricing errors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Code or name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="includeInactive"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                    className="rounded"
                  />
                  <label
                    htmlFor="includeInactive"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include inactive
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issues Alert */}
        {hasIssues && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-900">Cost Data Issues</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-800">
                {costIssues.length} materials have zero or missing costs. These will cause pricing
                failures. Update costs via purchase orders or manual entry.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  const codes = costIssues.map((m) => m.code).join(", ");
                  navigator.clipboard.writeText(codes);
                  toast({
                    title: "Copied to clipboard",
                    description: `${costIssues.length} material codes copied`,
                  });
                }}
              >
                Copy missing material codes
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Materials Table */}
        <Card>
          <CardHeader>
            <CardTitle>Materials ({materials.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No materials found</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Try adjusting your filters or run seed script
                </p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-mono text-sm">{material.code}</TableCell>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{material.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {material.cost === 0 ? (
                            <span className="text-orange-600 font-medium">£0.00</span>
                          ) : (
                            <span className="font-medium">
                              {formatCurrency(material.cost, material.currency)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {material.unit}
                        </TableCell>
                        <TableCell className="text-sm">{material.stockQuantity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {material.supplier?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {material.isActive ? (
                            <Badge variant="outline" className="text-green-600">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadMaterialDetails(material.id)}
                          >
                            <Eye className="h-4 w-4" />
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

      {/* Details Dialog */}
      <Dialog open={!!selectedMaterial} onOpenChange={() => setSelectedMaterial(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Material Details</DialogTitle>
            <DialogDescription>
              {selectedMaterial?.code} - {selectedMaterial?.name}
            </DialogDescription>
          </DialogHeader>
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : selectedMaterial ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Code</Label>
                  <p className="font-mono font-medium">{selectedMaterial.code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p>{selectedMaterial.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cost</Label>
                  <p className="font-bold text-lg">
                    {formatCurrency(selectedMaterial.cost, selectedMaterial.currency)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Unit</Label>
                  <p>{selectedMaterial.unit}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Stock Quantity</Label>
                  <p>{selectedMaterial.stockQuantity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Min Stock Level</Label>
                  <p>{selectedMaterial.minStockLevel || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Supplier</Label>
                  <p>{selectedMaterial.supplier?.name || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{selectedMaterial.isActive ? "Active" : "Inactive"}</p>
                </div>
              </div>

              {selectedMaterial.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedMaterial.description}</p>
                </div>
              )}

              <div className="flex gap-4 text-xs text-muted-foreground">
                <div>Created: {formatDate(selectedMaterial.createdAt)}</div>
                <div>Updated: {formatDate(selectedMaterial.updatedAt)}</div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setSelectedMaterial(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
