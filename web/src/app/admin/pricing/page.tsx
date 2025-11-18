'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef, Row, SortingState } from '@tanstack/react-table';
import {
	Archive,
	Filter,
	Loader2,
	MoreHorizontal,
	Pencil,
	Plus,
	RefreshCw,
	Search,
	Trash2,
} from 'lucide-react';

import { MaterialFormDialog, MaterialFormData, SupplierOption } from '@/components/admin/pricing/MaterialFormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

type MaterialItem = {
	id: string;
	tenantId: string;
	supplierId: string | null;
	supplierName: string | null;
	category: string;
	code: string;
	name: string;
	description: string | null;
	cost: number;
	currency: string;
	unit: string;
	stockQuantity: number | null;
	minStockLevel: number | null;
	leadTimeDays: number | null;
	isActive: boolean;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
};

type MaterialsResponse = {
	items: MaterialItem[];
	suppliers: SupplierOption[];
	categories: string[];
};

const fetcher = async (url: string): Promise<MaterialsResponse> => {
	const res = await fetch(url);
	if (!res.ok) {
		const message = await res.text();
		throw new Error(message || 'Failed to load materials');
	}
	return res.json();
};

function useDebouncedValue<T>(value: T, delay = 300) {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const id = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(id);
	}, [value, delay]);

	return debounced;
}

