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
  // ============ COMPUTED / INTERNAL (hidden from client) ============
  {
    key: "area_m2",
    label: "Project Area (m²)",
    type: "NUMBER",
    required: false,
    costingInputKey: "area_m2",
    helpText: "Computed automatically from dimensions",
    placeholder: "",
    sortOrder: 0,
    group: "Internal",
    isStandard: true,
  },
  {
    key: "project_type",
    label: "Project Type",
    type: "SELECT",
    options: ["Windows", "Doors", "French Doors", "Bifold Doors", "Sash Windows", "Staircase", "Kitchen", "Wardrobes", "Alcove Units", "Other"],
    required: false,
    costingInputKey: "project_type",
    helpText: "Set by tenant – internal classification",
    sortOrder: 1,
    group: "Internal",
    isStandard: true,
  },

  // ============ CLIENT PROFILE (one per client / lead) ============
  {
    key: "contact_name",
    label: "Your Name",
    type: "TEXT",
    required: true,
    helpText: "Full name for correspondence",
    placeholder: "John Smith",
    sortOrder: 100,
    group: "Client Profile",
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
    group: "Client Profile",
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
    group: "Client Profile",
    isStandard: true,
  },
  {
    key: "lead_source",
    label: "How did you hear about us?",
    type: "SELECT",
    options: ["Website", "Google Search", "Referral", "Social Media", "Advertisement", "Previous Customer", "Other"],
    required: false,
    costingInputKey: "lead_source",
    helpText: "Marketing attribution",
    sortOrder: 110,
    group: "Client Profile",
    isStandard: true,
  },
  {
    key: "region",
    label: "Project Location",
    type: "SELECT",
    options: ["London", "South East", "South West", "East of England", "West Midlands", "East Midlands", "Yorkshire", "North West", "North East", "Scotland", "Wales", "Northern Ireland"],
    required: false,
    costingInputKey: "region",
    helpText: "Location affects logistics",
    sortOrder: 111,
    group: "Client Profile",
    isStandard: true,
  },
  {
    key: "property_listed",
    label: "Listed Building",
    type: "BOOLEAN",
    required: false,
    costingInputKey: "property_listed",
    helpText: "Special considerations if listed",
    sortOrder: 112,
    group: "Client Profile",
    isStandard: true,
  },
  {
    key: "timeframe",
    label: "Project Timeframe",
    type: "SELECT",
    options: ["ASAP (within 1 month)", "1-2 months", "3-6 months", "6+ months", "Flexible"],
    required: false,
    helpText: "When do you need completion?",
    sortOrder: 113,
    group: "Client Profile",
    isStandard: true,
  },
  {
    key: "budget_range",
    label: "Budget Range",
    type: "SELECT",
    options: ["Under £5,000", "£5,000 - £15,000", "£15,000 - £30,000", "£30,000 - £50,000", "Over £50,000", "Not sure yet"],
    required: false,
    helpText: "Approximate spend guideline",
    sortOrder: 114,
    group: "Client Profile",
    isStandard: true,
  },
  {
    key: "installation_required",
    label: "Installation Required",
    type: "BOOLEAN",
    required: false,
    costingInputKey: "installation_required",
    helpText: "Professional installation needed?",
    sortOrder: 115,
    group: "Client Profile",
    isStandard: true,
  },
  {
    key: "additional_notes",
    label: "Additional Details",
    type: "TEXTAREA",
    required: false,
    helpText: "Any other info to help quoting",
    placeholder: "Specific requirements, existing issues…",
    sortOrder: 120,
    group: "Client Profile",
    isStandard: true,
  },

  // ============ ITEM SPECIFICATION (asked per item) ============
  {
    key: "materials_grade",
    label: "Materials Grade",
    type: "SELECT",
    options: ["Premium", "Standard", "Basic"],
    required: true,
    costingInputKey: "materials_grade",
    helpText: "Quality tier of materials",
    sortOrder: 200,
    group: "Item Specification",
    isStandard: true,
  },
  {
    key: "glazing_type",
    label: "Glazing Type",
    type: "SELECT",
    options: ["Standard Double Glazing", "Triple Glazing", "Vacuum Glass", "Single Glazing", "None"],
    required: false,
    costingInputKey: "glazing_type",
    helpText: "Glass specification",
    sortOrder: 201,
    group: "Item Specification",
    isStandard: true,
  },
  {
    key: "has_curves",
    label: "Curved / Arched Design",
    type: "BOOLEAN",
    required: false,
    costingInputKey: "has_curves",
    helpText: "Includes curved or arched elements",
    sortOrder: 202,
    group: "Item Specification",
    isStandard: true,
  },
  {
    key: "ironmongery_level",
    label: "Ironmongery Level",
    type: "SELECT",
    options: ["Standard", "Enhanced", "Heritage"],
    required: false,
    costingInputKey: "ironmongery_level",
    helpText: "Quality / complexity of ironmongery",
    sortOrder: 203,
    group: "Item Specification",
    isStandard: true,
  },
  {
    key: "door_type",
    label: "Door / Window Type",
    type: "SELECT",
    options: ["External Front Door", "Internal Door", "Bifold Doors", "French Doors", "Sliding Doors", "Stable Door", "Casement Window", "Sash Window"],
    required: false,
    costingInputKey: "door_type",
    helpText: "Primary item type",
    sortOrder: 204,
    group: "Item Specification",
    isStandard: true,
  },
  {
    key: "quantity",
    label: "Quantity",
    type: "NUMBER",
    required: false,
    costingInputKey: "quantity",
    helpText: "Total count of identical items",
    placeholder: "e.g., 2",
    sortOrder: 205,
    group: "Item Specification",
    isStandard: true,
  },
  {
    key: "door_width_mm",
    label: "Approx Width (mm)",
    type: "NUMBER",
    required: false,
    costingInputKey: "door_width_mm",
    helpText: "Approximate width",
    placeholder: "e.g., 900",
    sortOrder: 206,
    group: "Item Specification",
    isStandard: true,
  },
  {
    key: "door_height_mm",
    label: "Approx Height (mm)",
    type: "NUMBER",
    required: false,
    costingInputKey: "door_height_mm",
    helpText: "Approximate height",
    placeholder: "e.g., 2100",
    sortOrder: 207,
    group: "Item Specification",
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
  const order = ["Client Profile", "Item Specification", "Internal"];
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
