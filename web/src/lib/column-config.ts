// web/src/lib/column-config.ts
/**
 * Column Configuration System
 * Provides utilities for managing customizable table columns with:
 * - Per-tab/status column configurations
 * - Drag-and-drop reordering
 * - Column visibility toggles
 * - Frozen columns support
 * - LocalStorage persistence
 */

export type ColumnConfig = {
  id: string;
  label: string;
  visible: boolean;
  frozen: boolean;
  width?: number;
  fieldPath: string; // dot notation for nested fields, e.g., "clientAccount.name"
};

export type TabColumnConfig = {
  tabId: string;
  columns: ColumnConfig[];
};

export type TableColumnConfig = {
  tableId: string; // "leads" | "opportunities"
  tabs: TabColumnConfig[];
};

// Available field definitions for leads
export const LEAD_FIELDS = {
  // Core fields
  id: { label: "ID", path: "id", defaultWidth: 100 },
  name: { label: "Name", path: "name", defaultWidth: 200 },
  email: { label: "Email", path: "email", defaultWidth: 200 },
  phone: { label: "Phone", path: "phone", defaultWidth: 150 },
  source: { label: "Source", path: "source", defaultWidth: 120 },
  status: { label: "Status", path: "status", defaultWidth: 130 },
  createdAt: { label: "Created", path: "createdAt", defaultWidth: 150 },
  updatedAt: { label: "Updated", path: "updatedAt", defaultWidth: 150 },
  
  // Contact fields
  company: { label: "Company", path: "company", defaultWidth: 180 },
  address: { label: "Address", path: "address", defaultWidth: 200 },
  city: { label: "City", path: "city", defaultWidth: 120 },
  county: { label: "County", path: "county", defaultWidth: 120 },
  postcode: { label: "Postcode", path: "postcode", defaultWidth: 100 },
  
  // Lead details
  projectType: { label: "Project Type", path: "projectType", defaultWidth: 150 },
  projectValue: { label: "Project Value", path: "projectValue", defaultWidth: 130 },
  timeline: { label: "Timeline", path: "timeline", defaultWidth: 120 },
  notes: { label: "Notes", path: "notes", defaultWidth: 250 },
  
  // Assignment
  assignedToName: { label: "Assigned To", path: "assignedTo.name", defaultWidth: 150 },
  
  // Client account
  clientAccountName: { label: "Client Account", path: "clientAccount.name", defaultWidth: 180 },
  
  // Metadata
  lastContactedAt: { label: "Last Contacted", path: "lastContactedAt", defaultWidth: 150 },
  nextFollowUpAt: { label: "Next Follow-Up", path: "nextFollowUpAt", defaultWidth: 150 },
  score: { label: "Lead Score", path: "score", defaultWidth: 100 },
  tags: { label: "Tags", path: "tags", defaultWidth: 150 },
};

// Available field definitions for opportunities
export const OPPORTUNITY_FIELDS = {
  // Core fields
  id: { label: "ID", path: "id", defaultWidth: 100 },
  title: { label: "Title", path: "title", defaultWidth: 250 },
  stage: { label: "Stage", path: "stage", defaultWidth: 130 },
  valueGBP: { label: "Value (GBP)", path: "valueGBP", defaultWidth: 130 },
  createdAt: { label: "Created", path: "createdAt", defaultWidth: 150 },
  
  // Dates
  startDate: { label: "Start Date", path: "startDate", defaultWidth: 130 },
  deliveryDate: { label: "Delivery Date", path: "deliveryDate", defaultWidth: 130 },
  wonAt: { label: "Won Date", path: "wonAt", defaultWidth: 130 },
  lostAt: { label: "Lost Date", path: "lostAt", defaultWidth: 130 },
  
  // Materials tracking
  timberOrderedAt: { label: "Timber Ordered", path: "timberOrderedAt", defaultWidth: 130 },
  timberExpectedAt: { label: "Timber Expected", path: "timberExpectedAt", defaultWidth: 130 },
  timberReceivedAt: { label: "Timber Received", path: "timberReceivedAt", defaultWidth: 130 },
  glassOrderedAt: { label: "Glass Ordered", path: "glassOrderedAt", defaultWidth: 130 },
  glassExpectedAt: { label: "Glass Expected", path: "glassExpectedAt", defaultWidth: 130 },
  glassReceivedAt: { label: "Glass Received", path: "glassReceivedAt", defaultWidth: 130 },
  ironmongeryOrderedAt: { label: "Ironmongery Ordered", path: "ironmongeryOrderedAt", defaultWidth: 150 },
  ironmongeryExpectedAt: { label: "Ironmongery Expected", path: "ironmongeryExpectedAt", defaultWidth: 150 },
  ironmongeryReceivedAt: { label: "Ironmongery Received", path: "ironmongeryReceivedAt", defaultWidth: 150 },
  paintOrderedAt: { label: "Paint Ordered", path: "paintOrderedAt", defaultWidth: 130 },
  paintExpectedAt: { label: "Paint Expected", path: "paintExpectedAt", defaultWidth: 130 },
  paintReceivedAt: { label: "Paint Received", path: "paintReceivedAt", defaultWidth: 130 },
  
  // Installation
  installationStartDate: { label: "Install Start", path: "installationStartDate", defaultWidth: 130 },
  installationEndDate: { label: "Install End", path: "installationEndDate", defaultWidth: 130 },
  
  // Relations
  leadName: { label: "Lead Name", path: "lead.name", defaultWidth: 200 },
  clientAccountName: { label: "Client Account", path: "clientAccount.name", defaultWidth: 180 },
};

