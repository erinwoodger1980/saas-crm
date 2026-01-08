'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import FireDoorSpreadsheet from '@/components/FireDoorSpreadsheet';
import { FireDoorRFIPanel } from '@/components/FireDoorRFIPanel';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <FireDoorsPageContent />
    </Suspense>
  );
}

function FireDoorsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams?.get?.('projectId');
  
  const [showRFIPanel, setShowRFIPanel] = useState(false);
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | undefined>(undefined);
  const [projectInfo, setProjectInfo] = useState<{ mjsNumber: string; jobName: string; fireDoorImportId: string | null } | null>(null);
  
  // Fetch project info
  useEffect(() => {
    if (!projectId) return;

    async function fetchProjectInfo() {
      try {
        const projectRes = await fetch(`/api/fire-door-schedule/${projectId}`, {
          credentials: 'include',
        });
        if (projectRes.ok) {
          const project = await projectRes.json();
          setProjectInfo({
            mjsNumber: project.mjsNumber || 'No MJS',
            jobName: project.jobName || 'Unnamed Project',
            fireDoorImportId: project.fireDoorImportId || null
          });
        }
      } catch (error) {
        console.error('Error fetching project info:', error);
      }
    }

    fetchProjectInfo();
  }, [projectId]);

  if (!projectId || !projectInfo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">No project selected</p>
          <button
            onClick={() => router.push('/fire-door-schedule')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-blue-900 bg-clip-text text-transparent">
                Fire Door Order Grid
              </h1>
              <p className="text-sm text-slate-600">
                {projectInfo.mjsNumber} - {projectInfo.jobName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedLineItemId(undefined);
                setShowRFIPanel(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              RFI Manager (0)
            </button>
          </div>
        </div>
      </div>

      {/* Grid - Use FireDoorSpreadsheet component with all 223 columns */}
      <div className="flex-1 overflow-hidden p-4">
        {projectInfo.fireDoorImportId ? (
          <FireDoorSpreadsheet importId={projectInfo.fireDoorImportId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-600">No fire door data available for this project</p>
          </div>
        )}
      </div>

      {/* RFI Panel */}
      {showRFIPanel && (
        <FireDoorRFIPanel
          projectId={projectId || undefined}
          lineItemId={selectedLineItemId}
          onClose={() => setShowRFIPanel(false)}
          onRFICreated={() => {
            setShowRFIPanel(false);
          }}
        />
      )}
    </div>
  );
}
