# Fire Door Client Portal - Field Mapping & Implementation Guide

## Overview

This document maps the "LAJ & Lloyd Worrall Import Sheet (Master).csv" to the database models for the public-facing fire door client portal system.

**Purpose**: Replace Google Sheet with web-based data entry form and client portal for tracking fire door orders.

**CSV Structure**: 70 columns representing comprehensive door specifications.

---

## Database Models

### 1. ClientAccount
Represents the end customer company (Lloyd Worrall, LAJ, etc.)

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| tenantId | String | Fire door manufacturer (FK to Tenant) |
| companyName | String | Customer company name |
| accountNumber | String? | Internal reference number |
| primaryContact | String? | Main contact person name |
| email | String | Primary email (indexed) |
| phone | String? | Contact phone |
| address | String? | Company address |
| city | String? | City |
| postcode | String? | Postal code |
| country | String | Country (default "UK") |
| isActive | Boolean | Account active status |
| notes | String? | Internal notes |
| createdAt | DateTime | Account creation |
| updatedAt | DateTime | Last modification |

**Relations**:
- `users[]` - ClientUser accounts
- `jobs[]` - FireDoorClientJob submissions

---

### 2. ClientUser
Login accounts for clients to access the portal

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| clientAccountId | String | FK to ClientAccount |
| email | String | Login email (unique, indexed) |
| passwordHash | String | Bcrypt hashed password |
| firstName | String | First name |
| lastName | String | Last name |
| phone | String? | Contact phone |
| jobTitle | String? | Job title/role |
| isActive | Boolean | Account enabled |
| emailVerified | Boolean | Email verification status |
| lastLoginAt | DateTime? | Last login timestamp |
| resetToken | String? | Password reset token |
| resetTokenExpiry | DateTime? | Reset token expiry |
| createdAt | DateTime | User creation |
| updatedAt | DateTime | Last modification |

**Auth Flow**:
1. Email/password login
2. JWT token issued on success
3. Token contains: userId, clientAccountId, tenantId
4. All API calls validated against token

---

### 3. FireDoorClientJob
One submission = one row in this table

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| tenantId | String | Manufacturer (FK) |
| clientAccountId | String | Client who submitted (FK) |
| submittedBy | String? | ClientUser ID |
| **Job Details** | | |
| jobName | String | Project name |
| projectReference | String? | Client's project ref |
| siteAddress | String? | Installation site |
| deliveryAddress | String? | Delivery address |
| contactPerson | String? | Site contact |
| contactEmail | String? | Contact email |
| contactPhone | String? | Contact phone |
| **Order Info** | | |
| poNumber | String? | Purchase order number |
| quoteReference | String? | Related quote ref |
| dateRequired | DateTime? | Required delivery date |
| **Status** | | |
| status | String | Workflow status (see enum below) |
| **Pricing** | | |
| totalPrice | Decimal? | Total job price |
| pricePerUnit | Json? | Breakdown by door item |
| pricedAt | DateTime? | When priced |
| pricedBy | String? | User who priced |
| **Production** | | |
| productionStarted | DateTime? | Production start |
| estimatedCompletion | DateTime? | Est. completion |
| actualCompletion | DateTime? | Actual completion |
| **Communication** | | |
| clientNotes | String? | Client notes at submission |
| internalNotes | String? | Manufacturer internal notes |
| **Timestamps** | | |
| createdAt | DateTime | Record creation |
| updatedAt | DateTime | Last update |
| submittedAt | DateTime | Submission timestamp |

**Status Enum**:
- `PENDING_REVIEW` - Just submitted, awaiting review
- `PRICING_IN_PROGRESS` - Being priced
- `PRICED` - Price calculated, awaiting client approval
- `AWAITING_APPROVAL` - Client reviewing quote
- `APPROVED` - Client approved, ready for production
- `IN_PRODUCTION` - Being manufactured
- `READY_FOR_DELIVERY` - Complete, awaiting shipment
- `DELIVERED` - Shipped/delivered
- `COMPLETE` - Project closed

**Relations**:
- `doorItems[]` - FireDoorClientDoorItem (the doors)
- `rfis[]` - FireDoorClientRFI (questions/clarifications)

