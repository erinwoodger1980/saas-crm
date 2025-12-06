# Clients Management System

## Overview
Complete client management system that centralizes client information and links them to leads, opportunities, and quotes. This creates a hub for viewing all client activity in one place.

## Features

### Client Management
- **List View**: Grid of client cards with search functionality
- **Detail View**: Comprehensive client information with edit capabilities
- **Create Client**: Form to add new clients with validation
- **Related Records**: View all leads, opportunities, and quotes associated with each client

### Navigation
- Added "Clients" button to AppShell navigation (between Dashboard and Leads)
- Uses Users icon from lucide-react
- Links to `/clients` route

## Database Schema

### Client Model
Located in `api/prisma/schema.prisma`:

```prisma
model Client {
  id            String        @id @default(cuid())
  tenantId      String
  name          String
  email         String?
  phone         String?
  address       String?
  city          String?
  postcode      String?
  country       String?       @default("UK")
  contactPerson String?
  companyName   String?
  isActive      Boolean       @default(true)
  notes         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  leads         Lead[]
  opportunities Opportunity[]
}
```

### Relationships
- **One-to-Many**: Client → Leads (via `clientId` foreign key on Lead)
- **One-to-Many**: Client → Opportunities (via `clientId` foreign key on Opportunity)
- Quotes are related indirectly through Opportunities

## Frontend Implementation

### Pages

#### 1. Clients List (`/web/src/app/clients/page.tsx`)
**Purpose**: Browse and search all clients

**Features**:
- Search by name, email, phone, company, city, postcode
- Grid layout with client cards
- Each card shows:
  - Avatar with client initial
  - Name and company
  - Email, phone, location icons
  - Counts of related leads, opportunities, quotes
- Loading skeleton states
- Empty state with "Create Client" CTA
- Links to detail page (`/clients/[id]`)
- "New Client" button in header

**Key Components**:
- `DeskSurface` - Page wrapper
- `Input` - Search field with icon
- `Button` - New client button
- Icons: `Search`, `Plus`, `Mail`, `Phone`, `MapPin`, `User`

#### 2. Client Detail (`/web/src/app/clients/[id]/page.tsx`)
**Purpose**: View and edit individual client information

**Features**:
- Contact information section (name, company, email, phone)
- Address section (street, city, postcode)
- Notes field (multi-line)
- Inline editing with Edit/Save/Cancel buttons
- Related records sections:
  - Leads list with status and value
  - Opportunities list with status and value
  - Quotes list with status and total
- Each related record links to its detail page
- Back button to clients list

**Key Components**:
- `SectionCard` - Section wrappers
- `Input` / `Textarea` - Form fields
- `Button` - Action buttons
- Icons: `ArrowLeft`, `Save`, `Mail`, `Phone`, `MapPin`, `Edit`, `Check`, `X`
- `useToast` - Success/error notifications

#### 3. New Client (`/web/src/app/clients/new/page.tsx`)
**Purpose**: Create a new client

**Features**:
- Form with validation (name required)
- Contact information fields
- Address fields
- Notes field
- Cancel button returns to clients list
- Create button submits form
- Success notification and redirect to detail page
- Error handling with toast notifications

**Key Components**:
- Form with `onSubmit` handler
- `SectionCard` - Form sections
- `Input` / `Textarea` - Form fields
- `Button` - Submit/Cancel buttons
- Icons: `ArrowLeft`, `Save`
- `useToast` - Success/error notifications

### Navigation Integration

**File**: `/web/src/components/AppShell.tsx`

Added new navigation item:
```typescript
{ href: "/clients", label: "Clients", icon: Users }
```

Positioned between Dashboard and Leads in the navigation array.

## Backend Implementation

### API Routes (`/api/src/routes/clients.ts`)

#### GET `/clients`
**Purpose**: List all clients for tenant

**Response**:
```typescript
{
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  notes?: string | null;
  createdAt: string;
  _count: {
    leads: number;
    opportunities: number;
    quotes: number;
  };
}[]
```

**Features**:
- Filters by `tenantId` and `isActive: true`
- Includes counts of related leads, opportunities, quotes
- Orders by `createdAt` descending

#### GET `/clients/:id`
**Purpose**: Get single client details

