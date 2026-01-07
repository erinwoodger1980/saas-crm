'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridOptions, GridApi, ValueFormatterParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { FireDoorRFIPanel } from '@/components/FireDoorRFIPanel';
import { MessageSquare } from 'lucide-react';

interface FireDoorLineItem {
  id: string;
  mjsNumber: string | null;
  doorRef: string | null;
  location: string | null;
  clientOrderNo: string | null;
  masterLeafWidth: number | null;
  slaveLeafWidth: number | null;
  leafHeight: number | null;
  frameWidth: number | null;
  frameHeight: number | null;
  leafThickness: number | null;
  fireRating: string | null;
  coreType: string | null;
  certification: string | null;
  intumescentType: string | null;
  lippingMaterial: string | null;
  doorFacing: string | null;
  frameMaterial: string | null;
  glassType: string | null;
  hingeType: string | null;
  lockType: string | null;
  closerType: string | null;
  sealsType: string | null;
  materialsCost: number | null;
  labourCost: number | null;
  totalCost: number | null;
  sellPrice: number | null;
  productionStatus: string | null;
  deliveryDate: string | null;
  lajClientComments: string | null;
  clientComments: string | null;
  qrCodes: string | null;
  projectId: string;
}

interface RFI {
  id: string;
  field: string;
  question: string;
  status: 'open' | 'answered' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  response?: string | null;
}