---

### 4. FireDoorClientDoorItem
One row per door in the schedule (70 specification columns from CSV)

## CSV Column Mapping

| # | CSV Header | Field Name | Type | Description |
|---|------------|------------|------|-------------|
| 1 | Sequence | sequence | String? | Door sequence number |
| 2 | Door Ref | doorRef | String? | Door reference ID |
| 3 | Location | location | String? | Room/location |
| 4 | Quantity | quantity | Int? | Number of doors |
| 5 | Type | type | String? | Door type |
| 6 | Core Type | coreType | String? | Core material type |
| 7 | Fire Rating | fireRating | String? | Fire rating (FD30, FD60, etc.) |
| 8 | Acoustic Rating | acousticRating | String? | Acoustic rating |
| 9 | Threshold Seal Type | thresholdSealType | String? | Threshold seal |
| 10 | Doorset / Leaf / Frame | doorsetLeafFrame | String? | Component type |
| 11 | Configuration | configuration | String? | Door configuration |
| 12 | Master Leaf Width | masterLeafWidth | Decimal? | Leaf width (mm) |
| 13 | SO H | soH | String? | Set out height |
| 14 | SO W | soW | String? | Set out width |
| 15 | OF H | ofH | String? | Opening front height |
| 16 | OF W | ofW | String? | Opening front width |
| 17 | S/O Wall Thickness | sOWallThickness | Decimal? | Wall thickness |
| 18 | Frame Material | frameMaterial | String? | Frame material |
| 19 | Frame Finish | frameFinish | String? | Frame finish type |
| 20 | Frame Type | frameType | String? | Frame type |
| 21 | Anti Barricade / Emergency Stops | antiBarricadeEmergencyStops | String? | Safety features |
| 22 | Architrave Material/Finish | architraveMaterialFinish | String? | Architrave spec |
| 23 | Arc Width | arcWidth | Decimal? | Architrave width |
| 24 | Arc Depth | arcDepth | Decimal? | Architrave depth |
| 25 | Door Facing | doorFacing | String? | Door facing material |
| 26 | Door Finish | doorFinish | String? | Door finish type |
| 27 | Door Colour | doorColour | String? | Door color |
| 28 | Lipping Material | lippingMaterial | String? | Lipping material |
| 29 | Door Action | doorAction | String? | Door opening action |
| 30 | Door Undercut | doorUndercut | String? | Undercut measurement |
| 31 | Aperture | aperture | String? | Vision panel type |
| 32 | Aperture Width | apertureWidth | Decimal? | Vision panel width |
| 33 | Aperture Height | apertureHeight | Decimal? | Vision panel height |
| 34 | Vistamatic Supply Type | vistamaticSupplyType | String? | Vision panel supply |
| 35 | Vistmatic Hardware Side 1 | vistmaticHardwareSide1 | String? | Hardware side 1 |
| 36 | Vistamatic Hardware Side 2 | vistamaticHardwareSide2 | String? | Hardware side 2 |
| 37 | Bead Type | beadType | String? | Bead type |
| 38 | Bead Material | beadMaterial | String? | Bead material |
| 39 | LW Glass Type | lwGlassType | String? | Glass type |
| 40 | Hinge Supply Type | hingeSupplyType | String? | Hinge supply option |
| 41 | Hinge Fitting | hingeFitting | String? | Hinge fitting |
| 42 | Hinge Type | hingeType | String? | Hinge type |
| 43 | Hinge Configuration | hingeConfiguration | String? | Hinge config |
| 44 | Handing | handing | String? | Left/right handing |
| 45 | Lock Supply / Prep | lockSupplyPrep | Boolean? | Lock prep required |
| 46 | Lock Fitting | lockFitting | String? | Lock fitting |
| 47 | Lock Type 1 | lockType1 | String? | Primary lock type |
| 48 | Lock Height to Spindle 1 | lockHeightToSpindle1 | Decimal? | Lock 1 height |
| 49 | Spindle Prep | spindlePrep | Boolean? | Spindle prep required |
| 50 | Cylinder Prep | cylinderPrep | Boolean? | Cylinder prep required |
| 51 | Lock Type 2 | lockType2 | String? | Secondary lock type |
| 52 | Lock Height to Spindle 2 | lockHeightToSpindle2 | Decimal? | Lock 2 height |
| 53 | Closers / Floor Springs | closersFloorSprings | String? | Door closers |
| 54 | Flush Bolt Supply/Prep | flushBoltSupplyPrep | Boolean? | Flush bolt prep |
| 55 | Specials | specials | String? | Special requirements |
| 56 | Lead Lining Code | leadLiningCode | String? | Lead lining spec |
| 57 | Overpanel Details | overpanelDetails | String? | Overpanel details |
| 58 | Screen Details | screenDetails | String? | Screen details |
| 59 | Air Transfer Grille Requirement | airTransferGrilleRequirement | String? | ATG required |
| 60 | Air Transfer Grille Size | airTransferGrilleSize | Decimal? | ATG size |
| 61 | Air Transfer Grille Position | airTransferGrillePosition | String? | ATG position |
| 62 | Door Edge Protection Type | doorEdgeProtectionType | Boolean? | Edge protection |
| 63 | Door Edge Protection Position | doorEdgeProtectionPosition | Boolean? | Edge protection pos |
| 64 | Kick Plates | kickPlates | String? | Kick plate spec |
| 65 | PVC Face Protection | pvcFaceProtection | Boolean? | PVC protection |
| 66 | Wiring Prep | wiringPrep | Boolean? | Wiring prep |
| 67 | Free Issue Cable Loop Prep | freeIssueCableLoopPrep | Boolean? | Cable loop prep |
| 68 | Fire ID Disc | fireIdDisc | String? | Fire ID disc |
| 69 | Ironmongery Pack Ref | ironmongeryPackRef | String? | Ironmongery pack |
| 70 | Comments | comments | String? | Additional comments |

