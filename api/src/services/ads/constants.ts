/**
 * Google Ads negative keyword defaults
 */

export const DEFAULT_NEGATIVE_KEYWORDS = [
  'free',
  'cheap',
  'cheapest',
  'budget',
  'discount',
  'DIY',
  'kit',
  'uPVC',
  'plastic',
  'aluminium',
  'vinyl',
  'jobs',
  'career',
  'vacancy',
  'hiring',
  'apprentice',
  'training',
  'course',
  'how to make',
  'plans',
  'drawing',
  'design ideas',
  'pdf',
  'supplier',
  'manufacturing process',
  'factory tour',
  'used',
  'second hand',
  'reclaimed',
  'recycle',
  'scrap',
  'replacement glass',
  'repair',
  'fix',
  'hinge',
  'handle',
  'paint',
  'varnish',
  'stain',
  'sash cord',
  'balance spring',
  'furniture',
  'curtain',
  'locksmith',
  'B&Q',
  'Wickes',
  'Homebase',
  'IKEA',
  'eBay',
  'Amazon',
  'USA',
  'Australia',
  'Canada',
  'India',
  'Scotland',
  'Ireland',
  'staircase',
  'kitchen',
  'table',
  'chair',
  'desk',
  'cabinet',
  'wardrobe',
  'bookcase',
];

/**
 * Default search campaign settings
 */
export const DEFAULT_CAMPAIGN_SETTINGS = {
  dailyBudgetMicros: 1000000, // £10.00
  radiusMiles: 50,
  trackingTemplate:
    '{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}&gclid={gclid}',
};

/**
 * Default ad copy templates
 */
export const DEFAULT_AD_HEADLINES = [
  'Timber Windows {City}',
  'Sash Windows {City}',
  'Heritage Window Specialists',
  'PAS 24 Security Windows',
  'Free Quote - Fast Install',
  'Bespoke Timber Doors',
  '50-Year Guarantee',
  'Expert Craftsmen',
  'Premium Quality Joinery',
  'Conservation Area Approved',
];

export const DEFAULT_AD_DESCRIPTIONS = [
  'Expert timber window installation. PAS 24 security. 50-year guarantee. Free quotes.',
  'Bespoke sash windows for period properties. Conservation approved. Call for free survey.',
  'Heritage joinery specialists serving {City}. Premium quality. Fast turnaround.',
  'Transform your home with handcrafted timber windows & doors. Get a free quote today.',
];

/**
 * Default keywords (use {city} placeholder for location insertion)
 */
export const DEFAULT_KEYWORDS = [
  { text: '+timber +windows +{city}', matchType: 'BROAD' },
  { text: '+sash +windows +{city}', matchType: 'BROAD' },
  { text: '"heritage windows"', matchType: 'PHRASE' },
  { text: '[timber doors {city}]', matchType: 'EXACT' },
  { text: '+timber +joinery +{city}', matchType: 'BROAD' },
  { text: '"period windows"', matchType: 'PHRASE' },
  { text: '+sash +window +restoration', matchType: 'BROAD' },
];

/**
 * Default sitelink extensions
 */
export const DEFAULT_SITELINKS = [
  { text: 'View Gallery', anchor: '#gallery' },
  { text: 'Get a Quote', anchor: '#quote' },
  { text: 'Customer Reviews', anchor: '#reviews' },
  { text: 'Our Guarantees', anchor: '#guarantees' },
];
