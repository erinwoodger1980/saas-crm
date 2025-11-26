# Migration Fix

This migration initially failed due to missing enum types. It has been fixed to include:
- TaskType enum creation
- RecurrencePattern enum creation

If the migration is marked as failed in production, run:
```bash
npx prisma migrate resolve --rolled-back "20251126122031_add_task_template"
npx prisma migrate deploy
```
