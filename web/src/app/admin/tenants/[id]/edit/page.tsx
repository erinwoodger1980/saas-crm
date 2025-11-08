'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import HeroEditor from '@/components/admin/editors/HeroEditor';
import GalleryEditor from '@/components/admin/editors/GalleryEditor';
import ReviewsEditor from '@/components/admin/editors/ReviewsEditor';
import GuaranteesEditor from '@/components/admin/editors/GuaranteesEditor';
import PreviewPanel from '@/components/admin/PreviewPanel';
import { apiFetch } from '@/lib/api';

interface LandingTenantData {
  id: string;
  tenantId: string;
  tenant: {
    name: string;
    slug: string;
  };
  headline: string | null;
  subhead: string | null;
  urgencyBanner: string | null;
  ctaText: string | null;
  guarantees: any;
  publishedAt: string | null;
  images: any[];
  reviews: any[];
}

export default function EditTenantPage() {
  const params = useParams();
  const [tenant, setTenant] = useState<LandingTenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [headline, setHeadline] = useState('');
  const [subhead, setSubhead] = useState('');
  const [urgencyBanner, setUrgencyBanner] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [guarantees, setGuarantees] = useState<any>([]);
  const [images, setImages] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    async function fetchTenant() {
      try {
        const data = await apiFetch<LandingTenantData>(`/admin/landing-tenants/${params.id}`);
        setTenant(data);
        // Initialize form state
        setHeadline(data.headline || '');
        setSubhead(data.subhead || '');
        setUrgencyBanner(data.urgencyBanner || '');
        setCtaText(data.ctaText || 'Get Your Free Quote');
        setGuarantees(data.guarantees || []);
        setImages(data.images || []);
        setReviews(data.reviews || []);
      } catch (error) {
        console.error('Error fetching tenant:', error);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchTenant();
    }
  }, [params.id]);

  // Track changes
  useEffect(() => {
    if (!tenant) return;
    
    const changed =
      headline !== (tenant.headline || '') ||
      subhead !== (tenant.subhead || '') ||
      urgencyBanner !== (tenant.urgencyBanner || '') ||
      ctaText !== (tenant.ctaText || 'Get Your Free Quote') ||
      JSON.stringify(guarantees) !== JSON.stringify(tenant.guarantees || []) ||
      JSON.stringify(images) !== JSON.stringify(tenant.images || []) ||
      JSON.stringify(reviews) !== JSON.stringify(tenant.reviews || []);
    
    setHasChanges(changed);
  }, [headline, subhead, urgencyBanner, ctaText, guarantees, images, reviews, tenant]);

  const handleSave = async (publish = false) => {
    setSaving(true);
    
    try {
      const payload = {
        headline,
        subhead,
        urgencyBanner,
        ctaText,
        guarantees,
        images,
        reviews,
        publish
      };

      const data = await apiFetch<LandingTenantData>(`/admin/landing-tenants/${params.id}/content`, {
        method: 'PUT',
        json: payload,
      });
      setTenant(data);
      setHasChanges(false);
      if (publish) {
        alert('✅ Published successfully!');
      } else {
        alert('✅ Draft saved!');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('❌ Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Tenant not found</h2>
          <Link href="/admin/tenants" className="text-blue-600 hover:underline">
            ← Back to tenants
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/tenants"
              className="p-2 hover:bg-gray-100 rounded transition"
              title="Back to tenants"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{tenant.tenant.name}</h1>
              <p className="text-sm text-gray-600">
                <code className="bg-gray-100 px-2 py-0.5 rounded">{tenant.tenant.slug}</code>
                {tenant.publishedAt ? (
                  <span className="ml-3 text-green-600 font-medium">✓ Published</span>
                ) : (
                  <span className="ml-3 text-yellow-600 font-medium">○ Draft</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>

            <button
              onClick={() => handleSave(false)}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Draft'}
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={18} />
              {saving ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editors */}
        <div className={`${showPreview ? 'w-1/2' : 'w-full'} overflow-y-auto p-6 space-y-6`}>
          <HeroEditor
            headline={headline}
            subhead={subhead}
            urgencyBanner={urgencyBanner}
            ctaText={ctaText}
            onHeadlineChange={setHeadline}
            onSubheadChange={setSubhead}
            onUrgencyBannerChange={setUrgencyBanner}
            onCtaTextChange={setCtaText}
          />

          <GalleryEditor
            images={images}
            onImagesChange={setImages}
            tenantId={params.id as string}
          />

          <ReviewsEditor
            reviews={reviews}
            onReviewsChange={setReviews}
          />

          <GuaranteesEditor
            guarantees={guarantees}
            onGuaranteesChange={setGuarantees}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <PreviewPanel
            tenantSlug={tenant.tenant.slug}
            _headline={headline}
            _subhead={subhead}
            _urgencyBanner={urgencyBanner}
            _ctaText={ctaText}
            _images={images}
            _reviews={reviews}
            _guarantees={guarantees}
          />
        )}
      </div>
    </div>
  );
}
