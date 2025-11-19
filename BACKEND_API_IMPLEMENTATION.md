# Backend API Implementation Guide

## Overview
This document outlines the remaining backend API endpoints needed to complete the quote builder refactor. All frontend UI and logic is implemented - these endpoints are the missing pieces.

## Required Endpoints

### 1. POST `/quotes/:id/process-supplier`
**Purpose:** Process uploaded supplier PDFs with transformations (currency conversion, delivery distribution, markup)

**Request Body:**
```typescript
{
  convertCurrency: boolean;      // Apply currency conversion if not GBP
  distributeDelivery: boolean;   // Distribute delivery cost across other lines
  hideDeliveryLine: boolean;     // Remove delivery line after distribution
  applyMarkup: boolean;          // Apply tenant markup percentage
}
```

**Processing Steps:**
1. Parse all supplier PDFs attached to the quote
2. Extract line items (description, qty, unit price, currency)
3. **Currency Conversion:**
   - If currency is not GBP, convert using current exchange rates
   - Store original currency/price in meta field for reference
4. **Delivery Distribution:**
   - Find line items matching "delivery" (case-insensitive in description)
   - Calculate delivery total
   - Distribute proportionally across other line items based on their value
   - If `hideDeliveryLine: true`, remove delivery line after distribution
5. **Markup Application:**
   - Get tenant's markup percentage from settings/config
   - Apply markup to each line item: `sellPrice = unitPrice * (1 + markupPercent/100)`
   - Store markup amount in meta for transparency
6. Save processed lines to `parsed_lines` table
7. Update quote status to "lines-generated" or similar

**Response:**
```typescript
{
  success: true;
  linesCreated: number;
  currencyConverted: boolean;
  deliveryDistributed: boolean;
  markupApplied: boolean;
}
```

**Error Cases:**
- No supplier files attached: 400 "No supplier files found"
- PDF parsing fails: 500 "Failed to parse supplier PDFs"
- Currency conversion fails: 500 "Currency conversion service unavailable"

---

### 2. POST `/quotes/:id/generate-pdf`
**Purpose:** Generate PDF quote from line items

**Request Body:**
```typescript
{
  includeQuestionnaire?: boolean;  // Include questionnaire summary in PDF
  includeNotes?: boolean;          // Include quote notes
  template?: string;               // PDF template to use (default, minimal, detailed)
}
```

**Processing Steps:**
1. Fetch quote with all line items
2. Calculate totals (subtotal, VAT if applicable, grand total)
3. Get tenant branding/logo for PDF header
4. Generate PDF using template engine (e.g., Puppeteer, PDFKit, or similar)
5. Upload PDF to cloud storage (S3, R2, etc.)
6. Update quote with `proposalPdfUrl`
7. Return PDF URL

**Response:**
```typescript
{
  success: true;
  pdfUrl: string;
  fileName: string;
}
```

**Error Cases:**
- No line items: 400 "No line items to generate PDF from"
- PDF generation fails: 500 "Failed to generate PDF"
- Upload fails: 500 "Failed to upload PDF"

---

### 3. POST `/quotes/:id/send-email`
**Purpose:** Email the quote PDF to the client

**Request Body:**
```typescript
{
  recipientEmail?: string;  // Override default lead email
  subject?: string;         // Override default subject
  message?: string;         // Override default message body
  ccEmails?: string[];      // Additional CC recipients
}
```

**Processing Steps:**
1. Get lead email from quote's `leadId` (or use override)
2. Validate email address
3. Get PDF from `proposalPdfUrl` (or generate if missing)
4. Compose email:
   - **Default Subject:** "Quote #{quoteId} from {tenantName}"
   - **Default Body:**
     ```
     Hi,

     Please find attached your quote from {tenantName}.

     Quote Summary:
     - Total: {currency}{grandTotal}
     - Line Items: {lineCount}
     - Valid Until: {validUntil or "30 days"}

     If you have any questions, please don't hesitate to contact us.

     Best regards,
     {tenantName}
     ```
5. Attach PDF to email
6. Send via email service (SendGrid, AWS SES, etc.)
7. Log activity: Create email_sent activity record
8. Update quote status to "sent" if first time sending

