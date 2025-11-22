# Shopping List & Purchase Order System

## Overview
Multi-tenant procurement workflow for generating shopping lists from quotes and creating purchase orders grouped by supplier.

## Prisma Schema Changes

### New Models

1. **Supplier** (replaces duplicate)
   - Unique per tenant code
   - Default currency support
   - Active status flag

2. **MaterialItem**
   - Links to Supplier
   - Categories: door_blank, lipping, ironmongery, glass, timber, board, veneer, finish, hardware, consumable
   - Stock tracking (quantity, min level)
   - Cost and lead time

3. **ShoppingList**
   - Links to Quote (optional)
   - Status: DRAFT → APPROVED → ORDERED → RECEIVED
   - Tenant-scoped

4. **ShoppingListItem**
   - Links to MaterialItem
   - Optional description override
   - Tracks source QuoteLine
   - Quantity + unit

5. **PurchaseOrder**
   - Groups items by Supplier
   - Status: DRAFT → SENT → CONFIRMED → PARTIALLY_RECEIVED → RECEIVED
   - Order number and dates
   - Total amount tracking

6. **PurchaseOrderLine**
   - Links to MaterialItem
   - Quantity ordered vs received
   - Unit price and line total

### Enums
- `MaterialItemCategory` - 11 categories for material classification
- `ShoppingListStatus` - 5 states for list workflow
- `PurchaseOrderStatus` - 6 states for PO workflow

## Services

### 1. Shopping List Generator (`shopping-list-generator.ts`)

**Main Functions:**

- `generateShoppingListForQuote(quoteId, tenantId)`
  - Loads quote with lines (tenant-scoped)
  - Calls `getMaterialsForLine()` for each line (stub for BOM logic)
  - Aggregates quantities by materialItemId + unit
  - Creates ShoppingList + ShoppingListItems in transaction
  - Returns created list with items

- `updateShoppingListStatus(listId, tenantId, status)`
  - Updates list status
  - Returns updated list with items

- `getShoppingList(listId, tenantId)`
  - Loads list with items, materials, suppliers
  - Tenant-scoped query

**BOM Stub (`getMaterialsForLine`):**
Placeholder that should be implemented to:
- Parse quote line meta/description
- Look up door construction specs
- Calculate door blanks, lipping, ironmongery packs
- Determine glass requirements
- Return array of `{ materialItemId, quantity, unit }`

### 2. Purchase Order Generator (`purchase-order-generator.ts`)

**Main Functions:**

- `generatePurchaseOrdersFromShoppingList(listId, tenantId)`
  - Validates list is APPROVED
  - Loads items with MaterialItem + Supplier
  - Groups items by supplierId
  - Creates one PO per supplier with lines
  - Calculates line totals and PO total
  - Updates shopping list to ORDERED
  - Returns array of POs with lines

- `updatePurchaseOrderStatus(poId, tenantId, status, orderNumber?)`
  - Updates PO status
  - Sets order number when SENT
  - Sets received date when RECEIVED

- `recordPurchaseOrderLineReceipt(lineId, tenantId, receivedQty)`
  - Updates line receivedQuantity
  - Updates MaterialItem stock (increment)
  - Auto-updates PO status:
    - All lines fully received → RECEIVED
    - Any lines partially received → PARTIALLY_RECEIVED
  - Returns updated line with PO

- `getPurchaseOrder(poId, tenantId)`
  - Loads PO with supplier and lines
  - Tenant-scoped

- `getPurchaseOrdersForTenant(tenantId, filters?)`
  - Lists POs with optional filters:
    - supplierId
    - status
    - fromDate/toDate
  - Orders by orderDate descending

## Workflow

```
Quote → Shopping List → Purchase Orders → Material Receipt

1. Quote created/approved
2. Generate Shopping List (DRAFT)
   └─ Aggregates materials from quote lines
3. Approve Shopping List (APPROVED)
4. Generate Purchase Orders (per supplier)
   └─ Shopping List → ORDERED
   └─ POs created as DRAFT
5. Send POs to suppliers (SENT)
6. Suppliers confirm (CONFIRMED)
7. Materials arrive (PARTIALLY_RECEIVED → RECEIVED)
   └─ Stock levels updated
```

## Multi-Tenant Safety
- All queries scoped by `tenantId`
- Relations use `onDelete: Cascade` for tenant cleanup
- Supplier/MaterialItem use `onDelete: Restrict` to prevent accidental deletion
- Transaction-based operations ensure consistency

## Next Steps

1. **Run migration:**
   ```bash
   cd api
   npx prisma migrate dev --name add_procurement_system
   ```

2. **Implement BOM logic in `getMaterialsForLine()`:**
   - Parse door specifications from quote line
   - Look up material requirements
   - Calculate quantities based on dimensions

3. **Create API endpoints:**
   - POST `/api/shopping-lists/generate` (from quote)
   - PATCH `/api/shopping-lists/:id/status`
   - POST `/api/purchase-orders/generate` (from shopping list)
   - POST `/api/purchase-orders/:id/lines/:lineId/receive`
   - GET `/api/purchase-orders` (with filters)

4. **Add UI:**
   - Shopping list review/approval interface
   - PO generation and management
   - Material receipt tracking
   - Stock level monitoring

5. **Future enhancements:**
   - Auto-email POs to suppliers
   - Expected delivery tracking
   - Supplier performance analytics
   - Stock reorder alerts
   - Material cost history

## Manual Purchase Order Upload & ML Cost Learning

In addition to generating Purchase Orders from shopping lists, users can upload a supplier Purchase Order that was created externally.

### Endpoint

POST `/purchase-orders/upload`

### Request Options
- Multipart with `file` (CSV) plus fields: `supplierName`, optional `opportunityId`, optional `purchaseOrderRef`.
- Or JSON body with `lines: [{ code, name, quantity, unit, unitPrice, currency }]`.

### Behavior
1. Resolves or creates the Supplier.
2. Creates a `PurchaseOrder` with status `RECEIVED` (historical cost snapshot).
3. For each line:
    - Matches existing `MaterialItem` by `code` (fallback by `name`).
    - Creates the item if missing (category `consumable`).
    - Compares `unitPrice` with stored `MaterialItem.cost`; updates cost if changed.
    - Records change in response `priceChangeAlerts` with delta %.
4. Persists PO lines and updates PO total.
5. Sends material cost records to ML service `/save-material-costs` for trend tracking.

### ML Material Cost Table (ml_material_costs)
Stores historical snapshots: material_code, supplier_name, unit_price, previous_unit_price, price_change_percent, purchase_order_id, captured_at.

### Example CSV Headers
`code,name,quantity,unit,unitPrice,currency`

### Response Payload
```
{
   ok: true,
   purchaseOrderId: "po_...",
   supplier: "Accoya Ltd",
   linesUploaded: 12,
   priceChangeAlerts: [
      { code: "ACC123", oldCost: 4.50, newCost: 4.95, deltaPercent: 10.0 }
   ],
   materialCostsSaved: 12,
   totalAmount: 1530.75
}
```

### Use Case: Accoya Price Increase
When a new PO shows higher Accoya unit cost, the modal can surface the change (from last stored cost) so estimators adjust markups promptly.

