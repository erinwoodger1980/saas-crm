import { GoogleAdsApi, Customer } from 'google-ads-api';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

// Centralized logger helper (could be expanded to use a real logger later)
function logAds(msg: string, meta?: Record<string, any>) {
  if (meta) {
    console.log(`[ads] ${msg}`, JSON.stringify(meta));
  } else {
    console.log(`[ads] ${msg}`);
  }
}

const prisma = new PrismaClient();

interface GoogleAdsConfig {
  client_id: string;
  client_secret: string;
  developer_token: string;
  login_customer_id?: string; // MCC manager account ID (digits only)
}

/**
 * Google Ads API integration for keyword performance tracking
 */
export class GoogleAdsClient {
  private client: GoogleAdsApi;
  private mccLoginId?: string;

  constructor(config: GoogleAdsConfig) {
    this.mccLoginId = config.login_customer_id;
    this.client = new GoogleAdsApi({
      client_id: config.client_id,
      client_secret: config.client_secret,
      developer_token: config.developer_token,
      // Some versions of google-ads-api types don't include login_customer_id on ClientOptions.
      // We apply it on Customer creation when available.
    } as any);
  }

  /**
   * Get customer instance for a tenant
   */
  private getCustomer(customerId: string, refreshToken: string): Customer {
    // Sanitize customer ID (API expects digits-only)
    const sanitizedId = (customerId || '').replace(/-/g, '').trim();
    const opts: any = {
      customer_id: sanitizedId,
      refresh_token: refreshToken,
    };
    if (this.mccLoginId) opts.login_customer_id = this.mccLoginId;
    logAds('Creating customer handle', { originalCustomerId: customerId, sanitizedCustomerId: sanitizedId, hasRefreshToken: !!refreshToken });
    return this.client.Customer(opts);
  }

  /**
   * Fetch keyword performance for the last 7 days
   */
  async fetchKeywordPerformance(
    customerId: string,
    refreshToken: string,
    startDate: string,
    endDate: string
  ) {
    logAds('Fetching keyword performance', { 
      customerId, 
      hasRefreshToken: !!refreshToken,
      refreshTokenLength: refreshToken?.length,
      startDate, 
      endDate,
      hasMccLoginId: !!this.mccLoginId
    });

    const customer = this.getCustomer(customerId, refreshToken);

    const query = `
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros,
        metrics.ctr,
        metrics.conversions_value,
        ad_group_criterion.quality_info.quality_score
      FROM keyword_view
      WHERE
        segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status = 'ENABLED'
        AND ad_group.status = 'ENABLED'
        AND ad_group_criterion.status = 'ENABLED'
      ORDER BY metrics.impressions DESC
      LIMIT 1000
    `;

    try {
      logAds('Executing Google Ads query');
      const results = await customer.query(query);
      return results.map((row: any) => ({
        keyword: row.ad_group_criterion.keyword.text,
        matchType: row.ad_group_criterion.keyword.match_type,
        impressions: parseInt(row.metrics.impressions) || 0,
        clicks: parseInt(row.metrics.clicks) || 0,
        conversions: parseFloat(row.metrics.conversions) || 0,
        cost: parseFloat(row.metrics.cost_micros) / 1000000, // Convert micros to currency
        ctr: parseFloat(row.metrics.ctr) || 0,
        qualityScore: parseInt(row.ad_group_criterion.quality_info?.quality_score) || null,
      }));
    } catch (error: any) {
      console.error(`Error fetching keyword performance:`, error);
      logAds('Google Ads query failed', { 
        errorMessage: error.message, 
        errorStack: error.stack,
        customerId,
        hasRefreshToken: !!refreshToken
      });
      throw error;
    }
  }

