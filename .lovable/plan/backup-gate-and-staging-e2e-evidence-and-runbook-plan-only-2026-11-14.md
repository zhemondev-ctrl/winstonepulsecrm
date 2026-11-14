# Backup gate and staging E2E — evidence and runbook (plan only)

## Critical finding first
Migrations A and B are **already applied** to the shared database in an earlier turn:
`drizzle/migrations/0165_self_lead_attribution.sql`, `0166_self_lead_routing_review_exempt.sql`, `0167_score_formula_versions.sql`.
They ran after the 13 Nov backup only. "Do not run A/B" is therefore moot; the gate now is: take a fresh backup of the current (post-A/B) state, then verify, before any publish. Rollback of A/B must be additive (disable triggers/functions, keep rows), never a restore.

## Backup implementation (evidence)
- `src/lib/crm-backup.server.ts` `runBackup(date = dhakaDate())`
  - Tables: `BACKUP_TABLES = leads, call_reports, follow_up_events, bookings, site_visits, profiles` (legal_name stripped).
  - Writes gzip JSON to storage bucket `crm-backups/<dhaka-date>/crm-backup.json.gz`, SHA-256 checksum, counts into `crm_backup_runs`.
  - Idempotent per Dhaka date: if a `done` row exists for that date it returns `skipped` (no fresh snapshot).
  - Prunes >30 days (marks `expired`, removes files).
- Triggers:
  - `POST /api/public/backups/run` — needs `x-backup-token` matching server-only `crm_backup_secret` (nightly cron).
  - `runCrmBackupNow` in `src/lib/crm-backup.functions.ts` — authority scope (HQ/IT master PIN) only.
- Existing 13 Nov row = `backup_date 2026-11-13` (17:30 UTC = 23:30 Dhaka). Today is 14 Nov Dhaka, so a run now creates a new `2026-11-14` row (unless tonight's cron already wrote it — then it would skip).

## Gap vs the required six baseline tables
Required: leads, lead_daily_assignment_ledger, agent_lead_receipts, audit_logs, lead_events, follow_up_events.
Current backup covers only leads and follow_up_events of these. **No supported path backs up the other four.** Count mismatch with 13 Nov is expected (new work since).

## Safest supported way to get a complete backup
1. Code change (needs approval, preview only): extend `BACKUP_TABLES` with `lead_daily_assignment_ledger, agent_lead_receipts, audit_logs, lead_events` (append-only, read-only selects; existing page-by-id loop). Keep RESTORABLE unchanged (new tables never restorable). Confirm each has an `id` column for ordering; add a unit test for the table list.
2. Same-day issue: add an explicit `force`/suffix option only for the PIN-gated manual run so a second snapshot on the same Dhaka date gets a new path (e.g. `<date>/crm-backup-<hhmm>.json.gz`) instead of skipping or overwriting. Never upsert over an existing done file.
3. Run via IT Console backups panel (HQ/IT master PIN) → `runCrmBackupNow`. I cannot enter the PIN; the owner/IT triggers it.
4. Independent cross-check: Lovable Cloud daily snapshot (More → Database → Manage → Backups) and optionally Export data — read the newest UTC timestamp there.
5. Verify read-only: new `crm_backup_runs` row status=done, checksum present, counts for all ten tables within the live SELECT counts taken at the same minute.

Alternative with no code change: run the existing manual backup (six original tables) + record live SELECT counts for the four missing tables + rely on Cloud daily snapshot for full coverage. Weaker: no checksum for the four.

## Staging E2E (evidence)
- Guard `stagingGuard()` in `tests/staging/call-flow.staging.ts`: requires `STAGING_E2E=1`, `SUPABASE_URL` set, refuses if URL contains live ref, requires `STAGING_CONFIRM` to match the ref in URL.
- Config `vitest.staging.config.ts` (only `tests/staging/**/*.staging.ts`, serial). Normal runs also load `tests/setup/block-live-database.ts`.
- Command (against an isolated backend only):
  `STAGING_E2E=1 STAGING_CONFIRM=<staging-ref> SUPABASE_URL=https://<staging-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<staging key> bunx vitest run --config vitest.staging.config.ts`
- **Blocker:** no separate staging backend exists; preview and live share one database. Options: a Lovable draft with its own isolated database (drafts--create), or a separate owner-owned project. Fixtures persist there (leads never deleted). No dual-lead 50+10 staging spec exists yet — must be written (`tests/staging/dual-lead.staging.ts`).

## Blockers
1. Owner approval for the backup code change (step 1–2).
2. HQ/IT PIN holder must trigger the manual backup.
3. An isolated staging backend for E2E.
4. Acknowledge A/B already applied; publish stays blocked until fresh backup + staging pass.

No files, database rows, settings or deployments were changed in this turn.
