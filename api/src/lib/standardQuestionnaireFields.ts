// api/src/lib/standardQuestionnaireFields.ts
/**
 * Standard questionnaire fields for ML training consistency
 * These fields are automatically created for all tenants and provide
 * a consistent feature set for the RandomForest price prediction model.
 */

export type StandardFieldDefinition = {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN" | "TEXTAREA" | "DATE";
  options?: string[];
  required: boolean;
  costingInputKey?: string;
  helpText?: string;
  placeholder?: string;
  sortOrder: number;
  group?: string;
  isStandard: true;
};

/**
 * Standard fields organized by category
 * These map directly to ML model features
 */
export const STANDARD_FIELDS: StandardFieldDefinition[] = [
  // ============ CORE PROJECT FIELDS ============
  {
    key: "area_m2",
    label: "Project Area (m²)",
    type: "NUMBER",
    required: true,
    costingInputKey: "area_m2",
    helpText: "Total area of project in square meters",
    placeholder: "e.g., 25",
    sortOrder: 0,
    group: "Project Details",
    isStandard: true,
  },
  {
    key: "materials_grade",
    label: "Materials Grade",
    type: "SELECT",
    options: ["Premium", "Standard", "Basic"],
    required: true,
    costingInputKey: "materials_grade",
    helpText: "Quality tier of timber and materials",
    sortOrder: 1,
    group: "Project Details",
    isStandard: true,
  },
  {
    key: "project_type",
    label: "Project Type",
    type: "SELECT",
    options: ["Windows", "Doors", "French Doors", "Bifold Doors", "Sash Windows", "Staircase", "Kitchen", "Wardrobes", "Alcove Units", "Other"],
    required: true,
    costingInputKey: "project_type",
    helpText: "Primary type of joinery work",
    sortOrder: 2,
    group: "Project Details",
    isStandard: true,
  },

  // ============ PREMIUM FEATURES ============
  {
    key: "glazing_type",
    label: "Glazing Type",
    type: "SELECT",
    options: ["Standard Double Glazing", "Triple Glazing", "Vacuum Glass", "Single Glazing", "None"],
    required: false,
    costingInputKey: "glazing_type",
    helpText: "Glass specification (affects thermal performance and cost)",
    sortOrder: 10,
    group: "Premium Features",
    isStandard: true,
  },
  {
    key: "has_curves",
    label: "Curved or Arched Design",
    type: "BOOLEAN",
    required: false,
    costingInputKey: "has_curves",
    helpText: "Does the design include curved or arched elements?",
    sortOrder: 11,
    group: "Premium Features",
    isStandard: true,
  },
  {
    key: "premium_hardware",
    label: "Premium Hardware",
    type: "BOOLEAN",
    required: false,
    costingInputKey: "premium_hardware",
    helpText: "Upgraded handles, locks, hinges, and fittings",
    sortOrder: 12,
    group: "Premium Features",
    isStandard: true,
  },
  {
    key: "custom_finish",
    label: "Custom Finish",
    type: "SELECT",
    options: ["None", "Paint", "Stain", "Lacquer", "Varnish", "Oil"],
    required: false,
    costingInputKey: "custom_finish",
    helpText: "Factory-applied finish (additional cost)",
    sortOrder: 13,
    group: "Premium Features",
    isStandard: true,
  },
  {
    key: "fire_rated",
    label: "Fire Rated",
    type: "BOOLEAN",
    required: false,
    costingInputKey: "fire_rated",
    helpText: "Fire door certification required (FD30/FD60)",
    sortOrder: 14,
    group: "Premium Features",
    isStandard: true,
  },

  // ============ WINDOW-SPECIFIC FIELDS ============
  {
    key: "window_style",
    label: "Window Style",
    type: "SELECT",
    options: ["Casement", "Sash", "Fixed", "Tilt & Turn", "Bay", "Dormer"],
    required: false,
    costingInputKey: "window_style",
    helpText: "Type of window opening mechanism",
    sortOrder: 20,
    group: "Windows",
    isStandard: true,
  },
  {
    key: "num_windows",
    label: "Number of Windows",
    type: "NUMBER",
    required: false,
    costingInputKey: "quantity",
    helpText: "Total count of window units",
    placeholder: "e.g., 6",
    sortOrder: 21,
    group: "Windows",
    isStandard: true,
  },

  // ============ DOOR-SPECIFIC FIELDS ============
  {
    key: "door_type",
    label: "Door Type",
    type: "SELECT",
    options: ["External Front Door", "Internal Door", "Bifold Doors", "French Doors", "Sliding Doors", "Stable Door"],
    required: false,
    costingInputKey: "door_type",
    helpText: "Type and location of door",
    sortOrder: 30,
    group: "Doors",
    isStandard: true,
  },
  {
    key: "door_height_mm",
    label: "Door Height (mm)",
    type: "NUMBER",
    required: false,
    costingInputKey: "door_height_mm",
    helpText: "Height in millimeters (standard is 2100mm)",
    placeholder: "e.g., 2100",
    sortOrder: 31,
    group: "Doors",
    isStandard: true,
  },
  {
    key: "door_width_mm",
    label: "Door Width (mm)",
    type: "NUMBER",
    required: false,
    costingInputKey: "door_width_mm",
    helpText: "Width in millimeters (standard is 800-900mm)",
    placeholder: "e.g., 900",
    sortOrder: 32,
    group: "Doors",
    isStandard: true,
  },
  {
    key: "num_doors",
    label: "Number of Doors",
    type: "NUMBER",
    required: false,
    costingInputKey: "quantity",
    helpText: "Total count of door units",
    placeholder: "e.g., 2",
    sortOrder: 33,
    group: "Doors",
    isStandard: true,
  },

  // ============ CONTACT INFORMATION ============
  {
    key: "contact_name",
    label: "Your Name",
    type: "TEXT",
    required: true,
    helpText: "Full name for quote correspondence",
    placeholder: "John Smith",
    sortOrder: 100,
    group: "Contact Information",
    isStandard: true,
  },
  {
    key: "email",
    label: "Email Address",
    type: "TEXT",
    required: true,
    helpText: "We'll send your quote to this email",
    placeholder: "john@example.com",
    sortOrder: 101,
    group: "Contact Information",
    isStandard: true,
  },
  {
    key: "phone",
    label: "Phone Number",
    type: "TEXT",
    required: false,
    helpText: "Optional contact number",
    placeholder: "07700 900000",
    sortOrder: 102,
    group: "Contact Information",
    isStandard: true,
  },

  // ============ CONTEXT & SOURCE ============
  {
    key: "lead_source",
    label: "How did you hear about us?",
    type: "SELECT",
    options: ["Website", "Google Search", "Referral", "Social Media", "Advertisement", "Previous Customer", "Other"],
    required: false,
    costingInputKey: "lead_source",
    helpText: "Helps us understand marketing effectiveness",
    sortOrder: 110,
    group: "Additional Details",
    isStandard: true,
  },
  {
    key: "region",
    label: "Project Location",
    type: "SELECT",
    options: ["London", "South East", "South West", "East of England", "West Midlands", "East Midlands", "Yorkshire", "North West", "North East", "Scotland", "Wales", "Northern Ireland"],
    required: false,
    costingInputKey: "region",
    helpText: "Geographic location affects delivery and installation costs",
    sortOrder: 111,
    group: "Additional Details",
    isStandard: true,
  },
  {
    key: "timeframe",
    label: "Project Timeframe",
    type: "SELECT",
    options: ["ASAP (within 1 month)", "1-2 months", "3-6 months", "6+ months", "Flexible"],
    required: false,
    helpText: "When do you need the work completed?",
    sortOrder: 112,
    group: "Additional Details",
    isStandard: true,
  },
  {
    key: "budget_range",
    label: "Budget Range",
    type: "SELECT",
    options: ["Under £5,000", "£5,000 - £15,000", "£15,000 - £30,000", "£30,000 - £50,000", "Over £50,000", "Not sure yet"],
    required: false,
    helpText: "Approximate budget (helps us tailor recommendations)",
    sortOrder: 113,
    group: "Additional Details",
    isStandard: true,
  },
  {
    key: "additional_notes",
    label: "Additional Details",
    type: "TEXTAREA",
    required: false,
    helpText: "Any other information that would help us provide an accurate quote",
    placeholder: "Please describe any specific requirements, existing issues, or special considerations...",
    sortOrder: 120,
    group: "Additional Details",
    isStandard: true,
  },
];

/**
 * Get fields by group for conditional rendering
 */
export function getFieldsByGroup(group: string): StandardFieldDefinition[] {
  return STANDARD_FIELDS.filter((f) => f.group === group);
}

/**
 * Get all unique groups in display order
 */
export function getFieldGroups(): string[] {
  const groups = [...new Set(STANDARD_FIELDS.map((f) => f.group).filter(Boolean))];
  const order = ["Project Details", "Premium Features", "Windows", "Doors", "Contact Information", "Additional Details"];
  return order.filter((g) => groups.includes(g));
}

/**
 * Get fields that map to ML features (have costingInputKey)
 */
export function getMlFeatureFields(): StandardFieldDefinition[] {
  return STANDARD_FIELDS.filter((f) => f.costingInputKey);
}

/**
 * Map standard field key to ML feature name
 */
export function getMLFeatureKey(fieldKey: string): string | undefined {
  const field = STANDARD_FIELDS.find((f) => f.key === fieldKey);
  return field?.costingInputKey;
}
