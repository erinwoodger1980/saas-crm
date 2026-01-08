- 2026-01-08: Live purge for tenant "Erin Woodger" executed.
	- Clients deleted: 81
	- Leads deleted: 1749
	- Email messages deleted: 870; threads: 637; ingests: 870
	- Notes: Quotes lead references nulled where present (6). Opportunities linked to leads deleted (3).
# API CI Status

This file tracks CI build verification.

## Latest Verification

**Date:** November 27, 2025
**Status:** Verifying build with follow-up features disabled
**Files Disabled:**
- `src/routes/follow-up-rules.ts.disabled`
- `src/services/conversationalFollowUp.ts.disabled`
- `src/services/followUpTriggerEngine.ts.disabled`

**Expected:** TypeScript compilation should succeed with these files in .disabled state.
