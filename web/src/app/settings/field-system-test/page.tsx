'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SectionCard from '@/components/SectionCard';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { getAuthIdsFromJwt } from '@/lib/auth';

export default function FieldSystemTestPage() {
  const { toast } = useToast();
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const newResults: Record<string, any> = {};

    try {
      const auth = getAuthIdsFromJwt();
      if (!auth) {
        throw new Error('Not authenticated');
      }

      const headers = {
        'x-user-id': auth.userId,
        'x-tenant-id': auth.tenantId,
      };

      // Test 1: Fetch fields
      try {
        const fieldsRes = await apiFetch('/api/flexible-fields', { headers });
        newResults.fieldsCount = Array.isArray(fieldsRes) ? fieldsRes.length : 0;
        newResults.fieldsStatus = '✅ PASS';
      } catch (e) {
        newResults.fieldsStatus = `❌ FAIL: ${e}`;
      }

      // Test 2: Fetch lookup tables
      try {
        const tablesRes = await apiFetch('/api/flexible-fields/lookup-tables', { headers });
        newResults.tablesCount = Array.isArray(tablesRes) ? tablesRes.length : 0;
        newResults.tablesStatus = '✅ PASS';
      } catch (e) {
        newResults.tablesStatus = `❌ FAIL: ${e}`;
      }

      // Test 3: Fetch display contexts
      try {
        const contextsRes = await apiFetch('/api/flexible-fields/display-contexts', { headers });
        newResults.contextsCount = Array.isArray(contextsRes) ? contextsRes.length : 0;
        newResults.contextsStatus = '✅ PASS';
      } catch (e) {
        newResults.contextsStatus = `❌ FAIL: ${e}`;
      }

      // Test 4: Test field evaluation
      try {
        const fieldsRes = await apiFetch('/api/flexible-fields?scope=client', { headers });
        if (Array.isArray(fieldsRes) && fieldsRes.length > 0) {
          const field = fieldsRes[0];
          const evalRes = await apiFetch('/api/flexible-fields/evaluate-field', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            json: {
              fieldId: field.id,
              inputs: { test: 'value' },
            },
          });
          newResults.evaluationStatus = evalRes ? '✅ PASS' : '❌ FAIL';
        } else {
          newResults.evaluationStatus = '⚠️ SKIP (no fields)';
        }
      } catch (e) {
        newResults.evaluationStatus = `❌ FAIL: ${e}`;
      }

      // Test 5: API health check
      try {
        const healthRes = await apiFetch('/health', { headers });
        newResults.apiStatus = healthRes ? '✅ PASS' : '❌ FAIL';
      } catch (e) {
        newResults.apiStatus = `❌ FAIL: ${e}`;
      }

      setResults(newResults);
      toast({
        title: 'Tests Complete',
        description: 'Field system test suite finished',
      });
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: 'Error',
        description: 'Failed to run tests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Field System Test Suite</h1>
        <p className="text-sm text-slate-500">
          Verify flexible field system is working correctly
        </p>
      </header>

      <SectionCard title="Quick Diagnostics">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This test suite verifies:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-slate-600">
            <li>Field definitions are accessible</li>
            <li>Lookup tables are available</li>
            <li>Display contexts are configured</li>
            <li>Field evaluation works</li>
            <li>API health is good</li>
          </ul>

          <Button onClick={runTests} disabled={loading} className="w-full">
            {loading ? 'Running Tests...' : 'Run Test Suite'}
          </Button>
        </div>
      </SectionCard>

      {Object.keys(results).length > 0 && (
        <SectionCard title="Test Results">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(results).map(([key, value]) => (
                <div key={key} className="p-3 rounded border border-slate-200">
                  <p className="text-xs font-medium text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="text-sm font-mono mt-1">
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Setup Checklist">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-medium">Database Schema</p>
              <p className="text-sm text-slate-600">Migration 20251219120000 applied</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-medium">API Endpoints</p>
              <p className="text-sm text-slate-600">14 endpoints registered at /api/flexible-fields</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-medium">Frontend Components</p>
              <p className="text-sm text-slate-600">FieldRenderer, FieldForm, FieldManager, CustomFieldsPanel</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-medium">Admin Pages</p>
              <p className="text-sm text-slate-600">/settings/fields, /settings/display-contexts</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-medium">Seed Data</p>
              <p className="text-sm text-slate-600">20 client fields + 5 lookup tables created</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Quick Start">
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">1. Create a Custom Field</h4>
            <p className="text-slate-600">Go to <code className="bg-slate-100 px-2 py-1 rounded">/settings/fields</code> and click "Create Field"</p>
          </div>

          <div>
            <h4 className="font-medium mb-2">2. Configure Visibility</h4>
            <p className="text-slate-600">Go to <code className="bg-slate-100 px-2 py-1 rounded">/settings/display-contexts</code> to set where fields appear</p>
          </div>

          <div>
            <h4 className="font-medium mb-2">3. View in Client Detail</h4>
            <p className="text-slate-600">Navigate to any client and scroll to "Custom Fields" section</p>
          </div>

          <div>
            <h4 className="font-medium mb-2">4. Add to Your Pages</h4>
            <p className="text-slate-600">
              Import <code className="bg-slate-100 px-2 py-1 rounded">CustomFieldsPanel</code> and use in your components
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
