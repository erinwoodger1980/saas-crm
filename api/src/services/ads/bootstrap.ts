/**
 * Campaign bootstrap service
 * Creates Search campaigns with location targeting, ads, sitelinks, and tracking
 */

import { getAdsClient } from '../../lib/googleAds';
import {
  DEFAULT_CAMPAIGN_SETTINGS,
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
  dailyBudgetGBP?: number;
  city?: string;
  campaignName?: string;
}

interface BootstrapResult {
  budgetResourceName: string;
  campaignResourceName: string;
  adGroupResourceName: string;
  adResourceNames: string[];
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
 * Mock geocoding function - in production, use a real geocoding API
 */
async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number }> {
  // Mock coordinates for TN22 1AA (Sussex)
  // In production, integrate with Google Maps Geocoding API or similar
  return {
    lat: 50.9097,
    lng: 0.0143,
  };
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
    dailyBudgetGBP = 10,
    city = 'Sussex',
    campaignName = `Search Campaign - ${city}`,
  } = options;

  const customer = getAdsClient(customerId);
  const budgetMicros = gbpToMicros(dailyBudgetGBP);
  const { lat, lng } = await geocodePostcode(postcode);

  console.log(`Bootstrapping campaign for tenant ${tenantId}, customer ${customerId}`);

  try {
    // 1. Create Campaign Budget
    const budgetResponse = await customer.campaignBudgets.create([
      {
        name: `${campaignName} Budget`,
        amount_micros: budgetMicros,
        delivery_method: "STANDARD",
      },
    ]);
    const budgetResourceName = budgetResponse.results[0].resource_name;
    console.log(`Created budget: ${budgetResourceName}`);

    // 2. Create Campaign
    const campaignResponse = await customer.campaigns.create([
      {
        name: campaignName,
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
    ]);
    const campaignResourceName = campaignResponse.results[0].resource_name;
    console.log(`Created campaign: ${campaignResourceName}`);

    // 3. Add Location Targeting
    await customer.campaignCriteria.create([
      {
        campaign: campaignResourceName,
        proximity: {
          geo_point: {
            longitude_in_micro_degrees: Math.round(lng * 1_000_000),
            latitude_in_micro_degrees: Math.round(lat * 1_000_000),
          },
          radius: radiusMiles,
          radius_units: "MILES",
          address: {
            postal_code: postcode,
            country_code: "GB",
          },
        },
      },
    ]);
    console.log(`Added proximity targeting: ${postcode}, ${radiusMiles} miles`);

    // 4. Create Ad Group
    const adGroupResponse = await customer.adGroups.create([
      {
        name: `Ad Group - ${city}`,
        campaign: campaignResourceName,
        status: 'ENABLED',
        type: 'SEARCH_STANDARD',
        cpc_bid_micros: 2000000, // £2 starting bid
      },
    ]);
    const adGroupResourceName = adGroupResponse.results[0].resource_name;
    console.log(`Created ad group: ${adGroupResourceName}`);

    // 5. Add Keywords
    const keywordsToAdd = DEFAULT_KEYWORDS.map((kw) => ({
      ad_group: adGroupResourceName,
      status: "ENABLED",
      keyword: {
        text: replaceCityPlaceholder(kw.text, city),
        match_type: kw.matchType,
      },
    }));

    const keywordsResponse = await customer.adGroupCriteria.create(keywordsToAdd as any);
    const keywordResourceNames = keywordsResponse.results.map((r: any) => r.resource_name);
    console.log(`Added ${keywordResourceNames.length} keywords`);

    // 6. Create Responsive Search Ads
    const adOperations = [
      // Ad 1: Location-focused
      {
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
            ],
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
            ],
            path1: 'windows',
            path2: city.toLowerCase().replace(/\s+/g, '-'),
          },
        },
      },
      // Ad 2: Quality-focused
      {
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
            ],
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
            ],
            path1: 'doors',
            path2: 'quote',
          },
        },
      },
    ];

    const adResponse = await customer.adGroupAds.create(adOperations as any);
    const adResourceNames = adResponse.results.map((r: any) => r.resource_name);
    console.log(`Created ${adResourceNames.length} responsive search ads`);

    // 7. Attach Negative Keyword List
    await ensureNegativeList(customerId, 'Joinery AI Default Negatives');
    console.log('Attached negative keyword list');

    console.log('Campaign bootstrap complete!');

    return {
      budgetResourceName: budgetResourceName!,
      campaignResourceName: campaignResourceName!,
      adGroupResourceName: adGroupResourceName!,
      adResourceNames,
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
