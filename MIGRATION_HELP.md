# Migration Help (Staging + Live)

This runbook is for applying Prisma migrations to **staging first**, then **live**.

It exists because the API/web can ship code that expects new DB columns (e.g. `QuoteLine.sortIndex`) and you’ll get 500s until the migration is applied.

## Golden rules

- **Never run** `prisma migrate dev` against staging/live.
- Prefer **`prisma migrate deploy`** (via the repo helper script) for staging/live.
- Apply migrations to **staging first**, sanity check, then apply to **live**.
- Do **not** hardcode DB URLs in scripts. Use env files.

## Where the DB URLs are

This repo expects `DATABASE_URL` to be set in your shell before running migrations.

We keep env files under `api/` (do not commit them if they contain secrets):

- `api/.staging.env` → (optional) staging-specific envs
- `api/.env` → live envs (and often also contains `STAGING_DATABASE_URL`)

(These files should not be committed if they contain secrets.)

## Quick fix for the current incident (missing `QuoteLine.sortIndex`)

If quote endpoints are 500’ing after deploy, apply migrations:

1) Apply to staging:

```bash
cd api
set -a; source .staging.env; set +a
pnpm prisma:deploy
```

If your `api/.staging.env` doesn’t contain a usable `DATABASE_URL`, but `api/.env` has `STAGING_DATABASE_URL`, you can do:

```bash
cd api
set -a; source .env; set +a
export DATABASE_URL="$STAGING_DATABASE_URL"

# Render Postgres often requires the full domain + sslmode.
# If your STAGING_DATABASE_URL host is just "dpg-..." with no domain, use this normalization:
export DATABASE_URL="$(node -e "const {URL}=require('url'); const raw=process.env.STAGING_DATABASE_URL||''; if(raw.length===0) process.exit(2); const u=new URL(raw); if(u.hostname.indexOf('.')===-1) u.hostname = u.hostname + '.oregon-postgres.render.com'; if(u.searchParams.get('sslmode')===null) u.searchParams.set('sslmode','require'); process.stdout.write(u.toString());")"

pnpm prisma:deploy
```

2) Then apply to live:

```bash
cd api
set -a; source .env; set +a
pnpm prisma:deploy
```

## Standard workflow (staging → live)

### 1) Confirm you have the migration in your branch

From repo root:

```bash
ls -1 api/prisma/migrations | tail
```

### 2) Apply migrations to staging

```bash
cd api
set -a; source .staging.env; set +a
pnpm prisma:deploy
pnpm prisma migrate status
```

### 3) Verify the expected schema change exists

Example checks:

- Check the migration status output includes “Database schema is up to date”.
- Spot-check the specific change with `psql`:

```bash
cd api
set -a; source .staging.env; set +a
psql "$DATABASE_URL" -c "select column_name from information_schema.columns where table_name='QuoteLine' and column_name='sortIndex';"
```

### 4) Deploy/restart the API service

How you restart depends on hosting:

- If you deploy via your platform (Render/etc), trigger a redeploy/restart.
- If you manage a process directly (pm2/systemd), restart that service.

### 5) Apply migrations to live

Only after staging is healthy:

```bash
cd api
set -a; source .env; set +a
pnpm prisma:deploy
pnpm prisma migrate status
```

Then restart/redeploy live.

## Recommended commands

Run from the `api/` folder.

- Deploy migrations (preferred):

```bash
pnpm prisma:deploy
```

This runs a small helper ([api/scripts/prisma-deploy.mjs](api/scripts/prisma-deploy.mjs)) that:
- Ensures `DATABASE_URL` is set
- Marks a couple known-bad historical migrations as rolled back if needed
- Runs `prisma migrate deploy`

If you need an even more defensive path, there is also:

```bash
pnpm prisma:deploy:safe
```

## If `pnpm prisma migrate status` shows drift

Typical meanings:

- **Pending migrations** → run `pnpm prisma:deploy`.
- **Failed migration** → use the repo helper (`pnpm prisma:deploy`) or, if necessary, mark a specific migration as rolled back/applied.

## Emergency: apply a single migration SQL directly

Use this when Prisma history is messy but you need the DDL applied immediately.

```bash
cd api
set -a; source .env; set +a
./scripts/apply-migration-prod.sh 20260122170000_add_quote_line_sort_index
```

That script:
- Applies `prisma/migrations/<name>/migration.sql` with `psql`
- Marks it applied with `prisma migrate resolve --applied`

## Troubleshooting

### “DATABASE_URL must be set …”

You forgot to load the env file.

```bash
cd api
set -a; source .staging.env; set +a
# or: set -a; source .env; set +a
```

### 500s right after a deploy

Most common causes:

- Migration not applied to the target DB
- API service not restarted/redeployed after migration

### Prisma shadow DB errors

Shadow DB errors are primarily a **local dev** issue. Do not use `migrate dev` against staging/live.
See [api/LOCAL_MIGRATION_WORKFLOW.md](api/LOCAL_MIGRATION_WORKFLOW.md) for local workflows.
