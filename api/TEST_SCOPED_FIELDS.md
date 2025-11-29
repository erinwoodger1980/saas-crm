# Scoped Questionnaire Fields Testing Guide

## Overview
Automated test suite for the unified scoped questionnaire fields system.

## Quick Start

### 1. Ensure Local Database Ready
```bash
# Check DATABASE_URL in api/.env.local points to local DB
cat api/.env.local | grep DATABASE_URL

# Should show something like:
# DATABASE_URL="postgresql://Erin:devpass@localhost:5432/joinery_dev_scopes?schema=public"
```

### 2. Seed Test Tenant (if needed)
```bash
cd api
pnpm run seed:tenant -- --slug dev-tenant --name "Dev Tenant"
```

### 3. Run Tests (Fully Automated)
```bash
cd api
pnpm run test:scoped-fields -- --tenant dev-tenant

# The script will:
# - Start the API server automatically
# - Run all 13 tests
# - Stop the API server
# - Report results
```

## Test Coverage

The test script verifies **(14 automated tests)**:

✅ **Database Connection** - Prisma can connect to local DB  
✅ **Tenant Exists** - Test tenant created and accessible  
✅ **Active Questionnaire** - Default questionnaire exists for tenant  
✅ **Standard Fields** - 24 ML-aligned standard fields seeded  
✅ **Required ML Fields** - Core fields present: `quantity`  
✅ **Scope Normalization** - All scopes are canonical (`client`, `public`, `internal`, `manufacturing`)  
✅ **Scope Distribution** - Fields distributed across scopes correctly  
✅ **Field Types** - All fields have valid `QuestionnaireFieldType` enum values  
✅ **Costing Input Keys** - Required costing fields configured  
✅ **Hidden Fields** - Deprecated fields properly hidden  
✅ **Public API Endpoint** - `/public/tenant/:slug/questionnaire-fields` returns scoped fields
✅ **Public Scope in API** - Public fields correctly exposed via API

> **Note:** When adding new features or fields, update the test expectations in `test-scoped-fields.ts` to match your changes (e.g., expected field counts, new required fields, etc.)

## Pre-Push Workflow

**Before pushing changes:**

```bash
# Simply run the automated test suite
cd api
pnpm run test:scoped-fields -- --tenant dev-tenant

# Verify all tests pass (14/14)
# Example output:
# ✅ All 14 tests passed!

# If tests fail, review errors, fix, and re-run
# Once all pass, commit and push
```

## Test Modes

### Fully Automated (Recommended)
```bash
cd api
pnpm run test:scoped-fields

# Script automatically:
# - Starts API server
# - Waits for server ready
# - Runs all tests
# - Stops API server
# - Returns exit code (0=pass, 1=fail)
```

### Manual Server Management
If you already have the API server running:
```bash
# Terminal 1
cd api && pnpm run dev

# Terminal 2
cd api && pnpm run test:scoped-fields -- --no-server
```

## Troubleshooting

### "Tenant 'dev-tenant' not found"
```bash
cd api
pnpm run seed:tenant -- --slug dev-tenant
```

### "No standard fields found"
Seed script should have run automatically on tenant creation. If not:
```bash
cd api
# Check if questionnaire exists
npx tsx -e "import prisma from './src/db'; prisma.questionnaire.findMany({where:{tenantId:'TENANT_ID'}}).then(console.log).finally(()=>prisma.\$disconnect())"

# Manually seed if needed
pnpm run seed:standard-fields -- --tenant dev-tenant
```

### "Invalid scopes found"
Run scope migration:
```bash
cd api
npx tsx src/scripts/migrateQuestionnaireScopes.ts --mode apply --tenant dev-tenant
```

### Database connection errors
Check `DATABASE_URL` in `api/.env.local`:
```bash
# Test connection
cd api
npx tsx -e "import prisma from './src/db'; prisma.\$queryRaw\`SELECT 1\`.then(()=>console.log('✅ Connected')).finally(()=>prisma.\$disconnect())"
```

## Custom Tenant Testing

Test against different tenant:
```bash
# Seed custom tenant
pnpm run seed:tenant -- --slug my-tenant --name "My Tenant"

# Run tests
pnpm run test:scoped-fields -- --tenant my-tenant
```

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Seed test tenant
  run: |
    cd api
    pnpm run seed:tenant -- --slug ci-test
    
- name: Run scoped fields tests
  run: |
    cd api
    pnpm run test:scoped-fields -- --tenant ci-test
```

## Expected Output

**Success (all tests passing):**
```
🧪 Testing Scoped Questionnaire Fields System
📍 Tenant: dev-tenant
🔗 API: http://localhost:4000

✅ Database connection
✅ Tenant exists: id=cmik5mmrz0000awitp7qllpe0
✅ Active questionnaire: id=cmik5mmua0001awit968pmdlg
✅ Standard fields: 24 fields found
✅ Required ML fields: All present
✅ Scope normalization: All scopes valid

📊 Scope distribution:
   client: 10
   internal: 2
   public: 8
   manufacturing: 4

✅ Fields by scope: {"client":10,"public":8,"internal":2,"manufacturing":4}
✅ Field types: All 24 fields have valid types
✅ Costing input keys: 14 costing fields
✅ Required costing keys: All present
✅ Hidden fields: 0 hidden fields
✅ Deprecated fields hidden: All deprecated fields properly hidden
✅ Public API endpoint: 24 fields returned
✅ Public scope in API: 8 public fields

==================================================
✅ All 14 tests passed!
🛑 Stopping API server...
```

## Updating Tests for New Development

When making changes to the questionnaire fields system, update the test script to maintain validation:

### Adding New Standard Fields
Update the field count expectation in `test-scoped-fields.ts`:
```typescript
// Line ~106: Update expected count
if (standardFields.length === 0) {
  fail("Standard fields", "No standard fields found");
  return;
}
pass("Standard fields", `${standardFields.length} fields found`); // Update expected count
```

### Adding New Required Fields
Add to the `requiredKeys` array:
```typescript
// Line ~109: Add new required field keys
const requiredKeys = ["quantity", "your_new_field"];
```

### Adding New Costing Fields
Update `requiredCostingKeys`:
```typescript
// Line ~151: Add new costing field keys
const requiredCostingKeys = ["quantity", "your_new_costing_field"];
```

### Adding New Scope Values
Update the `validScopes` array:
```typescript
// Line ~134: Add new scope values
const validScopes = ["client", "public", "internal", "manufacturing", "your_new_scope"];
```

### Adding New Tests
Add new test functions following the existing pattern:
```typescript
async function testYourNewFeature(tenantId: string) {
  try {
    // Your test logic
    pass("Your new feature", "Details");
  } catch (e: any) {
    fail("Your new feature", e?.message || String(e));
  }
}

// Then call in main():
await testYourNewFeature(tenant.id);
```

## Related Scripts

- `pnpm run seed:tenant` - Seed tenant + settings + standard fields
- `pnpm run fields:migrate-scopes` - Normalize legacy scope values
- `pnpm run seed:standard-fields` - Re-sync standard fields (usually not needed)
- `pnpm run dev` - Start API server for full integration test
