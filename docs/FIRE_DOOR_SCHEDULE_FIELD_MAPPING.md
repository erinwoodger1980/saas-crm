# Fire Door Schedule - Field Mapping

## Overview

This document maps columns from the existing Excel spreadsheets to the unified `FireDoorScheduleProject` database model.

**Source Spreadsheets:**
1. `2026 TEST SYSTEM.xlsx` - Project tracking and scheduling
2. `NEW 2023 BOM CHECK.xlsx` - BOM verification and production tracking

**Target:** Single unified fire door schedule where **each row = one WON project**.

---

## Logical Sections

The Fire Door Schedule is organized into 7 main sections:

1. **Overview & Identification** - Basic project info, client, dates
2. **Design & Sign-Off** - Schedule approval workflow
3. **BOM & Ordering** - Materials procurement and BOM verification
4. **Production & Capacity** - Manufacturing schedule and progress
5. **Paperwork & Certification** - Documentation and compliance
6. **Delivery & Installation** - Logistics and site work
7. **Communication & Notes** - Internal notes and collaboration

---

## Field Mapping by Section

### 1. Overview & Identification

| Prisma Field | Type | Source Spreadsheet | Source Column | Description |
|--------------|------|-------------------|---------------|-------------|
| `id` | String (CUID) | - | Auto-generated | Primary key |
| `tenantId` | String | - | System | Multi-tenant scope |
| `projectId` | String? | - | Link to existing Project/Quote | Optional reference to Quote/Project |
| `mjsNumber` | String? | LAJ MASTER | MJS No. | Job number (e.g. "mjs1936") |
| `jobName` | String? | LAJ MASTER / BOM CHECK | Job Name / JOB DESCRIPTION | Project name |
| `clientName` | String? | LAJ MASTER / BOM CHECK | Company Name / CUSTOMER | Client company |
| `dateReceived` | DateTime? | LAJ MASTER / BOM CHECK | Date Received / DATE RECEIVED IN RED FOLDER | Date order/enquiry received |
| `dateRequired` | DateTime? | LAJ MASTER | Date Required | Client's required completion date |
| `poNumber` | String? | LAJ MASTER | P/O No. | Purchase order number |
| `laqNumber` | String? | LAJ MASTER | LAQ No. | LAQ reference number |
| `compOrderNumber` | String? | LAJ MASTER | Comp Order No. | Competitor order reference |

### 2. Design & Sign-Off

| Prisma Field | Type | Source Spreadsheet | Source Column | Description |
|--------------|------|-------------------|---------------|-------------|
| `jobLocation` | String? | DATA TAB / BOM CHECK | JOB LOCATION | Status: "RED FOLDER", "IN PROGRESS", "COMPLETE" |
| `signOffStatus` | String? | DATA TAB / BOM CHECK | SIGN OFF STATUS | Status of schedule approval |
| `signOffDate` | DateTime? | BOM CHECK | DATE SIGNED OFF | When schedule was signed off |
| `scheduledBy` | String? | DATA TAB | SCHEDULED BY | Who is responsible (DARREN, DAVE, STEVE, PAUL, DAN) |
| `leadTimeWeeks` | Int? | BOM CHECK | LEAD TIME IN WEEKS | Lead time for project |
| `approxDeliveryDate` | DateTime? | BOM CHECK | APPROX DATE (AUTO ADDS LEAD TIME) | Calculated delivery date |
| `workingDaysRemaining` | Int? | BOM CHECK | APPROX WORKING DAYS REMAINING | Countdown to delivery |

**Sign Off Status Enum Values:**
- AWAITING SCHEDULE
- NOT LOOKED AT
- WORKING ON SCHEDULE
- SCHEDULE SENT FOR SIGN OFF
- SCHEDULE SIGNED OFF

**Job Location Enum Values:**
- RED FOLDER (new enquiry)
- IN PROGRESS
- COMPLETE

**Scheduled By Enum Values:**
- DARREN
- DAVE
- STEVE
- PAUL
- DAN

### 3. BOM & Ordering

