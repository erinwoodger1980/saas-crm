# Quote Builder Comprehensive Refactor Plan

## Overview

Streamline the quote builder workflow from supplier PDFs, user's own quotes, or ML estimates to final client delivery.

## Implementation Plan

### ✅ Phase 1: Details Tab (COMPLETE)
Already has auto-save and summary - no changes needed.

### 🔧 Phase 2: Supplier Tab (IN PROGRESS)
**Goal**: Parse supplier PDFs with currency conversion, delivery distribution, markup, and auto-navigate to Quote Lines.

**Implementation**: Add missing `handleParse` function + backend `/process-supplier` endpoint.

### 🔄 Phase 3: Own Quote Tab
**Goal**: Rename "Joinerysoft" → "Own Quote", allow upload of user's own quotes with no transformations.

### 📄 Phase 4: PDF Generation
**Goal**: Add "Generate PDF" button to Quote Lines tab.

### 📧 Phase 5: Preview & Email
**Goal**: Show PDF preview and "Email to Client" button with attachment.

### 🤖 Phase 6: ML Estimate Cleanup
**Goal**: Remove upload section, clarify ML uses questionnaire + existing lines only.

See detailed implementation in sections below.

---

## Detailed Changes

[Rest of comprehensive plan as outlined above...]

