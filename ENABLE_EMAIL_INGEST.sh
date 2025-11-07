#!/bin/bash
# Run this in Render PostgreSQL Query tab to enable email ingest for existing Gmail connections

cat << 'EOF'

======================================================================
  EMAIL INGEST MIGRATION - Enable for Existing Gmail Connections
======================================================================

STEP 1: Check Current Status
-----------------------------
Run this query first to see which tenants need migration:

EOF

cat << 'SQL'
SELECT 
  t.id,
  t.name,
  t.slug,
  ts."inboxWatchEnabled",
  ts."inbox"->>'gmail' as gmail_enabled,
  gtc."createdAt" as gmail_connected_at
FROM "Tenant" t
JOIN "GmailTenantConnection" gtc ON gtc."tenantId" = t.id
LEFT JOIN "TenantSettings" ts ON ts."tenantId" = t.id
ORDER BY t.name;
SQL

cat << 'EOF'

STEP 2: Run Migration
---------------------
If any tenants have inboxWatchEnabled = false or NULL, run this:

EOF

cat << 'SQL'
UPDATE "TenantSettings" ts
SET 
  "inboxWatchEnabled" = true,
  "inbox" = COALESCE(ts."inbox", '{}'::jsonb) || '{"gmail": true}'::jsonb,
  "updatedAt" = NOW()
WHERE EXISTS (
  SELECT 1 FROM "GmailTenantConnection" gtc
  WHERE gtc."tenantId" = ts."tenantId"
)
AND ("inboxWatchEnabled" IS NULL OR "inboxWatchEnabled" = false);
SQL

cat << 'EOF'

STEP 3: Verify Migration
------------------------
Run this to confirm all Gmail-connected tenants are enabled:

EOF

cat << 'SQL'
SELECT 
  COUNT(*) as total_gmail_connections,
  COUNT(CASE WHEN ts."inboxWatchEnabled" = true THEN 1 END) as enabled_count,
  COUNT(CASE WHEN ts."inboxWatchEnabled" = false OR ts."inboxWatchEnabled" IS NULL THEN 1 END) as disabled_count
FROM "GmailTenantConnection" gtc
LEFT JOIN "TenantSettings" ts ON ts."tenantId" = gtc."tenantId";
SQL

cat << 'EOF'

Expected result after migration:
- enabled_count should equal total_gmail_connections
- disabled_count should be 0

STEP 4: Test Email Import
--------------------------
After migration, emails will be imported within 10 minutes by the background watcher.

To test immediately, run this diagnostic script:
```bash
cd /Users/Erin/saas-crm/api
npx tsx scripts/diagnose-email-ingest.ts
```

Look for:
✅ inboxWatchEnabled: true
✅ Last run: (recent timestamp)
✅ Recent email ingests showing in the list

STEP 5: Force Import (Optional)
--------------------------------
To manually trigger import for a specific tenant:
```bash
npx tsx scripts/manual-gmail-import.ts <tenant-id>
```

======================================================================
  TROUBLESHOOTING
======================================================================

Issue: Migration shows 0 rows updated
Solution: Check if GmailTenantConnection records exist
```sql
SELECT COUNT(*) FROM "GmailTenantConnection";
```

Issue: Emails still not importing after 10 minutes
Solution: 
1. Check Render logs for background watcher errors
2. Verify Gmail refresh token is valid
3. Run manual import script to test

Issue: TenantSettings record doesn't exist
Solution: OAuth callback will create it on next Gmail reconnection

======================================================================

EOF
