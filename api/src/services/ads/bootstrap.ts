/**
 * Campaign bootstrap service
 * Creates Search campaigns with location targeting, ads, sitelinks, and tracking
 */

import { getAdsClient, digitsOnly } from '../../lib/googleAds';
import {
  DEFAULT_CAMPAIGN_SETTINGS,
  DEFAULT_AD_HEADLINES,
  DEFAULT_AD_DESCRIPTIONS,
  DEFAULT_KEYWORDS,
  DEFAULT_SITELINKS,
} from './constants';
import { ensureNegativeList } from './tenants';

interface BootstrapOptions {
  tenantId: string;
  customerId: string;
  landingUrl: string;
  postcode: string;
  radiusMiles?: number;
  dailyBudget?: number; // in micros (e.g., 1000000 = £10)
  city?: string; // for keyword/ad substitution
}

interface BootstrapResult {
  budgetResourceName: string;
  campaignResourceName: string;
  adGroupResourceName: string;
  adResourceNames: string[];
  sitelinkResourceNames: string[];
  keywordResourceNames: string[];
}

/**
 * Convert GBP to micros
 */
export function gbpToMicros(gbp: number): number {
  return Math.round(gbp * 1000000);
}

/**
 * Replace {city} placeholder in text
 */
function replaceCityPlaceholder(text: string, city: string): string {
  return text.replace(/\{city\}/gi, city).replace(/\{City\}/g, city);
}

/**
 * Bootstrap a complete Search campaign with all settings
 */
