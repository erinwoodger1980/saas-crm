import { useState, useEffect, useCallback, useRef } from 'react';
import { detectEntryMode, type EntryContext } from './entryMode';
import { fetchQuestionnaireFields, type QuestionnaireField } from '../questionnaireFields';

// Types matching the database schema
export interface PublicProjectPayload {
  propertyType?: string;
  itemCount?: number;
  timeframe?: string;
  budget?: string;
  openingDetails?: Array<{
    id: string;
    type: string;
    location?: string;
    width?: number;
    height?: number;
    images?: string[];
    notes?: string;
    inferenceSource?: 'heuristic' | 'ai' | 'depth';
    inferenceConfidence?: number;
  }>;
  inspirationImages?: string[]; // user-selected inspiration / style preference images
  globalSpecs?: {
    timberType?: string;
    glassType?: string;
    finish?: string;
    accessibility?: string[];
  };
  favouriteItemIds?: string[];
  contactDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    preferredContact?: string;
  };
}

export interface EstimatePreview {
  items: Array<{
    id: string;
    description: string;
    netGBP: number;
    vatGBP: number;
    totalGBP: number;
  }>;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  disclaimer: string;
  needsManualQuote?: boolean;
  manualQuoteReason?: string;
}

export interface TenantBranding {
  name: string;
  slug: string;
  tenantId?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  heroImageUrl?: string;
  galleryImageUrls?: string[];
  testimonials?: Array<{
    author: string;
    text: string;
    rating?: number;
  }>;
  reviewScore?: number;
  reviewCount?: number;
  reviewSourceLabel?: string;
  serviceArea?: string;
  guarantees?: Array<{ title: string; description: string }>;
  certifications?: Array<{ name: string; description: string }>;
}

export interface UsePublicEstimatorOptions {
  tenantSlug: string;
  onError?: (error: Error) => void;
}

export interface UsePublicEstimatorReturn {
  // State
  entryContext: EntryContext | null;
  branding: TenantBranding | null;
  projectId: string | null;
  data: PublicProjectPayload;
  estimatePreview: EstimatePreview | null;
  
  // Questionnaire fields
  clientFields: QuestionnaireField[];
  publicFields: QuestionnaireField[];
  isLoadingFields: boolean;
  
  // Loading states
  isLoadingBranding: boolean;
  isLoadingProject: boolean;
  isSaving: boolean;
  isLoadingEstimate: boolean;
  
  // Actions
  updateData: (updates: Partial<PublicProjectPayload>) => void;
  saveProject: () => Promise<string | null>;
  toggleFavourite: (itemId: string) => void;
  refreshEstimate: () => Promise<void>;
  trackInteraction: (type: string, metadata?: Record<string, any>) => Promise<void>;
}

import { API_BASE } from '@/lib/api-base';