**Additional Fields** (not in CSV):
- `rowNumber` (Int?) - Row sequence in submission
- `unitPrice` (Decimal?) - Price per door
- `lineTotal` (Decimal?) - Total for this line (quantity × unitPrice)
- `rawRowJson` (Json?) - Complete row as JSON for audit trail

---

### 5. FireDoorClientRFI
Request for Information - client questions/clarifications

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| tenantId | String | Manufacturer |
| fireDoorClientJobId | String | Related job |
| subject | String | RFI subject line |
| question | String | Client's question |
| doorItemRef | String? | Specific door reference if applicable |
| response | String? | Manufacturer's answer |
| respondedBy | String? | User ID who responded |
| respondedAt | DateTime? | Response timestamp |
| status | String | OPEN \| ANSWERED \| CLOSED |
| priority | String | LOW \| NORMAL \| HIGH \| URGENT |
| createdAt | DateTime | RFI creation |
| updatedAt | DateTime | Last update |

---

## Implementation Status

### ✅ Completed
1. **Database Models** - All 4 core models with 70 CSV fields mapped
2. **Schema Deployed** - Prisma schema pushed to production database
3. **Field Mapping** - Complete CSV → DB mapping documented

### ⏳ In Progress
- API endpoints
- Public entry form
- Client portal UI

### 📋 Remaining Tasks
1. Public job submission API
2. Spreadsheet-style data entry form
3. Client authentication system
4. Client portal dashboard & job details
5. Pricing engine integration
6. RFI management UI
7. Access control & permissions

---

## API Endpoints (To Be Implemented)

### Public Routes (No Auth Required)
```
POST   /api/public/fire-doors/[tenantSlug]/jobs
  - Submit new job with door items
  - Validate tenant is fire door manufacturer
  - Create ClientAccount if new
  - Create FireDoorClientJob + doorItems
  - Trigger pricing workflow
  - Return job ID + submission confirmation
```

### Client Portal Routes (Requires Auth)
```
POST   /api/client/auth/login
POST   /api/client/auth/signup
POST   /api/client/auth/forgot-password
POST   /api/client/auth/reset-password

GET    /api/client/jobs
  - List all jobs for client account
  - Filter by status, date range
  - Include pricing, RFI count

GET    /api/client/jobs/:id
  - Get full job details
  - Include all door items
  - Include RFIs
  - Include pricing breakdown

POST   /api/client/jobs/:id/rfis
  - Submit new RFI
GET    /api/client/jobs/:id/rfis
  - List all RFIs for job
```

