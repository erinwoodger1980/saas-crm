import { PrismaClient } from '@prisma/client';
import { GoogleAdsClient } from './google-ads';

const prisma = new PrismaClient();

interface OptimizationSuggestion {
  keyword: string;
  suggestedFor: string;
  oldText: string | null;
  newText: string;
  reason: string;
  conversionRate: number;
}

/**
 * SEO & Ads optimization engine
 * Analyzes keyword performance and suggests content improvements
 */
export class AdsOptimizer {
  private adsClient: GoogleAdsClient | null;

  constructor(adsClient?: GoogleAdsClient) {
    this.adsClient = adsClient || null;
  }

  /**
   * Generate headline variations with top keywords
   */
  private generateHeadlineVariations(keyword: string, tenantName: string, serviceAreas: string[]): string[] {
    const area = serviceAreas[0] || 'your area';
    
    return [
      `${keyword} Specialists in ${area} | ${tenantName}`,
      `Expert ${keyword} Services - ${tenantName}`,
      `${area}'s Trusted ${keyword} Company | ${tenantName}`,
      `Professional ${keyword} | ${tenantName} - ${area}`,
      `${keyword} Installation & Repair in ${area}`,
    ];
  }

  /**
   * Generate subhead variations with keyword focus
   */
  private generateSubheadVariations(keyword: string, serviceAreas: string[]): string[] {
    const areas = serviceAreas.slice(0, 3).join(', ');
    
    return [
      `Premium ${keyword} for homes and businesses in ${areas}`,
      `Serving ${areas} with expert ${keyword} solutions`,
      `Transform your property with quality ${keyword} in ${areas}`,
      `Local ${keyword} specialists covering ${areas}`,
    ];
  }

  /**
   * Generate meta title with keyword
   */
  private generateMetaTitle(keyword: string, tenantName: string, area: string): string {
    return `${keyword} ${area} | ${tenantName} - Free Quote`;
  }

  /**
   * Generate meta description with keyword
   */
  private generateMetaDescription(keyword: string, serviceAreas: string[], tenantName: string): string {
    const areas = serviceAreas.slice(0, 3).join(', ');
    return `Expert ${keyword} in ${areas}. ${tenantName} offers professional installation, repair & maintenance. 50-year guarantee. Free quotes. Call today!`;
  }

  /**
   * Analyze keywords and generate optimization suggestions
   */
  async generateOptimizationSuggestions(tenantId: string): Promise<OptimizationSuggestion[]> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        serviceAreas: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    // Get top performing keywords
    const topKeywords = await prisma.keywordPerformance.findMany({
      where: {
        tenantId,
        conversions: { gt: 0 },
        ctr: { gte: 2 }, // At least 2% CTR
      },
      orderBy: [
        { conversionRate: 'desc' },
        { clicks: 'desc' },
      ],
      take: 5,
    });

    if (topKeywords.length === 0) {
      console.log(`No high-performing keywords found for tenant ${tenantId}`);
      return [];
    }

    const suggestions: OptimizationSuggestion[] = [];

    for (const kw of topKeywords) {
      const conversionRate = parseFloat(kw.conversionRate.toString());

      // Headline suggestions
      const headlines = this.generateHeadlineVariations(
        kw.keyword,
        tenant.name,
        tenant.serviceAreas
      );

      suggestions.push({
        keyword: kw.keyword,
        suggestedFor: 'headline',
        oldText: null,
        newText: headlines[0],
        reason: `High conversion rate (${conversionRate.toFixed(1)}%) with ${kw.conversions} conversions`,
        conversionRate,
      });

      // Subhead suggestion
      const subheads = this.generateSubheadVariations(kw.keyword, tenant.serviceAreas);
      
      suggestions.push({
        keyword: kw.keyword,
        suggestedFor: 'subhead',
        oldText: null,
        newText: subheads[0],
        reason: `Top converting keyword with ${kw.clicks} clicks and ${conversionRate.toFixed(1)}% conversion rate`,
        conversionRate,
      });

      // Meta title suggestion
      const area = tenant.serviceAreas[0] || 'Local Area';
      const metaTitle = this.generateMetaTitle(kw.keyword, tenant.name, area);

      suggestions.push({
        keyword: kw.keyword,
        suggestedFor: 'meta_title',
        oldText: null,
        newText: metaTitle,
        reason: `Keyword has Quality Score ${kw.qualityScore || 'N/A'} and ${conversionRate.toFixed(1)}% conversion rate`,
        conversionRate,
      });

      // Meta description suggestion
      const metaDescription = this.generateMetaDescription(
        kw.keyword,
        tenant.serviceAreas,
        tenant.name
      );

      suggestions.push({
        keyword: kw.keyword,
        suggestedFor: 'meta_description',
        oldText: null,
        newText: metaDescription,
        reason: `Best performing keyword with £${parseFloat(kw.cpl.toString()).toFixed(2)} CPL`,
        conversionRate,
      });
    }