export default function PricingMaterialsPage() {
	const { toast } = useToast();
	const [search, setSearch] = useState('');
	const [category, setCategory] = useState('');
	const [showInactive, setShowInactive] = useState(false);
	const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
	const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);

	const debouncedSearch = useDebouncedValue(search.trim());

	const query = useMemo(() => {
		const params = new URLSearchParams();
		if (debouncedSearch) params.set('q', debouncedSearch);
		if (category.trim()) params.set('category', category.trim());
		if (showInactive) params.set('includeInactive', 'true');
		params.set('limit', '500');
		return params.toString();
	}, [debouncedSearch, category, showInactive]);

	const { data, error, isLoading, mutate } = useSWR<MaterialsResponse>(
		`/api/pricing/material-items?${query}`,
		fetcher,
		{ revalidateOnFocus: false }
	);

	const items = useMemo(() => data?.items ?? [], [data]);
	const suppliers = useMemo(() => data?.suppliers ?? [], [data]);
	const categories = useMemo(() => data?.categories ?? [], [data]);

	const metrics = useMemo(() => {
		const active = items.filter((item) => item.isActive).length;
		const inactive = items.length - active;
		const vendorCount = suppliers.length;
		const avgLeadTime = items.length
			? Math.round(
					items.reduce((acc, item) => acc + (item.leadTimeDays ?? 0), 0) / items.length
				)
			: 0;
		return { active, inactive, vendorCount, avgLeadTime };
	}, [items, suppliers]);

	const openCreateDialog = useCallback(() => {
		setDialogMode('create');
		setEditingItem(null);
		setDialogOpen(true);
	}, []);

	const openEditDialog = useCallback((item: MaterialItem) => {
		setDialogMode('edit');
		setEditingItem(item);
		setDialogOpen(true);
	}, []);

	const saveMaterial = useCallback(
		async (values: MaterialFormData) => {
			const isEdit = dialogMode === 'edit' && editingItem;
			const endpoint = isEdit
				? `/api/pricing/material-items/${editingItem!.id}`
				: '/api/pricing/material-items';
			const method = isEdit ? 'PATCH' : 'POST';

			try {
				const res = await fetch(endpoint, {
					method,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(values),
				});

				if (!res.ok) {
					const message = await res.text();
					throw new Error(message || 'Failed to save material');
				}

				const payload = await res.json();

				await mutate((current) => {
					if (!current) return current;
					const nextItems = isEdit
						? current.items.map((item) => (item.id === payload.item.id ? payload.item : item))
						: [payload.item, ...current.items];
					return { ...current, items: nextItems };
				}, false);

				void mutate();

				toast({
					title: isEdit ? 'Material updated' : 'Material added',
					description: `${payload.item.name} saved successfully`,
				});
			} catch (err) {
				toast({
					variant: 'destructive',
					title: 'Save failed',
					description: err instanceof Error ? err.message : 'Unable to save material',
				});
				throw err;
			}
		},
		[dialogMode, editingItem, mutate, toast]
	);

	const toggleActive = useCallback(
		async (item: MaterialItem) => {
			const nextActive = !item.isActive;
			const previous = data;
			await mutate((current) => {
				if (!current) return current;
				return {
					...current,
					items: current.items.map((row) =>
						row.id === item.id ? { ...row, isActive: nextActive } : row
					),
				};
			}, false);

			try {
				const res = await fetch(`/api/pricing/material-items/${item.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ isActive: nextActive }),
				});

				if (!res.ok) {
					const message = await res.text();
					throw new Error(message || 'Failed to update material');
				}

				const payload = await res.json();

				await mutate((current) => {
					if (!current) return current;
					return {
						...current,
						items: current.items.map((row) =>
							row.id === payload.item.id ? payload.item : row
						),
					};
				}, false);

				toast({
					title: nextActive ? 'Material reactivated' : 'Material archived',
					description: `${item.name} is now ${nextActive ? 'active' : 'archived'}.`,
				});
			} catch (err) {
				await mutate(previous, false);
				toast({
					variant: 'destructive',
					title: 'Update failed',
					description: err instanceof Error ? err.message : 'Unable to update material',
				});
			} finally {
				void mutate();
			}
		},
		[data, mutate, toast]
	);

	const deleteMaterial = useCallback(
		async (item: MaterialItem) => {
			const confirmed = window.confirm(`Delete ${item.name}? This cannot be undone.`);
			if (!confirmed) return;

			const previous = data;
			await mutate((current) => {
				if (!current) return current;
				return { ...current, items: current.items.filter((row) => row.id !== item.id) };
			}, false);

			try {
				const res = await fetch(`/api/pricing/material-items/${item.id}`, { method: 'DELETE' });
				if (!res.ok) {
					const message = await res.text();
					throw new Error(message || 'Failed to delete material');
				}

				toast({ title: 'Material deleted', description: `${item.name} was removed.` });
			} catch (err) {
				await mutate(previous, false);
				toast({
					variant: 'destructive',
					title: 'Delete failed',
					description: err instanceof Error ? err.message : 'Unable to delete material',
				});
			} finally {
				void mutate();
			}
		},
		[data, mutate, toast]
	);

	const columns = useMemo<ColumnDef<MaterialItem>[]>(
		() => [
			{
				accessorKey: 'name',
				header: 'Material',
				cell: ({ row }: { row: Row<MaterialItem> }) => (
					<div>
						<div className="font-medium text-foreground">{row.original.name}</div>
						<div className="text-xs text-muted-foreground">{row.original.code}</div>
					</div>
				),
			},
			{
				accessorKey: 'category',
				header: 'Category',
				cell: ({ row }: { row: Row<MaterialItem> }) => (
					<Badge variant="outline" className="capitalize">
						{row.original.category.replace(/_/g, ' ')}
					</Badge>
				),
			},
			{
				accessorKey: 'supplierName',
				header: 'Supplier',
				cell: ({ row }: { row: Row<MaterialItem> }) => row.original.supplierName ?? '—',
			},
			{
				accessorKey: 'cost',
				header: 'Cost',
				cell: ({ row }: { row: Row<MaterialItem> }) =>
					`${row.original.currency} ${row.original.cost.toFixed(2)}`,
			},
			{
				accessorKey: 'stockQuantity',
				header: 'Stock',
				cell: ({ row }: { row: Row<MaterialItem> }) => row.original.stockQuantity ?? '—',
			},
			{
				accessorKey: 'leadTimeDays',
				header: 'Lead Time',
				cell: ({ row }: { row: Row<MaterialItem> }) =>
					row.original.leadTimeDays != null ? `${row.original.leadTimeDays}d` : '—',
			},
			{
				accessorKey: 'isActive',
				header: 'Status',
				cell: ({ row }: { row: Row<MaterialItem> }) => (
					<Badge variant={row.original.isActive ? 'default' : 'secondary'}>
						{row.original.isActive ? 'Active' : 'Archived'}
					</Badge>
				),
			},
			{
				id: 'actions',
				header: "",
				cell: ({ row }: { row: Row<MaterialItem> }) => (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => openEditDialog(row.original)}>
								<Pencil className="mr-2 h-4 w-4" /> Edit
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => toggleActive(row.original)}>
								<Archive className="mr-2 h-4 w-4" />
								{row.original.isActive ? "Archive" : "Activate"}
							</DropdownMenuItem>
							<DropdownMenuItem className="text-destructive" onClick={() => deleteMaterial(row.original)}>
								<Trash2 className="mr-2 h-4 w-4" /> Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
			},
		],
		[deleteMaterial, openEditDialog, toggleActive]
	);

	const table = useReactTable<MaterialItem>({
		data: items,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	if (error) {
		return (
			<div className="p-8">
				<Card className="p-6">
					<div className="flex items-center gap-3 text-destructive">
						<RefreshCw className="h-5 w-5" />
						<div>
							<p className="font-semibold">Failed to load pricing data</p>
							<p className="text-sm text-muted-foreground">{error.message}</p>
						</div>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-8 p-8">
			<div className="flex flex-wrap justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Pricing & Materials</h1>
					<p className="text-muted-foreground">
						Track supplier pricing, stock levels, and lead times in one place.
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant={showInactive ? "secondary" : "outline"}
						onClick={() => setShowInactive((prev) => !prev)}
					>
						<Filter className="mr-2 h-4 w-4" /> {showInactive ? "Hide archived" : "Show archived"}
					</Button>
					<Button onClick={openCreateDialog}>
						<Plus className="mr-2 h-4 w-4" /> Add material
					</Button>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card className="p-4">
					<p className="text-sm text-muted-foreground">Active materials</p>
					<p className="text-2xl font-bold">{metrics.active}</p>
				</Card>
				<Card className="p-4">
					<p className="text-sm text-muted-foreground">Archived</p>
					<p className="text-2xl font-bold">{metrics.inactive}</p>
				</Card>
				<Card className="p-4">
					<p className="text-sm text-muted-foreground">Suppliers tracked</p>
					<p className="text-2xl font-bold">{metrics.vendorCount}</p>
				</Card>
				<Card className="p-4">
					<p className="text-sm text-muted-foreground">Avg lead time</p>
					<p className="text-2xl font-bold">{metrics.avgLeadTime}d</p>
				</Card>
			</div>

			<div className="rounded-md border bg-card">
				<div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
					<div className="relative w-full max-w-sm">
						<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search materials or SKU"
							className="pl-9"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</div>
					<Select value={category} onValueChange={setCategory}>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="All categories" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">All categories</SelectItem>
							{categories.map((cat) => (
								<SelectItem key={cat} value={cat}>
									{cat.replace(/_/g, " ")}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<div className="flex items-center gap-3 text-muted-foreground">
							<Loader2 className="h-5 w-5 animate-spin" /> Loading materials...
						</div>
					</div>
				) : items.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
						<div className="rounded-full bg-muted p-3 text-muted-foreground">
							<Archive className="h-5 w-5" />
						</div>
						<div>
							<p className="text-lg font-semibold">No materials yet</p>
							<p className="text-sm text-muted-foreground">
								Create your first material to start tracking supplier pricing.
							</p>
						</div>
						<Button onClick={openCreateDialog}>
							<Plus className="mr-2 h-4 w-4" /> Add material
						</Button>
					</div>
				) : (
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(header.column.columnDef.header, header.getContext())}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.map((row) => (
								<TableRow key={row.id} className={cn(!row.original.isActive && "opacity-70")}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</div>

			<MaterialFormDialog
				open={dialogOpen}
				mode={dialogMode}
				initialData={editingItem ?? undefined}
				categories={categories}
				suppliers={suppliers}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) setEditingItem(null);
				}}
				onSubmit={saveMaterial}
			/>
		</div>
	);
}

