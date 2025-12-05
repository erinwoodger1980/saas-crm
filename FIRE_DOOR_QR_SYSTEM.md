# Fire Door QR Code System Implementation Guide

## Overview
Comprehensive QR code system for tracking fire door production, installation, and maintenance.

## Features Implemented

### 1. **Workshop Process QR Codes**
- Generate unique QR code for each line item + process combination
- Configurable display fields per process (cutting, lipping, edging, etc.)
- Custom instructions per process
- Scan tracking with timestamp and user

### 2. **Dispatch/Installation QR Codes**
- QR code on completed doors for installers
- Shows fitting instructions and specifications
- Installer can add notes during installation
- Tracks installation date

### 3. **Maintenance QR Codes**
- Long-term door tracking for maintenance contractors
- Scan to view maintenance history
- Add maintenance records (annual inspection, repairs)
- Photo attachments for documentation
- Next maintenance due date tracking

## Database Schema

### New Models Added:

```prisma
// Configuration for what to show per process
model FireDoorProcessQRConfig {
  tenantId      String
  processName   String   // e.g., "Cutting", "Lipping"
  displayFields Json     // Array of field names to show
  instructions  String?  // Instructions for workshop staff
}

// Tracks every QR scan
model FireDoorQRScan {
  tenantId    String
  lineItemId  String?  // Workshop line item
  doorItemId  String?  // Client door item
  scanType    String   // "PROCESS", "DISPATCH", "MAINTENANCE"
  processName String?
  scannedBy   String?
  scannedAt   DateTime
}

// Maintenance history
model FireDoorMaintenanceRecord {
  doorItemId      String
  performedBy     String?
  performedAt     DateTime
  maintenanceType String  // "ANNUAL", "REPAIR", "INSPECTION"
  status          String  // "PASS", "FAIL", "NEEDS_ATTENTION"
  findings        String?
  actionsTaken    String?
  photos          Json
  nextDueDate     DateTime?
}
```

### Extended Fields on FireDoorClientDoorItem:
- `installationDate`
- `lastMaintenanceDate`
- `nextMaintenanceDate`
- `maintenanceNotes`
- `fittingInstructions`
- `installerNotes`

## API Endpoints

### Process Configuration
- `GET /fire-door-qr/process-configs` - List all configs
- `POST /fire-door-qr/process-configs` - Create/update config

### QR Generation
- `GET /fire-door-qr/line-item/:lineItemId/process/:processName/generate` - Workshop QR
- `GET /fire-door-qr/door-item/:doorItemId/dispatch/generate` - Installation QR
- `GET /fire-door-qr/door-item/:doorItemId/maintenance/generate` - Maintenance QR

### QR Scanning (Public)
- `GET /fire-door-qr/scan/:lineItemId/:processName` - Workshop scan
- `GET /fire-door-qr/scan/dispatch/:doorItemId` - Installation scan
- `GET /fire-door-qr/scan/maintenance/:doorItemId` - Maintenance scan

### Maintenance Records
- `POST /fire-door-qr/maintenance/:doorItemId` - Add maintenance record
- `PUT /fire-door-qr/door-item/:doorItemId/fitting-instructions` - Update instructions

## Frontend Pages

### 1. QR Management Page (`/fire-door-qr-management`)
- Configure which fields to show per process
- Set custom instructions
- Manage all workshop processes (Cutting, Lipping, Edging, etc.)

### Next Steps to Complete:

#### 2. QR Print Sheet Page (TODO)
Create `/fire-door-schedule/[projectId]/qr-print` page:
- Grid layout showing all doors in project
- QR code for each process per line item
- Print-friendly layout with door reference labels
- One QR per process per door

#### 3. Dispatch QR Labels Page (TODO)
Create `/fire-door-schedule/[projectId]/dispatch-qr` page:
- Generate dispatch QR for completed doors
- Print labels with QR + door reference + job info
- Batch print for multiple doors

#### 4. Mobile Scan Pages (TODO)
Create public mobile-friendly scan pages:

**Workshop Scan** (`/fire-door-qr/[lineItemId]/[processName]`):
- Large display of configured fields
- Show process instructions
- Mark process as complete button
- Photo upload for issues

**Dispatch Scan** (`/fire-door-qr/dispatch/[doorItemId]`):
- Show fitting instructions
- Door specifications
- Installation checklist
- Add installer notes
- Mark as installed button

**Maintenance Scan** (`/fire-door-qr/maintenance/[doorItemId]`):
- Door information and location
- Last maintenance date
- Add new maintenance record form:
  - Type (Annual/Repair/Inspection)
  - Status (Pass/Fail/Needs Attention)
  - Findings
  - Actions taken
  - Photo uploads
  - Next due date

## Workflow Examples

### Workshop Process Flow:
1. Print QR sheet for project from schedule page
2. Affix QR stickers to work-in-progress doors
3. Worker scans QR with phone when starting process
4. View door specs and process instructions
5. Mark complete when done
6. System tracks which processes are completed

### Dispatch Flow:
1. Generate dispatch QR labels for completed doors
2. Affix QR label to door before shipping
3. Installer scans QR on-site
4. Views fitting instructions and specs
5. Adds installation notes
6. Marks as installed (records date)

### Maintenance Flow:
1. QR label remains on installed door
2. Maintenance contractor scans door QR annually
3. Views door info and last maintenance
4. Performs inspection
5. Records findings with photos
6. Sets next maintenance due date
7. Building manager receives notification

## Files Modified/Created

### Database:
- ✅ `/api/prisma/schema.prisma` - New models added
- ✅ `/api/prisma/migrations/add_fire_door_qr_system.sql` - Migration SQL

### API:
- ✅ `/api/src/routes/fire-door-qr.ts` - Complete API implementation
- ✅ `/api/src/server.ts` - Route registered
- ✅ `package.json` - Added `qrcode` dependency

### Frontend:
- ✅ `/web/src/app/fire-door-qr-management/page.tsx` - Config management UI
- ⏳ TODO: QR print sheet page
- ⏳ TODO: Dispatch labels page
- ⏳ TODO: Mobile scan pages (3 pages)

## Testing Checklist

1. [ ] Run database migration
2. [ ] Configure a process (e.g., "Cutting") with display fields
3. [ ] Generate workshop QR for a line item
4. [ ] Scan QR and verify fields display correctly
5. [ ] Generate dispatch QR for a door
6. [ ] Scan dispatch QR and add installer notes
7. [ ] Generate maintenance QR
8. [ ] Scan maintenance QR and add maintenance record
9. [ ] Print QR sheet and verify layout
10. [ ] Test on mobile device

## Next Implementation Priority

1. **QR Print Sheet** - Most critical for workshop use
2. **Mobile Workshop Scan Page** - For workers to use
3. **Dispatch Scan Page** - For installers
4. **Maintenance Scan Page** - For contractors
5. **Dispatch Label Print Page** - For shipping department

## Notes

- All QR codes use base URL from `WEB_PUBLIC_URL` or fallback to `https://www.joineryai.app`
- QR codes use error correction level M (medium) for workshop, H (high) for dispatch/maintenance
- Scan tracking happens automatically on every scan
- Public scan endpoints don't require authentication for ease of use
- Management endpoints are protected with `requireAuth`

## Environment Variables Required

```env
WEB_PUBLIC_URL=https://your-domain.com  # Base URL for QR codes
PUBLIC_BASE_URL=https://your-domain.com # Fallback
```