export function usePublicEstimator({
  tenantSlug,
  onError,
}: UsePublicEstimatorOptions): UsePublicEstimatorReturn {
  // Entry mode detection
  const [entryContext, setEntryContext] = useState<EntryContext | null>(null);
  
  // Core state
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [data, setData] = useState<PublicProjectPayload>({});
  const [estimatePreview, setEstimatePreview] = useState<EstimatePreview | null>(null);
  
  // Questionnaire fields
  const [clientFields, setClientFields] = useState<QuestionnaireField[]>([]);
  const [publicFields, setPublicFields] = useState<QuestionnaireField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  
  // Loading states
  const [isLoadingBranding, setIsLoadingBranding] = useState(true);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);

  // Track last estimate input signature to avoid redundant refresh & flicker
  const lastEstimateInputRef = useRef<string>("__INIT__");
  
  // Refs for debouncing and tracking
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const estimateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('{}');
  
  // Detect entry mode on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const searchParams = new URLSearchParams(url.search);
      
      // Extract path segments for tenantSlug and leadId
      const pathParts = url.pathname.split('/').filter(Boolean);
      let extractedTenantSlug = tenantSlug;
      let extractedLeadId: string | undefined;
      
      // Check for /q/:tenant/:leadId pattern (INVITE mode)
      if (pathParts[0] === 'q' && pathParts[1] && pathParts[2]) {
        extractedTenantSlug = pathParts[1];
        extractedLeadId = pathParts[2];
      }
      
      const context = detectEntryMode({
        pathname: url.pathname,
        searchParams,
        tenantSlug: extractedTenantSlug,
        leadId: extractedLeadId,
      });
      
      setEntryContext(context);
      
      // If restoring from projectId, load the saved project
      if (context.projectId) {
        setProjectId(context.projectId);
      }
    }
  }, [tenantSlug]);
  
  // Stable error handler ref (prevents effect dependency churn)
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Single-flight branding loader guard
  const brandingLoadStartedRef = useRef(false);

  // Load tenant branding (single attempt + optional one retry on network failure)
  useEffect(() => {
    if (!tenantSlug) return;
    if (brandingLoadStartedRef.current) return; // prevent re-entry
    brandingLoadStartedRef.current = true;

    let cancelled = false;

    const fallbackBranding: TenantBranding = {
      name: 'Your Company',
      slug: tenantSlug,
      tenantId: undefined,
      logoUrl: undefined,
      primaryColor: undefined,
      secondaryColor: undefined,
      heroImageUrl: undefined,
      galleryImageUrls: [],
      testimonials: [],
      reviewScore: undefined,
      reviewCount: undefined,
      reviewSourceLabel: undefined,
      serviceArea: undefined,
      guarantees: [],
      certifications: [],
    };

    const normalizeDecimal = (v: any): number | undefined => {
      if (v == null) return undefined;
      if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
      if (typeof v === 'string') {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      }
      if (typeof v === 'object') {
        // Prisma Decimal has toNumber()
        const toNum = (v as any).toNumber;
        if (typeof toNum === 'function') {
          const n = toNum.call(v);
          return Number.isFinite(n) ? n : undefined;
        }
        // It might already be a plain object with 'd' or similar internal representation; ignore if unknown.
      }
      return undefined;
    };

    const normalizeInt = (v: any): number | undefined => {
      if (v == null) return undefined;
      const n = typeof v === 'number' ? v : Number(String(v));
      return Number.isInteger(n) && n >= 0 ? n : undefined;
    };

    const mapApiBranding = (raw: any): TenantBranding => ({
      name: raw?.brandName || raw?.name || 'Your Company',
      slug: raw?.slug || tenantSlug,
      tenantId: raw?.tenantId || undefined,
      logoUrl: raw?.logoUrl || undefined,
      primaryColor: raw?.primaryColor || undefined,
      secondaryColor: raw?.secondaryColor || undefined,
      heroImageUrl: raw?.heroImageUrl || undefined,
      galleryImageUrls: Array.isArray(raw?.galleryImageUrls) ? raw.galleryImageUrls : [],
      testimonials: Array.isArray(raw?.testimonials) ? raw.testimonials : [],
      reviewScore: normalizeDecimal(raw?.reviewScore),
      reviewCount: normalizeInt(raw?.reviewCount),
      reviewSourceLabel: typeof raw?.reviewSourceLabel === 'string' ? raw.reviewSourceLabel : undefined,
      serviceArea: typeof raw?.serviceArea === 'string' ? raw.serviceArea : undefined,
      guarantees: Array.isArray(raw?.guarantees) ? raw.guarantees : [],
      certifications: Array.isArray(raw?.certifications) ? raw.certifications : [],
    });

    const loadOnce = async (attempt: number) => {
      try {
        if (attempt === 0) setIsLoadingBranding(true);
        const response = await fetch(`${API_BASE}/public/tenant/${tenantSlug}/branding`);
        if (!response.ok) {
          console.warn('[branding] non-OK response', response.status, 'using fallback');
          if (!cancelled) setBranding(fallbackBranding);
          return;
        }
        const raw = await response.json();
        if (!cancelled) setBranding(mapApiBranding(raw));
      } catch (err: any) {
        console.error('[branding] fetch failed', err?.message || err);
        if (attempt < 1) {
          // one retry after short delay
          setTimeout(() => loadOnce(attempt + 1), 500);
          return;
        }
        if (!cancelled) setBranding(fallbackBranding);
        onErrorRef.current?.(err as Error);
      } finally {
        if (!cancelled) setIsLoadingBranding(false);
      }
    };

    loadOnce(0);
    return () => { cancelled = true; };
  }, [tenantSlug]);

  // Load questionnaire fields once branding is ready
  useEffect(() => {
    if (!branding || isLoadingBranding) return;

    let cancelled = false;

    const loadFields = async () => {
      try {
        setIsLoadingFields(true);

        // Fetch client and public fields in parallel
        const [client, public_] = await Promise.all([
          fetchQuestionnaireFields({ tenantSlug: branding.slug, scope: 'client', includeStandard: true }),
          fetchQuestionnaireFields({ tenantSlug: branding.slug, scope: 'public', includeStandard: true }),
        ]);

        // Filter out manufacturing and fire door specific fields from public estimator
        const excludedFields = [
          'manufacturing_start_date',
          'production_notes',
          'manufacturing_end_date',
          'installation_start_date',
          'installation_end_date',
          'installation_date',
          'timber_ordered',
          'timber_ordered_date',
          'glass_ordered',
          'glass_ordered_date',
          'hardware_ordered',
          'hardware_ordered_date',
          'finish_specification',
          'production_priority',
          'workshop_notes',
          'fire_door_certification',
          'fire_rating',
          'acoustic_rating',
          'security_rating',
          'u_value',
          'air_permeability',
          'water_tightness',
          'wind_resistance',
        ];

        const filteredPublic = public_.filter(f => !excludedFields.includes(f.key));

        if (!cancelled) {
          setClientFields(client);
          setPublicFields(filteredPublic);
        }
      } catch (error) {
        console.error('Failed to load questionnaire fields:', error);
        onErrorRef.current?.(error as Error);
      } finally {
        if (!cancelled) setIsLoadingFields(false);
      }
    };

    loadFields();
    return () => { cancelled = true; };
  }, [branding, isLoadingBranding]);
  
  // Load saved project if projectId is present
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !entryContext) return;
      
      try {
        setIsLoadingProject(true);
        const response = await fetch(`${API_BASE}/public/projects/${projectId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load project: ${response.statusText}`);
        }
        
        const project = await response.json();
        setData(project.payload || {});
        lastSavedDataRef.current = JSON.stringify(project.payload || {});
      } catch (error) {
        console.error('Failed to load project:', error);
        onError?.(error as Error);
      } finally {
        setIsLoadingProject(false);
      }
    };
    
    if (projectId && entryContext) {
      loadProject();
    }
  }, [projectId, entryContext, onError]);
  
  // Auto-save project (debounced)
  const saveProject = useCallback(async (): Promise<string | null> => {
    if (!entryContext || !branding) return null;
    
    const currentDataStr = JSON.stringify(data);
    
    // Skip if data hasn't changed
    if (currentDataStr === lastSavedDataRef.current) {
      return projectId;
    }
    
    try {
      setIsSaving(true);
      
      const response = await fetch(`${API_BASE}/public/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: branding.slug, // Will be resolved to tenantId on backend
          leadId: entryContext.leadId,
          entryMode: entryContext.entryMode,
          sourceInfo: entryContext.sourceInfo,
          payload: data,
          projectId: projectId || undefined, // Update existing if present
          needsManualQuote: estimatePreview?.needsManualQuote || false,
          manualQuoteReason: estimatePreview?.manualQuoteReason,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save project: ${response.statusText}`);
      }
      
      const savedProject = await response.json();
      const newProjectId = savedProject.id;
      
      setProjectId(newProjectId);
      lastSavedDataRef.current = currentDataStr;
      
      // Update URL with projectId for resumability
      if (typeof window !== 'undefined' && newProjectId && !projectId) {
        const url = new URL(window.location.href);
        url.searchParams.set('projectId', newProjectId);
        window.history.replaceState({}, '', url.toString());
      }
      
      return newProjectId;
    } catch (error) {
      console.error('Failed to save project:', error);
      onError?.(error as Error);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [entryContext, branding, data, projectId, estimatePreview, onError]);
  
  // Auto-save with debounce on data changes
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Broaden auto-save conditions: any meaningful data entered
    const shouldSave = Boolean(
      data.propertyType ||
      data.itemCount ||
      (data.openingDetails && data.openingDetails.length > 0) ||
      (data.globalSpecs && Object.keys(data.globalSpecs).some(k => (data.globalSpecs as any)[k])) ||
      (data.contactDetails && Object.keys(data.contactDetails).some(k => (data.contactDetails as any)[k]))
    );

    if (shouldSave) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveProject();
      }, 1500); // slightly faster debounce for better perceived persistence
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [data, saveProject]);
  
  // Refresh estimate preview (debounced)
  const refreshEstimate = useCallback(async () => {
    if (!branding || !data.openingDetails?.length) {
      // Only clear estimate if no items yet
      if (!data.openingDetails?.length) setEstimatePreview(null);
      return;
    }

    // Build input signature
    const signature = JSON.stringify({
      tenant: branding.slug,
      items: data.openingDetails.map(i => ({ id: i.id, w: i.width, h: i.height, t: i.type })),
      specs: data.globalSpecs || {},
    });

    // Skip if signature unchanged (prevents periodic flicker)
    if (signature === lastEstimateInputRef.current) return;
    lastEstimateInputRef.current = signature;

    try {
      setIsLoadingEstimate(true);
      const response = await fetch(`${API_BASE}/public/estimates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: branding.slug,
          items: data.openingDetails.map(item => ({
            description: item.type || 'Opening',
            widthMm: item.width,
            heightMm: item.height,
            openingType: item.type,
          })),
          globalSpecs: data.globalSpecs || {},
        }),
      });
      if (!response.ok) throw new Error(`Failed to load estimate: ${response.statusText}`);

      const preview = await response.json();
      const augmented = { ...preview } as any;
      // Fallback totals if API omitted aggregate fields
      try {
        if (Array.isArray(augmented.items) && augmented.items.length) {
          const sumNet = augmented.items.reduce((s: number, it: any) => s + (Number(it.netGBP) || 0), 0);
          const sumVat = augmented.items.reduce((s: number, it: any) => s + (Number(it.vatGBP) || 0), 0);
          const sumGross = augmented.items.reduce((s: number, it: any) => s + (Number(it.totalGBP) || (Number(it.netGBP)||0)+(Number(it.vatGBP)||0)), 0);
          if (!(augmented.totalNet > 0)) augmented.totalNet = sumNet;
          if (!(augmented.totalVat > 0)) augmented.totalVat = sumVat;
          if (!(augmented.totalGross > 0)) augmented.totalGross = sumGross;
        }
      } catch {}
      try {
        const gross = Number(preview.totalGross || preview.totalNet || 0);
        const lineCount = Array.isArray(preview.items) ? preview.items.length : 0;
        if (gross > 250_000 || lineCount > 120) {
          augmented.needsManualQuote = true;
          augmented.manualQuoteReason = gross > 250_000
            ? 'Estimate exceeds automated threshold (£250k+). Manual review recommended.'
            : 'High item complexity (120+ line items). Manual review recommended.';
          augmented.disclaimer = `${preview.disclaimer || ''}\nThis project is flagged for manual review due to scale/complexity.`.trim();
        }
      } catch {}
      setEstimatePreview(augmented);
    } catch (error) {
      console.error('Failed to load estimate:', error);
      onError?.(error as Error);
    } finally {
      setIsLoadingEstimate(false);
    }
  }, [branding, data.openingDetails, data.globalSpecs, onError]);
  
  // Auto-refresh estimate with debounce when relevant data changes
  useEffect(() => {
    if (estimateTimerRef.current) {
      clearTimeout(estimateTimerRef.current);
    }
    
    if (data.openingDetails?.length || data.globalSpecs) {
      estimateTimerRef.current = setTimeout(() => {
        refreshEstimate();
      }, 1000); // 1 second debounce
    }
    
    return () => {
      if (estimateTimerRef.current) {
        clearTimeout(estimateTimerRef.current);
      }
    };
  }, [data.openingDetails, data.globalSpecs, refreshEstimate]);
  
  // Update data
  const updateData = useCallback((updates: Partial<PublicProjectPayload>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Toggle favourite
  const toggleFavourite = useCallback((itemId: string) => {
    setData(prev => {
      const currentFavs = prev.favouriteItemIds || [];
      const isFavourite = currentFavs.includes(itemId);
      
      return {
        ...prev,
        favouriteItemIds: isFavourite
          ? currentFavs.filter(id => id !== itemId)
          : [...currentFavs, itemId],
      };
    });
  }, []);
  
  // Track interaction event
  const trackInteraction = useCallback(async (
    type: string,
    metadata?: Record<string, any>
  ) => {
    if (!projectId || !entryContext) return;
    
    try {
      await fetch(`${API_BASE}/public/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          leadId: entryContext.leadId,
          type,
          metadata,
        }),
      });
    } catch (error) {
      console.error('Failed to track interaction:', error);
      // Don't throw - tracking failures shouldn't break UX
    }
  }, [projectId, entryContext]);
  
  return {
    entryContext,
    branding,
    projectId,
    data,
    estimatePreview,
    clientFields,
    publicFields,
    isLoadingFields,
    isLoadingBranding,
    isLoadingProject,
    isSaving,
    isLoadingEstimate,
    updateData,
    saveProject,
    toggleFavourite,
    refreshEstimate,
    trackInteraction,
  };
}