**Response:**
```typescript
{
  success: true;
  sentTo: string;
  sentAt: string;
  messageId: string;  // Email service message ID for tracking
}
```

**Error Cases:**
- No lead email: 400 "No email address found for this lead"
- Invalid email: 400 "Invalid email address"
- No PDF: 400 "PDF must be generated before sending email"
- Email service error: 500 "Failed to send email"

---

### 4. POST `/quotes/:id/process-own-quote` (Optional - separate from supplier)
**Purpose:** Process uploaded "own quote" PDFs WITHOUT transformations

**Request Body:**
```typescript
{} // No transformation flags needed
```

**Processing Steps:**
1. Parse own quote PDFs
2. Extract line items as-is (NO currency conversion, NO markup, KEEP delivery lines)
3. Save to `parsed_lines` table
4. Update quote status

**Response:**
```typescript
{
  success: true;
  linesCreated: number;
}
```

**Note:** This could also be handled by the `/process-supplier` endpoint with all flags set to `false`, but keeping separate might be clearer for business logic.

---

## Database Schema Considerations

### `parsed_lines` table
Ensure these fields exist:
```sql
- id
- quote_id (FK)
- description
- qty
- unit_price (original from supplier)
- sell_price (after markup)
- total (qty * sell_price)
- currency
- meta (JSON - store original price, markup amount, delivery distribution, etc.)
- source (enum: 'supplier', 'ml', 'manual', 'own')
- created_at
- updated_at
```

### `quotes` table
Ensure these fields exist:
```sql
- proposal_pdf_url (TEXT - cloud storage URL)
- status (enum: add 'lines-generated', 'sent', etc.)
```

### `activities` table (for email tracking)
```sql
- id
- quote_id (FK)
- type (enum: add 'email_sent')
- meta (JSON - store recipient, subject, message_id)
- created_at
```

---

## Implementation Priority

1. **High Priority:**
   - `/quotes/:id/process-supplier` - Required for Supplier tab workflow
   - `/quotes/:id/generate-pdf` - Required for Quote Lines → Preview workflow

2. **Medium Priority:**
   - `/quotes/:id/send-email` - Required for final client delivery

3. **Low Priority:**
   - `/quotes/:id/process-own-quote` - Can initially use process-supplier with flags

---

## Testing Checklist

### Supplier Processing
- [ ] Upload supplier PDF in GBP (no conversion needed)
- [ ] Upload supplier PDF in EUR (should convert to GBP)
- [ ] Upload supplier PDF in USD (should convert to GBP)
- [ ] Upload supplier PDF with delivery line (should distribute and hide)
- [ ] Upload supplier PDF with multiple delivery lines
- [ ] Verify markup applied correctly (check tenant settings)
- [ ] Verify lines appear in Quote Lines tab after processing

### PDF Generation
- [ ] Generate PDF with 1 line item
- [ ] Generate PDF with 50+ line items
- [ ] Generate PDF with long descriptions (text wrapping)
- [ ] Generate PDF with special characters in descriptions
- [ ] Verify PDF includes tenant logo/branding
- [ ] Verify PDF totals match line items
- [ ] Verify PDF URL is accessible

### Email Sending
- [ ] Send email with valid lead email
- [ ] Send email with override email
- [ ] Send email with CC recipients
- [ ] Verify PDF attached correctly
- [ ] Verify email received in inbox (not spam)
- [ ] Verify activity logged in database
- [ ] Verify quote status updated to "sent"
- [ ] Test email service rate limits/errors

### Own Quote Processing
- [ ] Upload own quote PDF
- [ ] Verify NO currency conversion applied
- [ ] Verify NO markup applied
- [ ] Verify delivery line KEPT as separate line
- [ ] Verify lines appear correctly in Quote Lines tab

---

## Currency Conversion

### Recommended Service
Use **exchangerate-api.com** or **fixer.io** for real-time rates.