    return suggestions;
  }

  /**
   * Save suggestions to database
   */
  async saveSuggestions(tenantId: string, suggestions: OptimizationSuggestion[]) {
    const created = [];

    for (const suggestion of suggestions) {
      const record = await prisma.keywordSuggestion.create({
        data: {
          tenantId,
          keyword: suggestion.keyword,
          suggestedFor: suggestion.suggestedFor,
          oldText: suggestion.oldText,
          newText: suggestion.newText,
          reason: suggestion.reason,
          conversionRate: suggestion.conversionRate,
          status: 'pending',
        },
      });
      created.push(record);
    }

    return created;
  }

  /**
   * Apply approved suggestions to landing page content
   */
  async applyApprovedSuggestions(tenantId: string) {
    // Get approved suggestions
    const suggestions = await prisma.keywordSuggestion.findMany({
      where: {
        tenantId,
        status: 'approved',
      },
      orderBy: {
        conversionRate: 'desc',
      },
    });

    if (suggestions.length === 0) {
      return { applied: 0, message: 'No approved suggestions to apply' };
    }

    // Find corresponding LandingTenant via tenantId
    const landingTenant = await prisma.landingTenant.findUnique({
      where: {
        tenantId: tenantId,
      },
      include: {
        content: true,
      },
    });

    if (!landingTenant) {
      return { applied: 0, message: 'Landing tenant not found' };
    }

    // Group suggestions by type
    const headlineSuggestion = suggestions.find(s => s.suggestedFor === 'headline');
    const subheadSuggestion = suggestions.find(s => s.suggestedFor === 'subhead');

    // Update landing page content
    if (landingTenant.content) {
      await prisma.landingTenantContent.update({
        where: { id: landingTenant.content.id },
        data: {
          headline: headlineSuggestion?.newText || undefined,
          subhead: subheadSuggestion?.newText || undefined,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create content if doesn't exist
      await prisma.landingTenantContent.create({
        data: {
          tenantId: landingTenant.id,
          headline: headlineSuggestion?.newText || '',
          subhead: subheadSuggestion?.newText || '',
        },
      });
    }

    // Mark suggestions as applied
    await prisma.keywordSuggestion.updateMany({
      where: {
        tenantId,
        status: 'approved',
      },
      data: {
        status: 'applied',
        appliedAt: new Date(),
      },
    });

    return {
      applied: suggestions.length,
      message: `Applied ${suggestions.length} suggestions to landing page`,
      suggestions: suggestions.map(s => ({
        keyword: s.keyword,
        type: s.suggestedFor,
        text: s.newText,
      })),
    };
  }

  /**
   * Get optimization report for a tenant
   */
  async getOptimizationReport(tenantId: string) {
    const [topKeywords, underperforming, suggestions] = await Promise.all([
      prisma.keywordPerformance.findMany({
        where: { tenantId, conversions: { gt: 0 } },
        orderBy: { conversionRate: 'desc' },
        take: 10,
      }),
      prisma.keywordPerformance.findMany({
        where: { tenantId, isUnderperforming: true },
        orderBy: { impressions: 'desc' },
        take: 10,
      }),
      prisma.keywordSuggestion.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      topKeywords: topKeywords.map(kw => ({
        keyword: kw.keyword,
        impressions: kw.impressions,
        clicks: kw.clicks,
        conversions: kw.conversions,
        ctr: parseFloat(kw.ctr.toString()),
        conversionRate: parseFloat(kw.conversionRate.toString()),
        cpl: parseFloat(kw.cpl.toString()),
        qualityScore: kw.qualityScore,
      })),
      underperforming: underperforming.map(kw => ({
        keyword: kw.keyword,
        impressions: kw.impressions,
        clicks: kw.clicks,
        ctr: parseFloat(kw.ctr.toString()),
        cpl: parseFloat(kw.cpl.toString()),
        reason: parseFloat(kw.ctr.toString()) < 1 ? 'Low CTR' : 'High CPL',
      })),
      suggestions: suggestions.map(s => ({
        id: s.id,
        keyword: s.keyword,
        suggestedFor: s.suggestedFor,
        newText: s.newText,
        reason: s.reason,
        status: s.status,
        createdAt: s.createdAt,
      })),
    };
  }
}

/**
 * Create optimizer instance
 */
export function createAdsOptimizer(adsClient?: GoogleAdsClient): AdsOptimizer {
  return new AdsOptimizer(adsClient);
}