export default function FireDoorsPage() {
  const [rowData, setRowData] = useState<FireDoorLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rfis, setRfis] = useState<Record<string, RFI[]>>({});
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projects, setProjects] = useState<Array<{ id: string; projectName: string }>>([]);
  const [showRFIPanel, setShowRFIPanel] = useState(false);
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | undefined>(undefined);
  
  const gridRef = useRef<AgGridReact>(null);

  // Fetch projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/fire-door-schedule', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const projectList = data.projects.map((p: any) => ({
            id: p.id,
            projectName: `${p.mjsNumber || 'No MJS'} - ${p.jobName || 'Unnamed'}`,
          }));
          setProjects(projectList);
          if (projectList.length > 0) {
            setSelectedProject(projectList[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    }
    fetchProjects();
  }, []);

  // Fetch fire door line items
  useEffect(() => {
    if (!selectedProject) return;

    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/fire-door-schedule/items?projectId=${selectedProject}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setRowData(data);
          
          // Fetch RFIs for all line items
          const rfiRes = await fetch(`/api/fire-door-rfis?projectId=${selectedProject}`, {
            credentials: 'include',
          });
          if (rfiRes.ok) {
            const rfiData = await rfiRes.json();
            // Group RFIs by line item ID
            const grouped = rfiData.reduce((acc: Record<string, RFI[]>, rfi: any) => {
              const lineItemId = rfi.fireDoorLineItemId;
              if (!acc[lineItemId]) acc[lineItemId] = [];
              acc[lineItemId].push(rfi);
              return acc;
            }, {});
            setRfis(grouped);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedProject]);

  // RFI Badge Renderer
  const RFIBadgeRenderer = (params: any) => {
    const lineItemId = params.data?.id;
    const lineItemRfis = rfis[lineItemId] || [];
    const openCount = lineItemRfis.filter(r => r.status === 'open').length;
    
    if (openCount === 0) return null;
    
    const urgentCount = lineItemRfis.filter(r => r.status === 'open' && r.priority === 'urgent').length;
    const highCount = lineItemRfis.filter(r => r.status === 'open' && r.priority === 'high').length;
    
    return (
      <div className="flex gap-1">
        {urgentCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded">
            {urgentCount} Urgent
          </span>
        )}
        {highCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-800 rounded">
            {highCount} High
          </span>
        )}
        {openCount - urgentCount - highCount > 0 && (
          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
            {openCount - urgentCount - highCount} Open
          </span>
        )}
      </div>
    );
  };

  // Column definitions with sections
  const columnDefs: ColDef[] = useMemo(() => [
    // Identification Section
    {
      headerName: 'Identification',
      children: [
        {
          field: 'mjsNumber',
          headerName: 'MJS Number',
          pinned: 'left',
          width: 120,
          editable: true,
          filter: 'agTextColumnFilter',
        },
        {
          field: 'doorRef',
          headerName: 'Door Ref',
          pinned: 'left',
          width: 120,
          editable: true,
          filter: 'agTextColumnFilter',
        },
        {
          field: 'location',
          headerName: 'Location',
          width: 150,
          editable: true,
          filter: 'agTextColumnFilter',
        },
        {
          field: 'clientOrderNo',
          headerName: 'Client Order',
          width: 130,
          editable: true,
          filter: 'agTextColumnFilter',
        },
      ],
    },
    
    // Dimensions Section
    {
      headerName: 'Dimensions',
      children: [
        {
          field: 'masterLeafWidth',
          headerName: 'Master Width',
          width: 120,
          editable: true,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `${params.value}mm` : '',
        },
        {
          field: 'slaveLeafWidth',
          headerName: 'Slave Width',
          width: 120,
          editable: true,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `${params.value}mm` : '',
        },
        {
          field: 'leafHeight',
          headerName: 'Height',
          width: 100,
          editable: true,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `${params.value}mm` : '',
        },
        {
          field: 'frameWidth',
          headerName: 'Frame Width',
          width: 120,
          editable: true,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `${params.value}mm` : '',
        },
        {
          field: 'frameHeight',
          headerName: 'Frame Height',
          width: 120,
          editable: true,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `${params.value}mm` : '',
        },
        {
          field: 'leafThickness',
          headerName: 'Thickness',
          width: 100,
          editable: true,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `${params.value}mm` : '',
        },
      ],
    },
    
    // Fire Specification Section
    {
      headerName: 'Fire Specification',
      children: [
        {
          field: 'fireRating',
          headerName: 'Fire Rating',
          width: 120,
          editable: true,
          filter: 'agSetColumnFilter',
        },
        {
          field: 'coreType',
          headerName: 'Core Type',
          width: 150,
          editable: true,
          filter: 'agSetColumnFilter',
        },
        {
          field: 'certification',
          headerName: 'Certification',
          width: 150,
          editable: true,
          filter: 'agTextColumnFilter',
        },
        {
          field: 'intumescentType',
          headerName: 'Intumescent',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
      ],
    },
    
    // Materials Section
    {
      headerName: 'Materials',
      children: [
        {
          field: 'lippingMaterial',
          headerName: 'Lipping',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
        {
          field: 'doorFacing',
          headerName: 'Facing',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
        {
          field: 'frameMaterial',
          headerName: 'Frame',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
        {
          field: 'glassType',
          headerName: 'Glass',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
      ],
    },
    
    // Ironmongery Section
    {
      headerName: 'Ironmongery',
      children: [
        {
          field: 'hingeType',
          headerName: 'Hinges',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
        {
          field: 'lockType',
          headerName: 'Lock',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
        {
          field: 'closerType',
          headerName: 'Closer',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
        {
          field: 'sealsType',
          headerName: 'Seals',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
      ],
    },
    
    // Pricing Section
    {
      headerName: 'Pricing',
      children: [
        {
          field: 'materialsCost',
          headerName: 'Materials',
          width: 110,
          editable: false,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `£${params.value.toFixed(2)}` : '',
        },
        {
          field: 'labourCost',
          headerName: 'Labour',
          width: 110,
          editable: false,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `£${params.value.toFixed(2)}` : '',
        },
        {
          field: 'totalCost',
          headerName: 'Total Cost',
          width: 110,
          editable: false,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `£${params.value.toFixed(2)}` : '',
        },
        {
          field: 'sellPrice',
          headerName: 'Sell Price',
          width: 110,
          editable: true,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: ValueFormatterParams) => params.value ? `£${params.value.toFixed(2)}` : '',
        },
      ],
    },
    
    // Production Section
    {
      headerName: 'Production',
      children: [
        {
          field: 'productionStatus',
          headerName: 'Status',
          width: 130,
          editable: true,
          filter: 'agSetColumnFilter',
        },
        {
          field: 'deliveryDate',
          headerName: 'Delivery',
          width: 120,
          editable: true,
          filter: 'agDateColumnFilter',
        },
        {
          field: 'qrCodes',
          headerName: 'QR Code',
          width: 100,
          editable: false,
        },
      ],
    },
    
    // Communication Section
    {
      headerName: 'Communication',
      children: [
        {
          headerName: 'RFIs',
          width: 200,
          cellRenderer: RFIBadgeRenderer,
          filter: false,
          sortable: false,
        },
        {
          field: 'lajClientComments',
          headerName: 'LAJ Comments',
          width: 200,
          editable: true,
          filter: 'agTextColumnFilter',
          wrapText: true,
          autoHeight: true,
        },
        {
          field: 'clientComments',
          headerName: 'Client Comments',
          width: 200,
          editable: true,
          filter: 'agTextColumnFilter',
          wrapText: true,
          autoHeight: true,
        },
      ],
    },
  ], [rfis]);

  const defaultColDef: ColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    floatingFilter: true,
  }), []);

  const gridOptions: GridOptions = useMemo(() => ({
    enableRangeSelection: true,
    enableCellTextSelection: true,
    suppressMovableColumns: false,
    suppressColumnVirtualisation: false,
    rowSelection: 'multiple',
    animateRows: true,
    getContextMenuItems: (params: any) => {
      const lineItemId = params.node?.data?.id;
      const field = params.column?.getColId();
      
      if (!lineItemId || !field) return [];
      
      return [
        {
          name: `Create RFI for ${params.column?.getColDef().headerName}`,
          icon: '<span class="ag-icon ag-icon-message"></span>',
          action: () => {
            setSelectedLineItemId(lineItemId);
            setShowRFIPanel(true);
          },
        },
        'separator',
        'copy',
        'paste',
        'separator',
        'export',
      ];
    },
  }), []);

  const onCellValueChanged = useCallback(async (event: any) => {
    const { data, colDef } = event;
    const field = colDef.field;
    const newValue = data[field];

    try {
      const res = await fetch(`/api/fire-door-schedule/items/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: newValue }),
      });

      if (!res.ok) {
        console.error('Failed to update cell');
        // Optionally revert the change
      }
    } catch (error) {
      console.error('Error updating cell:', error);
    }
  }, []);

  const onExportCSV = useCallback(() => {
    gridRef.current?.api?.exportDataAsCsv();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading fire door schedule...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fire Door Schedule</h1>
            <p className="text-sm text-gray-500 mt-1">
              Spreadsheet-like interface with import/export, RFI tracking, and pricing integration
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setSelectedLineItemId(undefined);
                setShowRFIPanel(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              RFI Manager ({Object.values(rfis).flat().length})
            </button>
            <button
              onClick={onExportCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Export CSV
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Import CSV
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 p-4">
        <div className="ag-theme-alpine h-full rounded-lg shadow-lg">
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            gridOptions={gridOptions}
            onCellValueChanged={onCellValueChanged}
          />
        </div>
      </div>

      {/* RFI Panel */}
      {showRFIPanel && (
        <FireDoorRFIPanel
          projectId={selectedProject}
          lineItemId={selectedLineItemId}
          onClose={() => setShowRFIPanel(false)}
          onRFICreated={() => {
            // Refetch data to update RFI counts
            if (selectedProject) {
              fetch(`/api/fire-door-schedule/items?projectId=${selectedProject}`, {
                credentials: 'include',
              })
                .then(res => res.json())
                .then(data => setRowData(data))
                .catch(error => console.error('Error refetching:', error));
            }
          }}
        />
      )}
    </div>
  );
}