### Example Implementation
```typescript
async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string = 'GBP'
): Promise<number> {
  if (fromCurrency === toCurrency) return amount;
  
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return amount * rate;
}

async function getExchangeRate(from: string, to: string): Promise<number> {
  // Cache rates for 1 hour to avoid excessive API calls
  const cacheKey = `exchange_${from}_${to}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;
  
  const response = await fetch(
    `https://api.exchangerate-api.com/v4/latest/${from}`
  );
  const data = await response.json();
  const rate = data.rates[to];
  
  await cache.set(cacheKey, rate, 3600); // 1 hour TTL
  return rate;
}
```

---

## Delivery Distribution Algorithm

### Example Implementation
```typescript
function distributeDelivery(lines: ParsedLine[]): ParsedLine[] {
  // Find delivery lines
  const deliveryLines = lines.filter(line => 
    line.description?.toLowerCase().includes('delivery')
  );
  
  if (deliveryLines.length === 0) return lines;
  
  // Calculate total delivery cost
  const totalDelivery = deliveryLines.reduce(
    (sum, line) => sum + (line.unitPrice || 0) * (line.qty || 1), 
    0
  );
  
  // Get non-delivery lines
  const nonDeliveryLines = lines.filter(line => 
    !line.description?.toLowerCase().includes('delivery')
  );
  
  // Calculate total value of non-delivery lines
  const totalValue = nonDeliveryLines.reduce(
    (sum, line) => sum + (line.unitPrice || 0) * (line.qty || 1),
    0
  );
  
  // Distribute delivery proportionally
  const distributedLines = nonDeliveryLines.map(line => {
    const lineValue = (line.unitPrice || 0) * (line.qty || 1);
    const proportion = totalValue > 0 ? lineValue / totalValue : 0;
    const deliveryShare = totalDelivery * proportion;
    
    return {
      ...line,
      unitPrice: line.unitPrice + (deliveryShare / (line.qty || 1)),
      meta: {
        ...line.meta,
        deliveryDistributed: deliveryShare,
        originalPrice: line.unitPrice,
      }
    };
  });
  
  return distributedLines;
}
```

---

## Markup Application

### Example Implementation
```typescript
async function applyMarkup(
  lines: ParsedLine[],
  tenantId: string
): Promise<ParsedLine[]> {
  // Get tenant markup percentage from settings
  const tenant = await getTenantSettings(tenantId);
  const markupPercent = tenant.markupPercent || 20; // Default 20%
  
  return lines.map(line => ({
    ...line,
    sellPrice: line.unitPrice * (1 + markupPercent / 100),
    meta: {
      ...line.meta,
      markupPercent,
      markupAmount: line.unitPrice * (markupPercent / 100),
      originalPrice: line.unitPrice,
    }
  }));
}
```

---

## Frontend API Client Functions

Already implemented in the frontend, waiting for these endpoints:

```typescript
// In handleParse() - calls /process-supplier
const res = await apiFetch(`/quotes/${quoteId}/process-supplier`, {
  method: 'POST',
  body: JSON.stringify({
    convertCurrency: true,
    distributeDelivery: true,
    hideDeliveryLine: true,
    applyMarkup: true,
  }),
});

// In handleGenerateQuotePdf() - calls /generate-pdf
const res = await apiFetch(`/quotes/${quoteId}/generate-pdf`, {
  method: 'POST',
  body: JSON.stringify({
    includeQuestionnaire: true,
    includeNotes: true,
  }),
});

// In handleEmailToClient() - calls /send-email
const res = await apiFetch(`/quotes/${quoteId}/send-email`, {
  method: 'POST',
  body: JSON.stringify({}),
});
```

---

## Estimated Implementation Time

- `/process-supplier`: 3-4 hours (currency API integration, delivery logic, markup)
- `/generate-pdf`: 4-6 hours (PDF template design, generation, cloud upload)
- `/send-email`: 2-3 hours (email service integration, activity logging)
- Testing: 2-3 hours
- **Total: 11-16 hours**

---

## Next Steps

1. Implement `/process-supplier` endpoint first (enables Supplier tab workflow)
2. Implement `/generate-pdf` endpoint (enables Quote Lines → Preview)
3. Implement `/send-email` endpoint (completes full workflow)
4. Add error handling and validation
5. Test each endpoint thoroughly
6. Document API in OpenAPI/Swagger format