---

## Frontend Routes (To Be Implemented)

### Public Access
```
/public/fire-doors/[tenantSlug]/new-job
  - Job details form (top section)
  - Editable spreadsheet grid (70 columns)
  - Add/remove rows
  - Copy/paste support
  - Submit → create job
```

### Client Portal (Auth Required)
```
/client/login
  - Email/password login
  - Forgot password link
  
/client/signup
  - New client registration
  - Email verification

/client/jobs
  - Dashboard view
  - Job list with status filters
  - Search by job name, PO, ref
  - Stat cards (total, pending, in progress, complete)

/client/jobs/[id]
  - Job details (top)
  - Door schedule table (read-only)
  - Pricing section (if available)
  - RFI list + submit new RFI
  - Progress timeline
```

---

## Security & Access Control

### Multi-Tenant Isolation
- All queries scoped by `tenantId`
- ClientAccount linked to specific tenant
- No cross-tenant data access

### Feature Flag
- `isFireDoorManufacturer` on TenantSettings
- Public form only accessible if flag = true
- API returns 404 if flag = false

### Client Authentication
- JWT tokens with payload: `{ userId, clientAccountId, tenantId }`
- Token expiry: 24 hours
- Refresh token: 30 days
- Password requirements: Min 8 chars, 1 uppercase, 1 number

### Data Validation
- All numeric fields validated (positive, reasonable ranges)
- Enum fields validated against allowed values
- Required fields: quantity, doorRef, location minimum

---

## Pricing Integration

### Workflow
1. Job submitted → Status = PENDING_REVIEW
2. Admin reviews → Triggers pricing
3. System calls fire door pricing calculator API
4. Calculator returns:
   - Per-door pricing (unitPrice)
   - Line totals (quantity × unitPrice)
   - Job total (sum of all line totals)
5. Update FireDoorClientJob:
   - totalPrice
   - pricePerUnit (JSON)
   - pricedAt
   - status = PRICED
6. Client notified via email
7. Client views quote in portal
8. Client approves → status = APPROVED

### Pricing Calculator Connection
- Existing endpoint: `/api/fire-door-calculator/calculate`
- Input: Door specifications (from FireDoorClientDoorItem)
- Output: Pricing breakdown
- Falls back to manual pricing if auto-calc unavailable

---

## Next Steps

See active TODO list for implementation phases.

Priority order:
1. Public job submission API (enables data collection)
2. Public spreadsheet form (enables client submissions)
3. Client authentication (enables portal access)
4. Client portal dashboard (enables order tracking)
5. Pricing integration (completes workflow)
6. RFI system (enables communication)

---

## Testing Checklist

### Database
- [x] Schema pushed successfully
- [ ] Test data created
- [ ] All relations working
- [ ] Indexes performant

### API
- [ ] Public job submission works
- [ ] Duplicate prevention
- [ ] Validation catches bad data
- [ ] Pricing triggers correctly
- [ ] Client auth works
- [ ] Portal queries tenant-scoped

### Frontend
- [ ] Public form loads
- [ ] Grid editable, add/remove rows
- [ ] Copy/paste works
- [ ] Submission succeeds
- [ ] Client login works
- [ ] Dashboard shows jobs
- [ ] Job details complete
- [ ] RFI submission works

### Security
- [ ] No cross-tenant access
- [ ] Auth tokens expire
- [ ] Password reset secure
- [ ] Feature flag enforced
- [ ] SQL injection prevented
- [ ] XSS prevented

---

## Maintenance

### Adding New Fields
1. Update CSV mapping in this doc
2. Add field to FireDoorClientDoorItem model
3. Run `prisma db push`
4. Update API validation
5. Update frontend form grid
6. Update portal display

### Common Enum Values
Document standard values for enum-like fields:
- Fire Rating: FD30, FD60, FD90, FD120
- Handing: LH, RH, LHRH (pair)
- Configuration: Single, Pair, 1.5 leaf, etc.
- Status: (see FireDoorClientJob status enum above)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-24  
**Author**: AI Implementation  
**Status**: Foundation Complete, APIs & UI Pending
