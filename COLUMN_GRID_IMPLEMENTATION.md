# Column Grid System Implementation Guide

## Overview
Refactor leads and opportunities pages to use a customizable table grid system similar to the Fire Door Schedule, with per-tab column configuration.

## Phase 1: Database & API Updates

### 1.1 Add COMPLETED status for opportunities
**File**: `api/prisma/schema.prisma`
```prisma
enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  DISQUALIFIED
  INFO_REQUESTED
  REJECTED
  READY_TO_QUOTE
  QUOTE_SENT
  WON
  LOST
  COMPLETED  // Add this
}
```

**Migration**: Run `npx prisma migrate dev --name add_completed_status`

### 1.2 Update API routes
**File**: `api/src/routes/leads.ts` and `api/src/routes/opportunities.ts`
- Add COMPLETED to status filters
- Ensure all Lead fields are returned in API responses

## Phase 2: Column Configuration System

### 2.1 Create ColumnConfigModal ✅ (DONE)
**File**: `web/src/components/ColumnConfigModal.tsx`
- Drag-and-drop reordering
- Toggle visibility per column
- Freeze columns
- Search/filter available fields
- Per-tab configuration support

### 2.2 Define available fields for Leads
**File**: `web/src/app/leads/leadFields.ts` (NEW)
```typescript
export const LEAD_AVAILABLE_FIELDS = [
  { field: 'id', label: 'ID', type: 'string' },
  { field: 'contactName', label: 'Contact Name', type: 'string' },
  { field: 'email', label: 'Email', type: 'email' },
  { field: 'phone', label: 'Phone', type: 'phone' },
  { field: 'status', label: 'Status', type: 'status' },
  { field: 'estimatedValue', label: 'Estimated Value', type: 'currency' },
  { field: 'quotedValue', label: 'Quoted Value', type: 'currency' },
  { field: 'dateQuoteSent', label: 'Date Quote Sent', type: 'date' },
  { field: 'capturedAt', label: 'Captured At', type: 'date' },
  { field: 'description', label: 'Description', type: 'text' },
  { field: 'quoteStatus', label: 'Quote Status', type: 'string' },
  // Add all custom fields dynamically from lead.custom
];
```

### 2.3 Column config persistence
**File**: `web/src/lib/columnConfig.ts` (NEW)
```typescript
export type ColumnConfig = {
  field: string;
  label: string;
  visible: boolean;
  width?: number;
  frozen?: boolean;
};

export type TableColumnConfig = {
  [tabKey: string]: ColumnConfig[];
};

export function getColumnConfig(tableKey: string, tabKey: string): ColumnConfig[] {
  const stored = localStorage.getItem(`column-config:${tableKey}`);
  if (!stored) return getDefaultColumns(tableKey, tabKey);
  const parsed = JSON.parse(stored);
  return parsed[tabKey] || getDefaultColumns(tableKey, tabKey);
}

export function saveColumnConfig(tableKey: string, tabKey: string, config: ColumnConfig[]) {
  const stored = localStorage.getItem(`column-config:${tableKey}`);
  const parsed = stored ? JSON.parse(stored) : {};
  parsed[tabKey] = config;
  localStorage.setItem(`column-config:${tableKey}`, JSON.stringify(parsed));
}

function getDefaultColumns(tableKey: string, tabKey: string): ColumnConfig[] {
  // Return sensible defaults per table/tab
  if (tableKey === 'leads') {
    return [
      { field: 'contactName', label: 'Contact Name', visible: true, frozen: true, width: 200 },
      { field: 'email', label: 'Email', visible: true, width: 200 },
      { field: 'phone', label: 'Phone', visible: true, width: 150 },
      { field: 'estimatedValue', label: 'Est. Value', visible: true, width: 120 },
      { field: 'capturedAt', label: 'Captured', visible: true, width: 120 },
    ];
  }
  // Similar for opportunities
  return [];
}
```

## Phase 3: Refactor Leads Page

### 3.1 Replace card view with table grid
**File**: `web/src/app/leads/page.tsx`

Key changes:
1. Import Fire Door Schedule table structure as template
2. Add column configuration state:
   ```typescript
   const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([]);
   const [showColumnConfig, setShowColumnConfig] = useState(false);
   ```

3. Load config per tab:
   ```typescript
   useEffect(() => {
     const config = getColumnConfig('leads', tab);
     setColumnConfig(config);
   }, [tab]);
   ```