// Default column configurations for leads tabs
export const DEFAULT_LEAD_COLUMNS: Record<string, ColumnConfig[]> = {
  all: [
    { id: "name", label: "Name", visible: true, frozen: true, width: 200, fieldPath: "name" },
    { id: "email", label: "Email", visible: true, frozen: false, width: 200, fieldPath: "email" },
    { id: "phone", label: "Phone", visible: true, frozen: false, width: 150, fieldPath: "phone" },
    { id: "source", label: "Source", visible: true, frozen: false, width: 120, fieldPath: "source" },
    { id: "status", label: "Status", visible: true, frozen: false, width: 130, fieldPath: "status" },
    { id: "createdAt", label: "Created", visible: true, frozen: false, width: 150, fieldPath: "createdAt" },
  ],
  NEW: [
    { id: "name", label: "Name", visible: true, frozen: true, width: 200, fieldPath: "name" },
    { id: "email", label: "Email", visible: true, frozen: false, width: 200, fieldPath: "email" },
    { id: "phone", label: "Phone", visible: true, frozen: false, width: 150, fieldPath: "phone" },
    { id: "source", label: "Source", visible: true, frozen: false, width: 120, fieldPath: "source" },
    { id: "createdAt", label: "Created", visible: true, frozen: false, width: 150, fieldPath: "createdAt" },
  ],
  CONTACTED: [
    { id: "name", label: "Name", visible: true, frozen: true, width: 200, fieldPath: "name" },
    { id: "email", label: "Email", visible: true, frozen: false, width: 200, fieldPath: "email" },
    { id: "phone", label: "Phone", visible: true, frozen: false, width: 150, fieldPath: "phone" },
    { id: "lastContactedAt", label: "Last Contacted", visible: true, frozen: false, width: 150, fieldPath: "lastContactedAt" },
    { id: "nextFollowUpAt", label: "Next Follow-Up", visible: true, frozen: false, width: 150, fieldPath: "nextFollowUpAt" },
  ],
  QUALIFIED: [
    { id: "name", label: "Name", visible: true, frozen: true, width: 200, fieldPath: "name" },
    { id: "email", label: "Email", visible: true, frozen: false, width: 200, fieldPath: "email" },
    { id: "projectType", label: "Project Type", visible: true, frozen: false, width: 150, fieldPath: "projectType" },
    { id: "projectValue", label: "Project Value", visible: true, frozen: false, width: 130, fieldPath: "projectValue" },
    { id: "timeline", label: "Timeline", visible: true, frozen: false, width: 120, fieldPath: "timeline" },
  ],
  READY_TO_QUOTE: [
    { id: "name", label: "Name", visible: true, frozen: true, width: 200, fieldPath: "name" },
    { id: "email", label: "Email", visible: true, frozen: false, width: 200, fieldPath: "email" },
    { id: "projectType", label: "Project Type", visible: true, frozen: false, width: 150, fieldPath: "projectType" },
    { id: "projectValue", label: "Project Value", visible: true, frozen: false, width: 130, fieldPath: "projectValue" },
    { id: "assignedToName", label: "Assigned To", visible: true, frozen: false, width: 150, fieldPath: "assignedTo.name" },
  ],
};

