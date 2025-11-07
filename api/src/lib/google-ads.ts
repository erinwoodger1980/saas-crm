import { GoogleAdsApi, Customer } from 'google-ads-api';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

interface GoogleAdsConfig {
  client_id: string;
  client_secret: string;
  developer_token: string;
}

/**
 * Google Ads API integration for keyword performance tracking
 */
export class GoogleAdsClient {
  private client: GoogleAdsApi;

  constructor(config: GoogleAdsConfig) {
    this.client = new GoogleAdsApi({
      client_id: config.client_id,
      client_secret: config.client_secret,
      developer_token: config.developer_token,
    });
  }

  /**
   * Get customer instance for a tenant
   */
  private getCustomer(customerId: string, refreshToken: string): Customer {
    return this.client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
    });
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
      console.error(`Error fetching keyword performance:`, error.message);
      throw error;
    }
  }

  /**
   * Update keyword performance for a tenant
   */
  async updateTenantKeywordPerformance(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        googleAdsCustomerId: true,
        googleAdsRefreshToken: true,
        targetCPL: true,
      },
    });

    if (!tenant?.googleAdsCustomerId || !tenant.googleAdsRefreshToken) {
      console.log(`Tenant ${tenantId} has no Google Ads configuration, skipping`);
      return { success: false, reason: 'no_ads_config' };
    }

    // Get date range (last 7 days)
    const endDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const startDate = dayjs().subtract(8, 'days').format('YYYY-MM-DD');
    const weekStartDate = dayjs().startOf('week').toDate();

    console.log(`Fetching keyword performance for tenant ${tenantId} (${startDate} to ${endDate})`);

    try {
      const keywords = await this.fetchKeywordPerformance(
        tenant.googleAdsCustomerId,
        tenant.googleAdsRefreshToken,
        startDate,
        endDate
      );

      console.log(`Found ${keywords.length} keywords for tenant ${tenantId}`);

      // Upsert keyword performance records
      for (const kw of keywords) {
        const conversionRate = kw.clicks > 0 ? (kw.conversions / kw.clicks) * 100 : 0;
        const cpl = kw.conversions > 0 ? kw.cost / kw.conversions : 0;
        const targetCPL = tenant.targetCPL ? parseFloat(tenant.targetCPL.toString()) : 50;

        // Flag underperforming keywords
        const isUnderperforming = kw.ctr < 1 || cpl > targetCPL;

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

      // Update tenant's keywords array with active keywords
      const activeKeywords = keywords
        .filter(kw => kw.impressions > 10) // Only keep keywords with significant impressions
        .map(kw => kw.keyword)
        .slice(0, 50); // Limit to top 50

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { keywords: activeKeywords },
      });

      return {
        success: true,
        keywordCount: keywords.length,
        activeKeywordCount: activeKeywords.length,
        underperformingCount: keywords.filter(kw => {
          const cpl = kw.conversions > 0 ? kw.cost / kw.conversions : 0;
          return kw.ctr < 1 || cpl > targetCPL;
        }).length,
      };
    } catch (error: any) {
      console.error(`Error updating keyword performance for tenant ${tenantId}:`, error.message);
      return { success: false, error: error.message };
    }
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
  const config = {
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
  };

  if (!config.client_id || !config.client_secret || !config.developer_token) {
    console.warn('Google Ads API not configured. Set GOOGLE_ADS_* env vars.');
    return null;
  }

  return new GoogleAdsClient(config);
}