| Prisma Field | Type | Source Spreadsheet | Source Column | Description |
|--------------|------|-------------------|---------------|-------------|
| `orderingStatus` | String? | DATA TAB | ORDERING DATA | BOM/ordering status |
| `blanksStatus` | String? | BOM CHECK | BLANKS | Door blank status |
| `blanksChecked` | Boolean | BOM CHECK | BLANKS (checked) | BOM verified |
| `lippingsStatus` | String? | BOM CHECK | LIPPINGS | Lipping status |
| `lippingsChecked` | Boolean | BOM CHECK | LIPPINGS (checked) | BOM verified |
| `facingsStatus` | String? | BOM CHECK | FACINGS | Facing status |
| `facingsChecked` | Boolean | BOM CHECK | FACINGS (checked) | BOM verified |
| `glassStatus` | String? | BOM CHECK | GLASS | Glass status |
| `glassChecked` | Boolean | BOM CHECK | GLASS (checked) | BOM verified |
| `cassettesStatus` | String? | BOM CHECK | CASSETTES | Cassette status |
| `cassettesChecked` | Boolean | BOM CHECK | CASSETTES (checked) | BOM verified |
| `timbersStatus` | String? | BOM CHECK | TIMBERS | Timber status |
| `timbersChecked` | Boolean | BOM CHECK | TIMBERS (checked) | BOM verified |
| `ironmongeryStatus` | String? | DATA TAB / BOM CHECK | IRONMONGERY | Ironmongery procurement status |
| `ironmongeryChecked` | Boolean | BOM CHECK | IRONMONGERY (checked) | BOM verified |

**Ordering Data Enum Values:**
- NOT IN BOM
- IN BOM TBC
- IN BOM
- STOCK
- ORDERED
- RECEIVED
- ORDERED CALL OFF
- MAKE IN HOUSE
- N/A

**Ironmongery Status Enum Values:**
- FROM TGS
- RECEIVED FROM TGS
- FROM CUSTOMER
- RECEIVED FROM CUSTOMER
- OTHER
- NOT ORDERED
- ORDERED
- N/A

**Material Status Enum Values** (for blanks, lippings, facings, glass, cassettes, timbers):
- STOCK
- ORDERED
- RECEIVED
- N/A
- URGENT

### 4. Production & Capacity

| Prisma Field | Type | Source Spreadsheet | Source Column | Description |
|--------------|------|-------------------|---------------|-------------|
| `blanksCutPercent` | Int? | BOM CHECK | BLANKS CUT % | Production progress |
| `edgebandPercent` | Int? | BOM CHECK | EDGEBAND % | Production progress |
| `calibratePercent` | Int? | BOM CHECK | CALIBRATE % | Production progress |
| `facingsPercent` | Int? | BOM CHECK | FACINGS % | Production progress |
| `finalCncPercent` | Int? | BOM CHECK | FINAL CNC % | Production progress |
| `finishPercent` | Int? | BOM CHECK | FINISH % | Production progress |
| `sandPercent` | Int? | BOM CHECK | SAND % | Production progress |
| `sprayPercent` | Int? | BOM CHECK | SPRAY % | Production progress |
| `cutPercent` | Int? | BOM CHECK | CUT % | Production progress |
| `cncPercent` | Int? | BOM CHECK | CNC % | Production progress |
| `buildPercent` | Int? | BOM CHECK | BUILD % | Production progress |
| `overallProgress` | Int? | BOM CHECK | PROGRESS | Overall completion % |
| `hiddenStatus` | String? | BOM CHECK | HIDDEN | Hidden/special status |

### 5. Paperwork & Certification

| Prisma Field | Type | Source Spreadsheet | Source Column | Description |
|--------------|------|-------------------|---------------|-------------|
| `paperworkStatus` | String? | DATA TAB | PAPERWORK STATUS | Overall paperwork status |
| `doorPaperworkStatus` | String? | BOM CHECK | DOOR PAPERWORK | Door-specific paperwork |
| `finalCncSheetStatus` | String? | BOM CHECK | FINAL CNC SHEET | CNC documentation status |
| `finalChecksSheetStatus` | String? | BOM CHECK | FINAL CHECKS SHEET | QA checks documentation |
| `deliveryChecklistStatus` | String? | BOM CHECK | DELIVERY CHECKLIST | Pre-delivery checklist |
| `framesPaperworkStatus` | String? | BOM CHECK | FRAMES PAPERWORK | Frame documentation |
| `certificationRequired` | String? | LAJ MASTER | Certification | Q Mark, etc. |
| `fscRequired` | Boolean | LAJ MASTER | FSC | FSC certification needed |
| `invoiceStatus` | String? | LAJ MASTER | Inv Y / N | Invoicing status |
| `paperworkComments` | String? | BOM CHECK | PAPERWORK COMMENTS | Notes about paperwork |