// Default column configurations for opportunities tabs
export const DEFAULT_OPPORTUNITY_COLUMNS: Record<string, ColumnConfig[]> = {
  all: [
    { id: "title", label: "Title", visible: true, frozen: true, width: 250, fieldPath: "title" },
    { id: "stage", label: "Stage", visible: true, frozen: false, width: 130, fieldPath: "stage" },
    { id: "valueGBP", label: "Value (GBP)", visible: true, frozen: false, width: 130, fieldPath: "valueGBP" },
    { id: "deliveryDate", label: "Delivery Date", visible: true, frozen: false, width: 130, fieldPath: "deliveryDate" },
    { id: "createdAt", label: "Created", visible: true, frozen: false, width: 150, fieldPath: "createdAt" },
  ],
  QUALIFY: [
    { id: "title", label: "Title", visible: true, frozen: true, width: 250, fieldPath: "title" },
    { id: "valueGBP", label: "Value (GBP)", visible: true, frozen: false, width: 130, fieldPath: "valueGBP" },
    { id: "leadName", label: "Lead Name", visible: true, frozen: false, width: 200, fieldPath: "lead.name" },
    { id: "createdAt", label: "Created", visible: true, frozen: false, width: 150, fieldPath: "createdAt" },
  ],
  PROPOSE: [
    { id: "title", label: "Title", visible: true, frozen: true, width: 250, fieldPath: "title" },
    { id: "valueGBP", label: "Value (GBP)", visible: true, frozen: false, width: 130, fieldPath: "valueGBP" },
    { id: "deliveryDate", label: "Delivery Date", visible: true, frozen: false, width: 130, fieldPath: "deliveryDate" },
    { id: "clientAccountName", label: "Client Account", visible: true, frozen: false, width: 180, fieldPath: "clientAccount.name" },
  ],
  NEGOTIATE: [
    { id: "title", label: "Title", visible: true, frozen: true, width: 250, fieldPath: "title" },
    { id: "valueGBP", label: "Value (GBP)", visible: true, frozen: false, width: 130, fieldPath: "valueGBP" },
    { id: "deliveryDate", label: "Delivery Date", visible: true, frozen: false, width: 130, fieldPath: "deliveryDate" },
  ],
  WON: [
    { id: "title", label: "Title", visible: true, frozen: true, width: 250, fieldPath: "title" },
    { id: "valueGBP", label: "Value (GBP)", visible: true, frozen: false, width: 130, fieldPath: "valueGBP" },
    { id: "wonAt", label: "Won Date", visible: true, frozen: false, width: 130, fieldPath: "wonAt" },
    { id: "startDate", label: "Start Date", visible: true, frozen: false, width: 130, fieldPath: "startDate" },
    { id: "deliveryDate", label: "Delivery Date", visible: true, frozen: false, width: 130, fieldPath: "deliveryDate" },
  ],
  COMPLETED: [
    { id: "title", label: "Title", visible: true, frozen: true, width: 250, fieldPath: "title" },
    { id: "valueGBP", label: "Value (GBP)", visible: true, frozen: false, width: 130, fieldPath: "valueGBP" },
    { id: "deliveryDate", label: "Delivery Date", visible: true, frozen: false, width: 130, fieldPath: "deliveryDate" },
    { id: "installationEndDate", label: "Install End", visible: true, frozen: false, width: 130, fieldPath: "installationEndDate" },
  ],
};

// LocalStorage keys
const STORAGE_KEY_PREFIX = "column-config";

/**
 * Get column configuration for a specific table and tab
 */
export function getColumnConfig(
  tableId: string,
  tabId: string,
  defaults: Record<string, ColumnConfig[]>
): ColumnConfig[] {
  const storageKey = `${STORAGE_KEY_PREFIX}-${tableId}`;
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return defaults[tabId] || defaults.all || [];
    }
    
    const parsed: TableColumnConfig = JSON.parse(stored);
    const tabConfig = parsed.tabs.find(t => t.tabId === tabId);
    
    if (tabConfig) {
      return tabConfig.columns;
    }
    
    return defaults[tabId] || defaults.all || [];
  } catch (error) {
    console.error("Error loading column config:", error);
    return defaults[tabId] || defaults.all || [];
  }
}

/**
 * Save column configuration for a specific table and tab
 */
export function saveColumnConfig(
  tableId: string,
  tabId: string,
  columns: ColumnConfig[]
): void {
  const storageKey = `${STORAGE_KEY_PREFIX}-${tableId}`;
  
  try {
    let config: TableColumnConfig;
    
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      config = JSON.parse(stored);
    } else {
      config = { tableId, tabs: [] };
    }
    
    const tabIndex = config.tabs.findIndex(t => t.tabId === tabId);
    if (tabIndex >= 0) {
      config.tabs[tabIndex].columns = columns;
    } else {
      config.tabs.push({ tabId, columns });
    }
    
    localStorage.setItem(storageKey, JSON.stringify(config));
  } catch (error) {
    console.error("Error saving column config:", error);
  }
}

/**
 * Reset column configuration for a specific table and tab to defaults
 */
export function resetColumnConfig(
  tableId: string,
  tabId: string,
  defaults: Record<string, ColumnConfig[]>
): ColumnConfig[] {
  const storageKey = `${STORAGE_KEY_PREFIX}-${tableId}`;
  const defaultColumns = defaults[tabId] || defaults.all || [];
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return defaultColumns;
    }
    
    const config: TableColumnConfig = JSON.parse(stored);
    const tabIndex = config.tabs.findIndex(t => t.tabId === tabId);
    
    if (tabIndex >= 0) {
      config.tabs.splice(tabIndex, 1);
      localStorage.setItem(storageKey, JSON.stringify(config));
    }
  } catch (error) {
    console.error("Error resetting column config:", error);
  }
  
  return defaultColumns;
}

/**
 * Get value from object using dot notation path
 */
export function getFieldValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Format field value for display
 */
export function formatFieldValue(value: any, fieldPath: string): string {
  if (value === null || value === undefined) {
    return "-";
  }
  
  // Date fields
  if (fieldPath.includes("At") || fieldPath.includes("Date")) {
    return new Date(value).toLocaleDateString();
  }
  
  // Currency fields
  if (fieldPath.includes("value") || fieldPath.includes("Value") || fieldPath.includes("GBP")) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(Number(value));
  }
  
  // Arrays
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  
  return String(value);
}
