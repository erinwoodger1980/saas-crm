// web/src/lib/use-column-config.ts
import { useState, useEffect } from 'react';

export interface ColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  fixed: boolean;
  width: number;
  type: 'text' | 'date' | 'dropdown' | 'number' | 'email' | 'phone' | 'currency' | 'boolean';
  dropdownOptions?: string[];
  dropdownColors?: Record<string, string>;
  order: number;
}

export interface StatusColumnConfig {
  status: string;
  columns: ColumnConfig[];
}

const DEFAULT_COLUMNS: Record<string, ColumnConfig[]> = {
  leads: [
    { field: 'contactName', label: 'Contact Name', visible: true, fixed: true, width: 200, type: 'text', order: 0 },
    { field: 'email', label: 'Email', visible: true, fixed: false, width: 200, type: 'email', order: 1 },
    { field: 'phone', label: 'Phone', visible: true, fixed: false, width: 150, type: 'phone', order: 2 },
    { field: 'source', label: 'Source', visible: true, fixed: false, width: 150, type: 'text', order: 3 },
    { field: 'nextAction', label: 'Next Action', visible: true, fixed: false, width: 200, type: 'text', order: 4 },
    { field: 'nextActionAt', label: 'Next Action Date', visible: true, fixed: false, width: 150, type: 'date', order: 5 },
  ],
  opportunities: [
    { field: 'title', label: 'Title', visible: true, fixed: true, width: 250, type: 'text', order: 0 },
    { field: 'contactName', label: 'Contact', visible: true, fixed: false, width: 200, type: 'text', order: 1 },
    { field: 'value', label: 'Value', visible: true, fixed: false, width: 120, type: 'currency', order: 2 },
    { field: 'closeDate', label: 'Close Date', visible: true, fixed: false, width: 150, type: 'date', order: 3 },
    { field: 'probability', label: 'Probability', visible: true, fixed: false, width: 100, type: 'number', order: 4 },
  ],
};

export function useColumnConfig(pageType: 'leads' | 'opportunities', currentStatus: string) {
  const storageKey = `${pageType}-column-config-${currentStatus}`;
  
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLUMNS[pageType];
    
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse column config:', e);
      }
    }
    return DEFAULT_COLUMNS[pageType];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(columns));
    }
  }, [columns, storageKey]);

  const updateColumn = (field: string, updates: Partial<ColumnConfig>) => {
    setColumns(cols =>
      cols.map(col =>
        col.field === field ? { ...col, ...updates } : col
      )
    );
  };

  const reorderColumns = (fromIndex: number, toIndex: number) => {
    setColumns(cols => {
      const newCols = [...cols];
      const [moved] = newCols.splice(fromIndex, 1);
      newCols.splice(toIndex, 0, moved);
      return newCols.map((col, idx) => ({ ...col, order: idx }));
    });
  };

  const resetToDefault = () => {
    setColumns(DEFAULT_COLUMNS[pageType]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
  };

  const addColumn = (newColumn: Omit<ColumnConfig, 'order'>) => {
    setColumns(cols => [
      ...cols,
      { ...newColumn, order: cols.length } as ColumnConfig
    ]);
  };

  const removeColumn = (field: string) => {
    setColumns(cols => cols.filter(col => col.field !== field));
  };

  const visibleColumns = columns.filter(col => col.visible).sort((a, b) => a.order - b.order);
  const fixedColumns = visibleColumns.filter(col => col.fixed);
  const scrollableColumns = visibleColumns.filter(col => !col.fixed);

  return {
    columns,
    visibleColumns,
    fixedColumns,
    scrollableColumns,
    updateColumn,
    reorderColumns,
    resetToDefault,
    addColumn,
    removeColumn,
    setColumns,
  };
}
