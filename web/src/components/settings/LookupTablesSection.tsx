'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Save, X, Table as TableIcon, Database, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface LookupTable {
  id: string;
  name: string;
  description: string | null;
  columns: any;
  rows: any;
  isStandard: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TableFormData {
  name: string;
  description: string;
  columns: string[];
  rows: Record<string, any>[];
}

const emptyFormData: TableFormData = {
  name: '',
  description: '',
  columns: [],
  rows: []
};

export function LookupTablesSection() {
  const importInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [tables, setTables] = useState<LookupTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<TableFormData>(emptyFormData);
  const [error, setError] = useState<string | null>(null);
  const [busyTableId, setBusyTableId] = useState<string | null>(null);
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/flexible-fields/lookup-tables', {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to fetch lookup tables');
      }

      const data = await res.json();
      setTables(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching tables:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      columns: ['column1'],
      rows: [{}]
    });
  };

  const handleEdit = (table: LookupTable) => {
    setEditingId(table.id);
    setIsCreating(false);
    setFormData({
      name: table.name,
      description: table.description || '',
      columns: Array.isArray(table.columns) ? table.columns : [],
      rows: Array.isArray(table.rows) ? table.rows : []
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData(emptyFormData);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        columns: formData.columns,
        rows: formData.rows
      };

      let res;
      if (isCreating) {
        res = await fetch('/api/flexible-fields/lookup-tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else if (editingId) {
        res = await fetch(`/api/flexible-fields/lookup-tables/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      if (!res?.ok) {
        const errorData = await res!.json();
        throw new Error(errorData.error || 'Failed to save');
      }

      await fetchTables();
      handleCancel();
    } catch (err: any) {
      setError(err.message);
      console.error('Error saving table:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lookup table?')) return;

    try {
      const res = await fetch(`/api/flexible-fields/lookup-tables/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      await fetchTables();
    } catch (err: any) {
      setError(err.message);
      console.error('Error deleting table:', err);
    }
  };

  const exportTableCsv = async (table: LookupTable) => {
    try {
      setBusyTableId(table.id);
      setError(null);

      const res = await fetch(`/api/flexible-fields/lookup-tables/${table.id}/csv`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to export CSV');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = (table.name || 'lookup-table').replace(/[^a-z0-9\-_.]+/gi, '_');
      a.href = url;
      a.download = `${baseName}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV');
    } finally {
      setBusyTableId(null);
    }
  };

  const exportTableExcel = async (table: LookupTable) => {
    try {
      setBusyTableId(table.id);
      setError(null);

      const columns = Array.isArray(table.columns) ? table.columns : [];
      const rows = Array.isArray(table.rows) ? table.rows : [];
      const data: any[][] = [columns];
      rows.forEach((row) => {
        data.push(columns.map((col) => row?.[col] ?? ''));
      });

      const sheet = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'LookupTable');

      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = (table.name || 'lookup-table').replace(/[^a-z0-9\-_.]+/gi, '_');
      a.href = url;
      a.download = `${baseName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export Excel');
    } finally {
      setBusyTableId(null);
    }
  };

  const importTableFile = async (table: LookupTable, file: File) => {
    try {
      setBusyTableId(table.id);
      setError(null);

      const lower = file.name.toLowerCase();
      const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');

      let uploadFile = file;
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = sheetName ? wb.Sheets[sheetName] : null;
        const rows = sheet ? (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]) : [];
        if (!rows.length) throw new Error('Excel file is empty');

        const escapeCsv = (value: any) => {
          const s = String(value ?? '');
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };
        const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
        uploadFile = new File([csv], file.name.replace(/\.(xlsx|xls)$/i, '.csv'), { type: 'text/csv' });
      }

      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await fetch(`/api/flexible-fields/lookup-tables/${table.id}/csv-import`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        let payload: any = null;
        try {
          payload = await res.json();
        } catch {
          payload = await res.text();
        }
        throw new Error(payload?.message || payload?.error || payload || 'Failed to import CSV');
      }

      await fetchTables();
    } catch (err: any) {
      setError(err.message || 'Failed to import CSV');
    } finally {
      setBusyTableId(null);
      if (importInputRefs.current[table.id]) {
        importInputRefs.current[table.id]!.value = '';
      }
    }
  };

  const addColumn = () => {
    setFormData(prev => ({
      ...prev,
      columns: [...prev.columns, `column${prev.columns.length + 1}`]
    }));
  };

  const removeColumn = (index: number) => {
    const columnName = formData.columns[index];
    setFormData(prev => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index),
      rows: prev.rows.map(row => {
        const { [columnName]: _, ...rest } = row;
        return rest;
      })
    }));
  };

  const updateColumnName = (index: number, newName: string) => {
    const oldName = formData.columns[index];
    setFormData(prev => ({
      ...prev,
      columns: prev.columns.map((col, i) => i === index ? newName : col),
      rows: prev.rows.map(row => {
        if (oldName === newName) return row;
        const { [oldName]: value, ...rest } = row;
        return { ...rest, [newName]: value };
      })
    }));
  };

  const addRow = () => {
    const newRow: Record<string, any> = {};
    formData.columns.forEach(col => {
      newRow[col] = '';
    });
    setFormData(prev => ({
      ...prev,
      rows: [...prev.rows, newRow]
    }));
  };

  const removeRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index)
    }));
  };

  const updateCell = (rowIndex: number, columnName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      rows: prev.rows.map((row, i) => 
        i === rowIndex ? { ...row, [columnName]: value } : row
      )
    }));
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <div className="text-gray-500">Loading lookup tables...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="h-6 w-6" />
            Lookup Tables
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage pricing and reference data tables used in formula calculations and dropdowns
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Table
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {isCreating && (
        <div className="mb-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Create New Lookup Table</h2>
          <TableForm
            formData={formData}
            onUpdate={setFormData}
            onSave={handleSave}
            onCancel={handleCancel}
            onAddColumn={addColumn}
            onRemoveColumn={removeColumn}
            onUpdateColumnName={updateColumnName}
            onAddRow={addRow}
            onRemoveRow={removeRow}
            onUpdateCell={updateCell}
          />
        </div>
      )}

      <div className="space-y-4">
        {tables.map((table) => (
          <div key={table.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between p-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <TableIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{table.name}</h3>
                    {table.description && (
                      <p className="text-sm text-gray-600">{table.description}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>{Array.isArray(table.columns) ? table.columns.length : 0} columns</span>
                  <span>{Array.isArray(table.rows) ? table.rows.length : 0} rows</span>
                  {table.isStandard && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">Standard</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setExpandedTableId(expandedTableId === table.id ? null : table.id)}
                  className="rounded px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  {expandedTableId === table.id ? 'Hide Data' : 'View Data'}
                </button>
                {!table.isStandard && (
                  <>
                    <button
                      onClick={() => handleEdit(table)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(table.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {editingId === table.id && (
              <div className="border-t border-gray-200 bg-gray-50 p-4">
                <TableForm
                  formData={formData}
                  onUpdate={setFormData}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onAddColumn={addColumn}
                  onRemoveColumn={removeColumn}
                  onUpdateColumnName={updateColumnName}
                  onAddRow={addRow}
                  onRemoveRow={removeRow}
                  onUpdateCell={updateCell}
                />
              </div>
            )}

            {expandedTableId === table.id && editingId !== table.id && (
              <div className="border-t border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => exportTableCsv(table)}
                    disabled={busyTableId === table.id}
                    className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    title="Export this table as CSV"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => exportTableExcel(table)}
                    disabled={busyTableId === table.id}
                    className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    title="Export this table as Excel"
                  >
                    <Download className="h-4 w-4" />
                    Export Excel
                  </button>

                  {!table.isStandard && (
                    <>
                      <input
                        type="file"
                        accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel"
                        className="hidden"
                        ref={(el) => {
                          importInputRefs.current[table.id] = el;
                        }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          importTableFile(table, f);
                        }}
                      />
                      <button
                        onClick={() => importInputRefs.current[table.id]?.click()}
                        disabled={busyTableId === table.id}
                        className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        title="Import CSV or Excel (upserts by first column, adds new columns)"
                      >
                        <Upload className="h-4 w-4" />
                        Import CSV/Excel
                      </button>
                    </>
                  )}
                </div>
                <DataTable
                  columns={Array.isArray(table.columns) ? table.columns : []}
                  rows={Array.isArray(table.rows) ? table.rows : []}
                />
              </div>
            )}
          </div>
        ))}

        {tables.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <Database className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No lookup tables</h3>
            <p className="mt-2 text-sm text-gray-600">
              Create your first lookup table to store pricing or reference data
            </p>
            <button
              onClick={handleCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create Table
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface TableFormProps {
  formData: TableFormData;
  onUpdate: (data: TableFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddColumn: () => void;
  onRemoveColumn: (index: number) => void;
  onUpdateColumnName: (index: number, name: string) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onUpdateCell: (rowIndex: number, columnName: string, value: any) => void;
}

function TableForm({
  formData,
  onUpdate,
  onSave,
  onCancel,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumnName,
  onAddRow,
  onRemoveRow,
  onUpdateCell
}: TableFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Table Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onUpdate({ ...formData, name: e.target.value })}
            placeholder="e.g., MaterialPricing, DoorPricing"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => onUpdate({ ...formData, description: e.target.value })}
            placeholder="Optional description"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Columns</label>
          <button
            onClick={onAddColumn}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Column
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.columns.map((col, index) => (
            <div key={index} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1">
              <input
                type="text"
                value={col}
                onChange={(e) => onUpdateColumnName(index, e.target.value)}
                className="w-32 bg-transparent border-none text-sm focus:outline-none"
              />
              <button
                onClick={() => onRemoveColumn(index)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Data Rows</label>
          <button
            onClick={onAddRow}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Row
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                {formData.columns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {col}
                  </th>
                ))}
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {formData.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {formData.columns.map((col) => (
                    <td key={col} className="px-3 py-2">
                      <input
                        type="text"
                        value={row[col] || ''}
                        onChange={(e) => onUpdateCell(rowIndex, col, e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onRemoveRow(rowIndex)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <X className="inline h-4 w-4 mr-1" />
          Cancel
        </button>
        <button
          onClick={onSave}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Save className="inline h-4 w-4 mr-1" />
          Save Table
        </button>
      </div>
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: Record<string, any>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {row[col] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                No data rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
