import { useState, useEffect, useCallback, useRef } from 'react';
import { detectEntryMode, type EntryContext } from './entryMode';

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
  }>;
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
}

export interface TenantBranding {
  name: string;
  slug: string;
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

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
  
  // Loading states
  const [isLoadingBranding, setIsLoadingBranding] = useState(true);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
  
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
  
  // Load tenant branding
  useEffect(() => {
    const loadBranding = async () => {
      try {
        setIsLoadingBranding(true);
        const response = await fetch(`${API_BASE}/public/tenant/${tenantSlug}/branding`);

        if (!response.ok) {
          // Fallback: continue with generic branding so estimator still loads
          console.warn('Branding request failed, using generic branding');
          setBranding({
            tenantId: null,
            slug: tenantSlug,
            brandName: 'Your Company',
            logoUrl: null,
            primaryColor: null,
            secondaryColor: null,
            questionnaire: [],
          } as any);
          return;
        }

        const brandingData = await response.json();
        setBranding(brandingData);
      } catch (error) {
        console.error('Failed to load branding:', error);
        // Fallback generic branding
        setBranding({
          tenantId: null,
          slug: tenantSlug,
          brandName: 'Your Company',
          logoUrl: null,
          primaryColor: null,
          secondaryColor: null,
          questionnaire: [],
        } as any);
        onError?.(error as Error);
      } finally {
        setIsLoadingBranding(false);
      }
    };

    if (tenantSlug) {
      loadBranding();
    }
  }, [tenantSlug, onError]);
  
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
  }, [entryContext, branding, data, projectId, onError]);
  
  // Auto-save with debounce on data changes
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Only auto-save if we have minimal data
    if (data.propertyType || data.itemCount) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveProject();
      }, 2000); // 2 second debounce
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
      setEstimatePreview(null);
      return;
    }
    
    try {
      setIsLoadingEstimate(true);
      
      const response = await fetch(`${API_BASE}/public/estimates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: branding.slug,
          items: data.openingDetails.map(item => ({
            type: item.type,
            width: item.width,
            height: item.height,
          })),
          globalSpecs: data.globalSpecs || {},
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load estimate: ${response.statusText}`);
      }
      
      const preview = await response.json();
      setEstimatePreview(preview);
    } catch (error) {
      console.error('Failed to load estimate:', error);
      onError?.(error as Error);
    } finally {
      setIsLoadingEstimate(false);
    }
  }, [branding, data, onError]);
  
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