  /**
   * Update keyword performance for a tenant
   */
  async updateKeywordPerformance(
    tenantId: string,
    targetCPL: number = 50
  ): Promise<{
    success: boolean;
    error?: string;
    keywordCount?: number;
    activeKeywordCount?: number;
    underperformingCount?: number;
    reason?: string;
  }> {
    try {
      // Load primary tenant details
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          googleAdsCustomerId: true,
          googleAdsRefreshToken: true,
          targetCPL: true,
          keywords: true,
        },
      });

      if (!tenant) {
        return { success: false, error: 'Tenant not found', reason: 'not_found' };
      }

  let customerId = tenant.googleAdsCustomerId || null;

      // Fallback: read from TenantAdsConfig if not on Tenant row
      if (!customerId) {
        const config = await prisma.tenantAdsConfig.findUnique({
          where: { tenantId },
          select: { googleAdsCustomerId: true },
        });
        if (config?.googleAdsCustomerId) {
          customerId = config.googleAdsCustomerId;
          // Best-effort sync back to tenant for legacy code compatibility
          await prisma.tenant.update({
            where: { id: tenantId },
            data: { googleAdsCustomerId: config.googleAdsCustomerId },
          });
          logAds('Synced googleAdsCustomerId from TenantAdsConfig to Tenant', { tenantId, customerId });
        }
      }

      if (!customerId) {
        return { success: false, error: 'Google Ads not configured', reason: 'no_customer_id' };
      }

      const refreshToken = tenant.googleAdsRefreshToken || process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
      if (!refreshToken) {
        return { success: false, error: 'Missing refresh token', reason: 'no_refresh_token' };
      }

      const actualTargetCPL = tenant.targetCPL ? parseFloat(tenant.targetCPL.toString()) : targetCPL;

      // Date range (last 7 full days excluding today)
      const endDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      const startDate = dayjs().subtract(8, 'days').format('YYYY-MM-DD');
      const weekStartDate = dayjs().startOf('week').toDate();

      logAds('Fetching keyword performance', { tenantId, startDate, endDate, customerId });

      const keywords = await this.fetchKeywordPerformance(
        // Pass through original (will be sanitized in getCustomer)
        customerId,
        refreshToken,
        startDate,
        endDate
      );

      logAds('Keywords fetched', { tenantId, count: keywords.length });

      for (const kw of keywords) {
        const conversionRate = kw.clicks > 0 ? (kw.conversions / kw.clicks) * 100 : 0;
        const cpl = kw.conversions > 0 ? kw.cost / kw.conversions : 0;
        const isUnderperforming = kw.ctr < 1 || cpl > actualTargetCPL;

        await prisma.keywordPerformance.upsert({
          where: {
            tenantId_keyword_weekStartDate: {
              tenantId,
              keyword: kw.keyword,
              weekStartDate,
            },
          },
          create: {
            tenantId,
            keyword: kw.keyword,
            matchType: kw.matchType,
            impressions: kw.impressions,
            clicks: kw.clicks,
            conversions: kw.conversions,
            cost: kw.cost,
            ctr: kw.ctr,
            conversionRate,
            cpl,
            qualityScore: kw.qualityScore,
            isUnderperforming,
            weekStartDate,
          },
          update: {
            impressions: kw.impressions,
            clicks: kw.clicks,
            conversions: kw.conversions,
            cost: kw.cost,
            ctr: kw.ctr,
            conversionRate,
            cpl,
            qualityScore: kw.qualityScore,
            isUnderperforming,
            updatedAt: new Date(),
          },
        });
      }

      // Derive active keywords list
      const activeKeywords = keywords
        .filter((kw) => kw.impressions > 10)
        .map((kw) => kw.keyword)
        .slice(0, 50);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { keywords: activeKeywords },
      });

      const underperformingCount = keywords.filter((kw) => {
        const cpl = kw.conversions > 0 ? kw.cost / kw.conversions : 0;
        return kw.ctr < 1 || cpl > actualTargetCPL;
      }).length;

      return {
        success: true,
        keywordCount: keywords.length,
        activeKeywordCount: activeKeywords.length,
        underperformingCount,
      };
    } catch (err: any) {
      console.error(`Error updating keyword performance for tenant ${tenantId}:`, err.message);
      return { success: false, error: err.message, reason: 'exception' };
    }
  }

  // Backwards compatibility for existing scripts calling the old name
  async updateTenantKeywordPerformance(tenantId: string, targetCPL: number = 50) {
    return this.updateKeywordPerformance(tenantId, targetCPL);
  }

  /**
   * Get top performing keywords for a tenant
   */
  async getTopPerformingKeywords(tenantId: string, limit: number = 10) {
    const keywords = await prisma.keywordPerformance.findMany({
      where: {
        tenantId,
        conversions: { gt: 0 },
        isUnderperforming: false,
      },
      orderBy: [
        { conversionRate: 'desc' },
        { clicks: 'desc' },
      ],
      take: limit,
    });

    return keywords;
  }

  /**
   * Get underperforming keywords for a tenant
   */
  async getUnderperformingKeywords(tenantId: string) {
    return prisma.keywordPerformance.findMany({
      where: {
        tenantId,
        isUnderperforming: true,
      },
      orderBy: [
        { impressions: 'desc' },
      ],
    });
  }
}

/**
 * Initialize Google Ads client from environment variables
 */
export function createGoogleAdsClient(): GoogleAdsClient | null {
  const config: GoogleAdsConfig = {
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    login_customer_id: (process.env.LOGIN_CUSTOMER_ID || '').replace(/-/g, '') || undefined,
  };

  if (!config.client_id || !config.client_secret || !config.developer_token) {
    console.warn('Google Ads API not configured. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN');
    return null;
  }

  if (!process.env.LOGIN_CUSTOMER_ID) {
    console.warn('Optional: set LOGIN_CUSTOMER_ID (MCC) for manager-scoped operations.');
  }

  if (!process.env.GOOGLE_ADS_REFRESH_TOKEN) {
    console.warn('Warning: GOOGLE_ADS_REFRESH_TOKEN env not set. Will rely on per-tenant refresh tokens only.');
  }

  return new GoogleAdsClient(config);
}
