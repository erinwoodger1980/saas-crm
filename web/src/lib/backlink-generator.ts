/**
 * Generate powered-by backlink snippet for tenants
 * 
 * Usage: Place in tenant dashboard to encourage backlinks
 */

export function generateBacklinkSnippet(tenantSlug: string, tenantName: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://joineryai.app';
  const profileUrl = `${baseUrl}/${tenantSlug}`;
  
  return `<a href="${profileUrl}" rel="dofollow" style="display:inline-flex;align-items:center;gap:8px;padding:12px 20px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;text-decoration:none;color:#111827;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:500;box-shadow:0 1px 3px rgba(0,0,0,0.1);transition:all 0.2s;" onmouseover="this.style.borderColor='#3b82f6';this.style.boxShadow='0 4px 6px rgba(59,130,246,0.1)';" onmouseout="this.style.borderColor='#e5e7eb';this.style.boxShadow='0 1px 3px rgba(0,0,0,0.1)';">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
  <span>See ${tenantName} on Joinery AI</span>
</a>`;
}

export function generateBacklinkMarkdown(tenantSlug: string, tenantName: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://joineryai.app';
  const profileUrl = `${baseUrl}/${tenantSlug}`;
  
  return `[See ${tenantName} on Joinery AI](${profileUrl})`;
}

export function generateBacklinkText(tenantSlug: string, tenantName: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://joineryai.app';
  const profileUrl = `${baseUrl}/${tenantSlug}`;
  
  return `${tenantName} - See our profile on Joinery AI: ${profileUrl}`;
}

/**
 * Generate full backlink badge (image + link)
 */
export function generateBacklinkBadge(tenantSlug: string, tenantName: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://joineryai.app';
  const profileUrl = `${baseUrl}/${tenantSlug}`;
  const badgeUrl = `${baseUrl}/api/badge/${tenantSlug}`;
  
  return `<a href="${profileUrl}" rel="dofollow">
  <img src="${badgeUrl}" alt="${tenantName} on Joinery AI" style="height:44px;" />
</a>`;
}

/**
 * Track backlink clicks for analytics
 */
export async function trackBacklinkClick(tenantId: string, referrer: string): Promise<void> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/backlink-click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        referrer,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to track backlink click:', error);
  }
}