4. Render table with frozen columns:
   ```tsx
   <div className="relative overflow-auto max-h-[calc(100vh-260px)]">
     <table className="min-w-full text-sm border-separate">
       <thead>
         <tr className="sticky top-0 z-[200] bg-white">
           {columnConfig.filter(c => c.visible).map((col, idx) => {
             const isFrozen = col.frozen;
             const leftOffset = calculateLeftOffset(idx, columnConfig);
             return (
               <th
                 key={col.field}
                 className={`px-4 py-3 text-left ${isFrozen ? 'sticky z-[210] bg-white' : 'bg-white'}`}
                 style={isFrozen ? { left: `${leftOffset}px`, minWidth: `${col.width}px` } : { minWidth: `${col.width}px` }}
               >
                 {col.label}
               </th>
             );
           })}
         </tr>
       </thead>
       <tbody>
         {filteredLeads.map(lead => (
           <tr key={lead.id} className="hover:bg-blue-50/40 border-b">
             {columnConfig.filter(c => c.visible).map((col, idx) => {
               const isFrozen = col.frozen;
               const leftOffset = calculateLeftOffset(idx, columnConfig);
               return (
                 <td
                   key={col.field}
                   className={`px-4 py-3 ${isFrozen ? 'sticky z-[150] bg-white' : ''}`}
                   style={isFrozen ? { left: `${leftOffset}px` } : undefined}
                   onClick={() => openLead(lead)}
                 >
                   {renderCell(lead, col.field, col.label)}
                 </td>
               );
             })}
           </tr>
         ))}
       </tbody>
     </table>
   </div>
   ```

5. Add column config button:
   ```tsx
   <Button onClick={() => setShowColumnConfig(true)}>
     <Settings className="w-4 h-4 mr-2" />
     Configure Columns
   </Button>
   ```

6. Render cell values:
   ```typescript
   function renderCell(lead: Lead, field: string, label: string) {
     const value = field.startsWith('custom.') 
       ? lead.custom?.[field.replace('custom.', '')]
       : (lead as any)[field];

     // Handle different types
     if (field === 'status') return <StatusBadge status={value} />;
     if (field.includes('Value')) return formatCurrency(value);
     if (field.includes('date') || field.includes('At')) return formatDate(value);
     if (field === 'email') return <a href={`mailto:${value}`}>{value}</a>;
     if (field === 'phone') return <a href={`tel:${value}`}>{value}</a>;
     
     return value || '—';
   }
   ```

## Phase 4: Refactor Opportunities Page

### 4.1 Update status tabs
**File**: `web/src/app/opportunities/page.tsx`

Replace:
```typescript
type LeadStatus = "QUOTE_SENT" | "WON" | "LOST";
```

With:
```typescript
type LeadStatus = "QUOTE_SENT" | "WON" | "COMPLETED" | "LOST";

const STATUS_LABELS: Record<LeadStatus, string> = {
  QUOTE_SENT: "Quote sent",
  WON: "Won",
  COMPLETED: "Completed",
  LOST: "Lost",
};
```

### 4.2 Apply same table grid pattern
Follow the same structure as leads page with:
- Column configuration per tab
- Frozen columns
- Custom field rendering
- Click to open lead modal

## Phase 5: Move completed projects

### 5.1 Add migration endpoint
**File**: `api/src/routes/opportunities.ts`
```typescript
router.post('/migrate-completed', async (req, res) => {
  const tenantId = resolveTenantId(req);
  // Find all WON leads that are marked as complete in project tracking
  const completed = await prisma.lead.findMany({
    where: {
      tenantId,
      status: 'WON',
      // Add your completion criteria (e.g., project.status === 'DELIVERED')
    }
  });

  // Update to COMPLETED status
  await prisma.lead.updateMany({
    where: {
      id: { in: completed.map(l => l.id) }
    },
    data: {
      status: 'COMPLETED'
    }
  });

  res.json({ migrated: completed.length });
});
```

### 5.2 Trigger from Fire Door Schedule
When a project is marked as delivered/complete, update the corresponding lead:
```typescript
if (project.jobLocation === 'COMPLETE & DELIVERED' && project.leadId) {
  await prisma.lead.update({
    where: { id: project.leadId },
    data: { status: 'COMPLETED' }
  });
}
```

## Phase 6: Testing & Polish

1. Test column reordering via drag-and-drop
2. Test frozen columns during horizontal scroll
3. Test per-tab configuration persistence
4. Test adding/removing columns
5. Test custom field rendering
6. Verify status migration for completed projects
7. Add loading states and error handling
8. Add empty states for tables with no data

## Implementation Priority

1. ✅ ColumnConfigModal component (DONE)
2. Add COMPLETED status to schema + migrate
3. Create column config utilities
4. Refactor leads page to table grid
5. Refactor opportunities page to table grid
6. Implement project completion migration
7. Test and polish

## Notes

- Keep the existing modal for detailed lead view
- Table rows should be clickable to open LeadModal
- Maintain existing search/filter functionality
- Consider adding export to CSV functionality
- Add keyboard shortcuts for column config (e.g., Cmd+K)
