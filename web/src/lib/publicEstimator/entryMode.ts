/**
 * Entry mode detection for the public estimator/questionnaire.
 * Determines if user arrived from AD traffic or via an INVITE link,
 * and extracts source info (UTM params, leadId, token) for tracking.
 */

export type EntryMode = 'AD' | 'INVITE';

export interface SourceInfo {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string; // Google Ads click ID
  fbclid?: string; // Facebook click ID
  referrer?: string;
}

export interface EntryContext {
  entryMode: EntryMode;
  tenantSlug: string;
  leadId?: string;
  token?: string;
  projectId?: string;
  sourceInfo: SourceInfo;
}

/**
 * Parse URL query params and path to determine entry mode and context.
 * 
 * Entry patterns:
 * - AD: /estimate/:tenantSlug or /:tenantSlug (with UTM params)
 * - INVITE: /q/:tenantSlug/:leadId?token=xxx (authenticated link from tenant)
 * - RESUME: /estimate/:tenantSlug/:projectId (saved project)
 */
export function detectEntryMode(params: {
  pathname: string;
  searchParams: URLSearchParams;
  tenantSlug?: string;
  leadId?: string;
}): EntryContext {
  const { pathname, searchParams, tenantSlug = '', leadId = '' } = params;

  // Extract UTM and click tracking params
  const sourceInfo: SourceInfo = {
    utm_source: searchParams.get('utm_source') || undefined,
    utm_medium: searchParams.get('utm_medium') || undefined,
    utm_campaign: searchParams.get('utm_campaign') || undefined,
    utm_term: searchParams.get('utm_term') || undefined,
    utm_content: searchParams.get('utm_content') || undefined,
    gclid: searchParams.get('gclid') || undefined,
    fbclid: searchParams.get('fbclid') || undefined,
  };

  // Check for referrer in browser context
  if (typeof document !== 'undefined' && document.referrer) {
    sourceInfo.referrer = document.referrer;
  }

  const token = searchParams.get('token') || undefined;
  const projectId = searchParams.get('projectId') || undefined;

  // INVITE mode: has leadId + token (authenticated link from tenant)
  if (leadId && token) {
    return {
      entryMode: 'INVITE',
      tenantSlug,
      leadId,
      token,
      projectId,
      sourceInfo,
    };
  }

  // AD mode: direct landing from ads/marketing (no lead context yet)
  return {
    entryMode: 'AD',
    tenantSlug,
    projectId, // May have saved project to resume
    sourceInfo,
  };
}

/**
 * Build tracking metadata for analytics/lead interaction events.
 */
export function buildTrackingMetadata(context: EntryContext): Record<string, any> {
  const meta: Record<string, any> = {
    entryMode: context.entryMode,
    tenantSlug: context.tenantSlug,
  };

  if (context.leadId) meta.leadId = context.leadId;
  if (context.projectId) meta.projectId = context.projectId;

  // Flatten source info
  Object.entries(context.sourceInfo).forEach(([key, value]) => {
    if (value) meta[key] = value;
  });

  return meta;
}

/**
 * Check if entry context has any marketing attribution.
 */
export function hasMarketingAttribution(sourceInfo: SourceInfo): boolean {
  return !!(
    sourceInfo.utm_source ||
    sourceInfo.utm_campaign ||
    sourceInfo.gclid ||
    sourceInfo.fbclid
  );
}