export async function bootstrapSearchCampaign(
  options: BootstrapOptions
): Promise<BootstrapResult> {
  const {
    tenantId,
    customerId,
    landingUrl,
    postcode,
    radiusMiles = DEFAULT_CAMPAIGN_SETTINGS.radiusMiles,
    dailyBudget = DEFAULT_CAMPAIGN_SETTINGS.dailyBudgetMicros,
    city = 'Sussex', // fallback city
  } = options;

  const customer = getAdsClient(customerId);

  console.log(`Bootstrapping campaign for tenant ${tenantId}, customer ${customerId}`);

  try {
    // 1. Create Budget
    const budgetOperation = {
      create: {
        name: `Budget - ${new Date().toISOString().split('T')[0]}`,
        amount_micros: dailyBudget,
        delivery_method: 'STANDARD',
      },
    };

    const budgetResponse = await customer.campaignBudgets.create([budgetOperation]);
    const budgetResourceName = budgetResponse.results[0].resource_name;
    console.log(`Created budget: ${budgetResourceName}`);

    // 2. Create Campaign
    const campaignOperation = {
      create: {
        name: `Search Campaign - ${city}`,
        status: 'PAUSED',
        advertising_channel_type: 'SEARCH',
        campaign_budget: budgetResourceName,
        bidding_strategy_type: 'MAXIMIZE_CONVERSIONS',
        url_expansion_opt_out: true,
        tracking_url_template: DEFAULT_CAMPAIGN_SETTINGS.trackingTemplate,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
          target_content_network: false,
          target_partner_search_network: false,
        },
        geo_target_type_setting: {
          positive_geo_target_type: 'PRESENCE',
        },
      },
    };

    const campaignResponse = await customer.campaigns.create([campaignOperation]);
    const campaignResourceName = campaignResponse.results[0].resource_name;
    console.log(`Created campaign: ${campaignResourceName}`);

    // 3. Add Location Targeting (proximity around postcode)
    const locationOperation = {
      create: {
        campaign: campaignResourceName,
        proximity: {
          geo_point: {
            longitude_in_micro_degrees: 0, // Will be geocoded by Google
            latitude_in_micro_degrees: 0,
          },
          radius: radiusMiles,
          radius_units: 'MILES',
          address: {
            postal_code: postcode,
            country_code: 'GB',
          },
        },
      },
    };

    await customer.campaignCriteria.create([locationOperation]);
    console.log(`Added proximity targeting: ${postcode}, ${radiusMiles} miles`);

    // 4. Create Ad Group
    const adGroupOperation = {
      create: {
        name: `Ad Group - ${city}`,
        campaign: campaignResourceName,
        status: 'ENABLED',
        type: 'SEARCH_STANDARD',
        cpc_bid_micros: 2000000, // £2 starting bid
      },
    };

    const adGroupResponse = await customer.adGroups.create([adGroupOperation]);
    const adGroupResourceName = adGroupResponse.results[0].resource_name;
    console.log(`Created ad group: ${adGroupResourceName}`);

    // 5. Add Keywords
    const keywordOperations = DEFAULT_KEYWORDS.map((kw) => ({
      create: {
        ad_group: adGroupResourceName,
        status: 'ENABLED',
        keyword: {
          text: replaceCityPlaceholder(kw.text, city),
          match_type: kw.matchType,
        },
      },
    }));

    const keywordResponse = await customer.adGroupCriteria.create(keywordOperations);
    const keywordResourceNames = keywordResponse.results.map((r: any) => r.resource_name);
    console.log(`Added ${keywordResourceNames.length} keywords`);

    // 6. Create Responsive Search Ads
    const adOperations = [];

    // Ad 1: Location-focused
    adOperations.push({
      create: {
        ad_group: adGroupResourceName,
        status: 'ENABLED',
        ad: {
          final_urls: [landingUrl],
          responsive_search_ad: {
            headlines: [
              { text: replaceCityPlaceholder('Timber Windows {City}', city) },
              { text: replaceCityPlaceholder('Sash Windows {City}', city) },
              { text: 'Heritage Window Specialists' },
              { text: 'PAS 24 Security Windows' },
              { text: 'Free Quote - Fast Install' },
            ].map((h) => ({ text: h.text, pinned_field: undefined })),
            descriptions: [
              {
                text: replaceCityPlaceholder(
                  'Expert timber window installation. PAS 24 security. 50-year guarantee. Free quotes.',
                  city
                ),
              },
              {
                text: replaceCityPlaceholder(
                  'Bespoke sash windows for period properties. Conservation approved. Call for free survey.',
                  city
                ),
              },
            ].map((d) => ({ text: d.text })),
            path1: 'windows',
            path2: city.toLowerCase().replace(/\s+/g, '-'),
          },
        },
      },
    });

    // Ad 2: Quality-focused
    adOperations.push({
      create: {
        ad_group: adGroupResourceName,
        status: 'ENABLED',
        ad: {
          final_urls: [landingUrl],
          responsive_search_ad: {
            headlines: [
              { text: 'Bespoke Timber Doors' },
              { text: '50-Year Guarantee' },
              { text: 'Expert Craftsmen' },
              { text: 'Premium Quality Joinery' },
              { text: replaceCityPlaceholder('Serving {City}', city) },
            ].map((h) => ({ text: h.text })),
            descriptions: [
              {
                text: replaceCityPlaceholder(
                  'Heritage joinery specialists serving {City}. Premium quality. Fast turnaround.',
                  city
                ),
              },
              {
                text: 'Transform your home with handcrafted timber windows & doors. Get a free quote today.',
              },
            ].map((d) => ({ text: d.text })),
            path1: 'doors',
            path2: 'quote',
          },
        },
      },
    });

    const adResponse = await customer.adGroupAds.create(adOperations);
    const adResourceNames = adResponse.results.map((r: any) => r.resource_name);
    console.log(`Created ${adResourceNames.length} responsive search ads`);

    // 7. Add Sitelink Extensions
    const sitelinkOperations = DEFAULT_SITELINKS.map((link) => ({
      create: {
        campaign: campaignResourceName,
        sitelink: {
          link_text: link.text,
          final_urls: [`${landingUrl}${link.anchor}`],
        },
      },
    }));

    const sitelinkResponse = await customer.campaignExtensionSettings.create(sitelinkOperations);
    const sitelinkResourceNames = sitelinkResponse.results.map((r: any) => r.resource_name);
    console.log(`Added ${sitelinkResourceNames.length} sitelink extensions`);

    // 8. Attach Negative Keyword List
    await ensureNegativeList(customerId, 'Joinery AI Default Negatives');

    console.log('Campaign bootstrap complete!');

    return {
      budgetResourceName,
      campaignResourceName,
      adGroupResourceName,
      adResourceNames,
      sitelinkResourceNames,
      keywordResourceNames,
    };
  } catch (error: any) {
    console.error('Error bootstrapping campaign:', error.message);
    if (error.failure) {
      console.error('Partial failure details:', JSON.stringify(error.failure, null, 2));
    }
    throw error;
  }
}