**Paperwork Status Enum Values:**
- N/A
- WORKING ON SCHEDULE
- READY TO PRINT IN OFFICE
- PRINTED IN OFFICE
- TAKEN OUT TO FACTORY

### 6. Delivery & Installation

| Prisma Field | Type | Source Spreadsheet | Source Column | Description |
|--------------|------|-------------------|---------------|-------------|
| `transportStatus` | String? | BOM CHECK | TRANSPORT | Delivery/transport status |
| `deliveryDate` | DateTime? | - | Calculated/Manual | Actual delivery date |
| `installStart` | DateTime? | - | Manual | Installation start date |
| `installEnd` | DateTime? | - | Manual | Installation completion |
| `snaggingStatus` | String? | - | Manual | Snagging list status |
| `snaggingComplete` | Boolean | - | Manual | Snagging completed flag |
| `snaggingNotes` | String? | - | Manual | Snagging notes |

### 7. Communication & Notes

| Prisma Field | Type | Source Spreadsheet | Source Column | Description |
|--------------|------|-------------------|---------------|-------------|
| `communicationNotes` | String? | BOM CHECK | Communication | General notes |
| `internalNotes` | String? | - | Manual | Internal team notes |
| `lastUpdatedBy` | String? | - | System | Who last modified |
| `lastUpdatedAt` | DateTime | - | System | When last modified |

---

## UI Tab Organization

### Tab 1: Overview
**Columns:** mjsNumber, jobName, clientName, dateReceived, dateRequired, poNumber, jobLocation, signOffStatus, scheduledBy

### Tab 2: Design & Sign-Off
**Columns:** signOffStatus, signOffDate, scheduledBy, leadTimeWeeks, approxDeliveryDate, workingDaysRemaining

### Tab 3: BOM & Ordering
**Columns:** orderingStatus, blanksStatus/Checked, lippingsStatus/Checked, facingsStatus/Checked, glassStatus/Checked, cassettesStatus/Checked, timbersStatus/Checked, ironmongeryStatus/Checked

### Tab 4: Production & QA
**Columns:** All production percentage fields (blanksCut, edgeband, calibrate, facings, finalCnc, finish, sand, spray, cut, cnc, build), overallProgress

### Tab 5: Paperwork & Certification
**Columns:** paperworkStatus, doorPaperworkStatus, finalCncSheetStatus, finalChecksSheetStatus, deliveryChecklistStatus, framesPaperworkStatus, certificationRequired, fscRequired, invoiceStatus

### Tab 6: Delivery & Install
**Columns:** transportStatus, deliveryDate, installStart, installEnd, snaggingStatus, snaggingComplete, snaggingNotes

### Tab 7: Notes / Comms
**Columns:** communicationNotes, internalNotes, paperworkComments, lastUpdatedBy, lastUpdatedAt

---

## Status Workflow

### Typical Project Lifecycle:

1. **New Enquiry** → Job Location: RED FOLDER, Sign Off: AWAITING SCHEDULE
2. **Schedule Design** → Job Location: IN PROGRESS, Sign Off: WORKING ON SCHEDULE
3. **Client Review** → Sign Off: SCHEDULE SENT FOR SIGN OFF
4. **Approved** → Sign Off: SCHEDULE SIGNED OFF
5. **BOM Created** → Ordering: IN BOM, all materials marked STOCK/ORDERED
6. **Production** → Progress percentages update (0% → 100%)
7. **QA & Paperwork** → All paperwork statuses: PRINTED IN OFFICE
8. **Delivery** → Transport status updated, delivery date set
9. **Complete** → Job Location: COMPLETE, Progress: 100%

---

## Implementation Notes

- **One row per project**: No child tables for this model (unless line items needed later)
- **Status fields**: Use enums where possible to constrain values
- **Percentage fields**: Int 0-100 for production progress tracking
- **Boolean "checked" fields**: Separate from status to track BOM verification
- **Tenant scoping**: All queries MUST filter by tenantId
- **Feature flag**: Only show to tenants with `isFireDoorManufacturer = true`
- **Auto-populate**: When Quote is marked WON, auto-create FireDoorScheduleProject

---

## Related Documents

- `FIRE_DOOR_SCHEDULE_API.md` - API endpoint documentation
- `FIRE_DOOR_SCHEDULE_UI.md` - UI component specifications
- `scripts/import-fire-door-schedule.ts` - Excel import script

