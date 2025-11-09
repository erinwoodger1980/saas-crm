'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface VerifyResponse {
  mccOk: boolean;
  customerId: string | null;
  accessOk: boolean | null;
  ga4IdPresent: boolean;
  notes: string[];
  ready: boolean;
}

interface BootstrapResult {
  success: boolean;
  customerId: string;
  budget: string;
  campaign: string;
  adGroup: string;
  ads: string[];
  keywords: string[];
  message: string;
}

interface AdminTenantOut {
  id: string;
  name: string;
  slug: string;
}

export default function AdsLinkPage() {
  const params = useParams();
  const id = params.id as string;

  const [tenant, setTenant] = useState<AdminTenantOut | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [verifyData, setVerifyData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bootstrapResult, setBootstrapResult] = useState<BootstrapResult | null>(null);

  // Bootstrap form fields
  const [landingUrl, setLandingUrl] = useState<string>('');
  const [postcode, setPostcode] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(50);
  const [dailyBudgetGBP, setDailyBudgetGBP] = useState(10);

  // Load tenant (to resolve slug from id) and initial verify data
  useEffect(() => {
    let ignore = false;
    async function loadTenant() {
      try {
        setError('');
        const data = await apiFetch<any>(`/admin/landing-tenants/${id}`);
        if (ignore) return;
        const t: AdminTenantOut = { id: data?.tenant?.id || data?.id, name: data?.tenant?.name || data?.name, slug: data?.tenant?.slug || data?.slug };
        setTenant(t);
        setLandingUrl(`https://www.joineryai.app/tenant/${t.slug}/landing`);
      } catch (e: any) {
        if (!ignore) setError(e?.message || 'Failed to load tenant');
      }
    }
    if (id) loadTenant();
    return () => { ignore = true; };
  }, [id]);

  useEffect(() => {
    if (!tenant?.slug) return;
    loadVerifyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.slug]);

  async function loadVerifyData() {
    if (!tenant?.id) return;
    try {
      setVerifying(true);
      setError('');
      const resp = await apiFetch(`/ads/tenant/${tenant.id}/verify`, { method: 'POST' });
      if (resp.error) setError(resp.error);
      setVerifyData(resp);
      if (resp.customerId) {
        setCustomerId(resp.customerId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify');
    } finally {
      setVerifying(false);
    }
  }

  async function handleSaveCustomerId() {
    if (!tenant?.id) return;
    // Validate format
    const pattern = /^\d{3}-\d{3}-\d{4}$/;
    if (!pattern.test(customerId)) {
      setError('Customer ID must be in format 123-456-7890');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const resp = await apiFetch(`/ads/tenant/${tenant.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      if (resp.error) setError(resp.error);
      else setSuccess('Customer ID saved successfully!');
      await loadVerifyData();
    } catch (err: any) {
      setError(err.message || 'Failed to save customer ID');
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap() {
    if (!tenant?.slug) return;
    if (!postcode.trim()) {
      setError('Postcode is required');
      return;
    }

    try {
      setBootstrapping(true);
      setError('');
      setSuccess('');
      setBootstrapResult(null);

      const result = await apiFetch<BootstrapResult>(`/ads/tenant/${tenant.slug}/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landingUrl,
          postcode,
          radiusMiles,
          dailyBudgetGBP,
        }),
      });

      setBootstrapResult(result);
      setSuccess(result.message);
    } catch (err: any) {
      setError(err.message || 'Failed to bootstrap campaign');
    } finally {
      setBootstrapping(false);
    }
  }

  const isReady = verifyData?.ready === true;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin/tenants"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft size={16} />
          Back to Tenants
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Google Ads Connection</h1>
        <p className="text-gray-600 mt-1">
          Tenant: <span className="font-mono font-semibold">{tenant?.slug || '...'}</span>
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-red-900 font-medium">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <Check className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-green-900 font-medium">Success</p>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      {/* Step 1: Link Customer ID */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Link Customer ID</h2>
        <p className="text-gray-600 text-sm mb-4">
          Enter the Google Ads Customer ID for this tenant. You must create the customer account manually 
          in Google Ads UI first, then paste the ID here.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="123-456-7890"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            pattern="\d{3}-\d{3}-\d{4}"
            disabled={!tenant?.slug}
          />
          <button
            onClick={handleSaveCustomerId}
            disabled={loading || !customerId || !tenant?.slug}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            Save Customer ID
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Format: 123-456-7890 (with dashes)</p>
      </div>

      {/* Step 2: Verify Access */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">2. Verify Access</h2>
          <button
            onClick={loadVerifyData}
            disabled={verifying || !tenant?.slug}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            {verifying && <Loader2 className="animate-spin" size={16} />}
            Verify Access
          </button>
        </div>

        {verifyData ? (
          <div className="space-y-3">
            <ChecklistItem checked={verifyData.mccOk} label="MCC environment configured" />
            <ChecklistItem checked={!!verifyData.customerId} label="Customer ID stored" detail={verifyData.customerId || undefined} />
            <ChecklistItem checked={verifyData.accessOk === true} loading={verifyData.accessOk === null} label="MCC has access to customer" />
            <ChecklistItem checked={verifyData.ga4IdPresent} label="GA4 tracking ID configured (optional)" />

            {verifyData.notes.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-semibold text-gray-700 mb-2">Details:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {verifyData.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Click "Verify Access" to check readiness</p>
        )}
      </div>

      {/* Step 3: Bootstrap Campaign */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Bootstrap Campaign</h2>
        <p className="text-gray-600 text-sm mb-4">
          Create a complete Search campaign with ads, keywords, and negative keywords. 
          The campaign will be created in PAUSED state for your review.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Landing URL</label>
            <input
              type="url"
              value={landingUrl}
              onChange={(e) => setLandingUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!isReady}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
              <input
                type="text"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="TN22 1AA"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!isReady}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Radius (miles)</label>
              <input
                type="number"
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!isReady}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Daily Budget (£)</label>
              <input
                type="number"
                value={dailyBudgetGBP}
                onChange={(e) => setDailyBudgetGBP(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!isReady}
              />
            </div>
          </div>

          <button
            onClick={handleBootstrap}
            disabled={!isReady || bootstrapping}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          >
            {bootstrapping && <Loader2 className="animate-spin" size={18} />}
            Bootstrap Campaign
          </button>

          {!isReady && (
            <p className="text-sm text-amber-600 text-center">⚠️ Complete verification steps above before bootstrapping</p>
          )}
        </div>

        {bootstrapResult && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="font-semibold text-blue-900 mb-2">Campaign Created!</p>
            <div className="text-xs text-blue-800 space-y-1 font-mono">
              <div><strong>Customer:</strong> {bootstrapResult.customerId}</div>
              <div><strong>Campaign:</strong> {bootstrapResult.campaign}</div>
              <div><strong>Ad Group:</strong> {bootstrapResult.adGroup}</div>
              <div><strong>Ads:</strong> {bootstrapResult.ads.length} created</div>
              <div><strong>Keywords:</strong> {bootstrapResult.keywords.length} added</div>
            </div>
            <p className="text-sm text-blue-700 mt-3">🎉 Review your campaign in Google Ads and enable it when ready!</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChecklistItemProps {
  checked: boolean;
  label: string;
  detail?: string;
  loading?: boolean;
}

function ChecklistItem({ checked, label, detail, loading }: ChecklistItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
      <div className="flex-shrink-0 mt-0.5">
        {loading ? (
          <Loader2 className="text-gray-400 animate-spin" size={18} />
        ) : checked ? (
          <Check className="text-green-600" size={18} />
        ) : (
          <X className="text-red-500" size={18} />
        )}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${checked ? 'text-gray-900' : 'text-gray-600'}`}>{label}</p>
        {detail && <p className="text-xs text-gray-500 font-mono mt-1">{detail}</p>}
      </div>
    </div>
  );
}