**Response**:
```typescript
{
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  notes?: string | null;
  contactPerson?: string | null;
  country?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

#### GET `/clients/:id/leads`
**Purpose**: Get all leads for a client

**Response**:
```typescript
{
  id: string;
  number?: string | null;
  contactName?: string | null;
  status: string;
  estimatedValue?: number | null;
  createdAt: string;
}[]
```

#### GET `/clients/:id/opportunities`
**Purpose**: Get all opportunities for a client

**Response**:
```typescript
{
  id: string;
  leadId: string;
  status: string;
  value?: number | null;
  createdAt: string;
  lead: {
    contactName?: string | null;
  };
}[]
```

#### GET `/clients/:id/quotes`
**Purpose**: Get all quotes for a client

**Response**: Same as opportunities (quotes are opportunities with pricing)

#### POST `/clients`
**Purpose**: Create new client

**Request Body**:
```typescript
{
  name: string; // Required
  email?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  city?: string;
  postcode?: string;
  notes?: string;
}
```

**Validation**:
- Name is required and trimmed
- Checks for duplicate (same name + email)
- Returns 409 Conflict if duplicate exists

**Response**: Created client object with 201 status

#### PATCH `/clients/:id`
**Purpose**: Update existing client

**Request Body**: Same as POST (all fields optional)

**Features**:
- Verifies client exists and belongs to tenant
- Only updates provided fields
- Trims string values
- Returns updated client object

#### DELETE `/clients/:id`
**Purpose**: Soft delete client

**Implementation**:
- Sets `isActive: false` instead of hard delete
- Preserves data and relationships
- Returns 204 No Content on success

### Router Registration

**File**: `/api/src/server.ts`

1. Import router:
```typescript
import clientsRouter from "./routes/clients";
```

2. Mount router:
```typescript
app.use("/clients", clientsRouter);
```

Positioned after leads router in the middleware stack.

### Authentication

All routes use the `getAuth()` helper to extract:
- `tenantId` - From JWT or `x-tenant-id` header
- `userId` - From JWT or `x-user-id` header
- `email` - From JWT or `x-user-email` header

All routes return 401 Unauthorized if `tenantId` is missing.

## Data Flow

### Client List Page
1. Component mounts → extracts auth from JWT
2. Sets auth headers (`x-user-id`, `x-tenant-id`)
3. Calls `GET /clients` with auth headers
4. API queries `Client` table filtered by `tenantId`
5. API counts related leads, opportunities, quotes
6. Returns array of clients with counts
7. Frontend displays in grid with search filter

### Client Detail Page
1. Extracts `id` from URL params
2. Calls `GET /clients/:id` for client data
3. Calls `GET /clients/:id/leads` for leads
4. Calls `GET /clients/:id/opportunities` for opportunities  
5. Calls `GET /clients/:id/quotes` for quotes
6. Displays all data in sections
7. Edit mode updates local state
8. Save calls `PATCH /clients/:id`
9. Reloads data and exits edit mode

### New Client Page
1. User fills form
2. Validates name is present
3. Calls `POST /clients` with form data
4. API validates and checks for duplicates
5. Creates client in database
6. Returns new client with ID
7. Frontend redirects to `/clients/:id`

## Linking Clients to Records

### Lead → Client Link
The `Lead` model has a `clientId` field:
```prisma
model Lead {
  clientId String?
  client   Client? @relation(fields: [clientId], references: [id])
}
```

To link a lead to a client:
1. Update lead with `clientId`
2. Lead will appear in client's leads list
3. Client count will include this lead

### Opportunity → Client Link
The `Opportunity` model has a `clientId` field:
```prisma
model Opportunity {
  clientId String?
  client   Client? @relation(fields: [clientId], references: [id])
}
```

Same linking process as leads.

## Future Enhancements

### Immediate Next Steps
1. Add client selector to Lead/Opportunity forms
2. Create "Link to Client" action in LeadModal
3. Add "Create Client from Lead" quick action
4. Show client info in LeadModal header

### Additional Features
- Merge duplicate clients
- Client activity timeline
- Client notes/comments
- Client documents/files
- Client custom fields
- Export client list
- Bulk import clients
- Client tags/categories
- Client revenue reporting

## Testing

### Manual Testing Checklist
- [ ] Navigate to Clients from AppShell
- [ ] Create new client with all fields
- [ ] Create client with only required name
- [ ] Try to create duplicate client (should show error)
- [ ] Search clients by various fields
- [ ] Click client card to view details
- [ ] Edit client information
- [ ] Cancel editing (should revert changes)
- [ ] Save edited client (should show success)
- [ ] View related leads/opportunities/quotes (empty initially)
- [ ] Link a lead to client (when implemented)
- [ ] Verify counts update
- [ ] Delete client (soft delete)
- [ ] Verify deleted client doesn't appear in list

### API Testing
```bash
# Get auth token first (from browser or login)
TOKEN="your-jwt-token"

# List clients
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/clients

# Create client
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Client","email":"test@example.com"}' \
  http://localhost:3001/clients

# Get client
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/clients/CLIENT_ID

# Update client
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"01234567890"}' \
  http://localhost:3001/clients/CLIENT_ID

# Get client leads
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/clients/CLIENT_ID/leads
```

## Files Changed/Created

### New Files
- `/web/src/app/clients/page.tsx` - Clients list page
- `/web/src/app/clients/[id]/page.tsx` - Client detail page
- `/web/src/app/clients/new/page.tsx` - New client page
- `/api/src/routes/clients.ts` - API routes for clients
- `CLIENT_MANAGEMENT_IMPLEMENTATION.md` - This documentation

### Modified Files
- `/web/src/components/AppShell.tsx` - Added Clients navigation item
- `/api/src/server.ts` - Imported and mounted clients router

## Build Status
✅ All files compile successfully
✅ No TypeScript errors
✅ Ready for testing and deployment
