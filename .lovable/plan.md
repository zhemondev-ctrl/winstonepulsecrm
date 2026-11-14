# Dual-Lead Policy — Revised Implementation Plan (owner decision #1 adopted)

Planning only. Nothing was edited, migrated, written or published. Evidence comes from code reads and SELECT-only live queries on 14 Nov 2026. No customer data is shown.

## Adopted direction (owner, 14 Nov)
- A self-collected lead keeps a permanent record of who collected it.
- LeadHub may verify and route the lead, and by default routes it back to the collector.
- It never counts toward the 50 company leads, even when routed later.
- Who collected it and its original self-source stay visible to HQ and in audit history.
- The cap of 10 accepted self-collected leads per day stays.

## Current-state evidence used
- **Collector attribution today.**
  - New intake (`submit_collected_leads_atomic`) records the collector only in `agent_lead_receipts.agent_id` and in the `audit_logs` row "lead_created". The lead itself is inserted unassigned with `assignment_source` NULL.
  - When LeadHub later sets an owner, `enforce_daily_lead_cap` writes the lead into the 50 ledger. This is the gap.
- **Backlog has one more hole.** `pendingBacklogByAgent` (`src/lib/lead-pool.server.ts:170`) excludes only `assignment_source` 'self' and 'duplicate_skipped'. A routed collected lead (source NULL) would therefore count as company backlog.
- **Historical self leads [live].**
  - 161 leads have `assignment_source='self'`. All 161 have an owner, and none has a conflicting owner.
  - 158 are `source='agent_app'` and have a "lead_created" audit row naming the creating staff member.
  - 3 have only lead-assignment history.
  - 0 leads have come through the new receipt-based intake.

## 1. Backlog definition — UNRESOLVED, no live change
The code has two different measures today:
- **(a) Net-50 backlog (count, no denominator).** For each agent: company leads still `status='pending'` and assigned to them, excluding self/duplicate leads and today's receipts. Quota = min(50, limit − backlog), with a default limit of 50 (no saved setting exists).
- **(b) 10% accountability review (`src/lib/accountability.ts`).**
  - The share is pending ÷ eligible, where eligible = previous day's eligible assigned leads + follow-ups due (validated overdue or handled) + incomplete reports not already counted as a pending lead.
  - pending = eligible − completed. If the share is above 10%, an HQ review lock stops company distribution until HQ approves.

**Proposed formula for owner approval** (reuses (b) and adds nothing new):
- Company hold when, for the previous business day, pending ÷ eligible > 10%, with company work only (self-collected excluded from both numerator and denominator). Or when the Net-50 backlog count reaches the configured limit.
- Both conditions stop company leads only. Self intake stays open.

Until this is approved, Net-50 keeps reducing quota as it does today, and the review lock behaves as now.

## 2. Scoring — versioned cutover, no switch now
- **Current production score stays as is:** the saved 100-point formula in `app_config.daily_score_formula`. History stays as is, because scores are computed when read and never stored back.
- **Add a version record:** `score_formula_versions` (append-only) with id, formula, weights, event definitions, `effective_from` (Dhaka date) and approver. Days before `effective_from` keep the old formula. Days on or after it use V2.
- **V2 event definitions (each persisted row counted once, per agent, per Dhaka day):**
  - C = distinct leads whose call report reached a final outcome that day.
  - R = submitted `call_reports`.
  - A = `call_recordings` call attempts.
  - V = calls with `talk_time_source='call_log'` and duration > 0.
  - F = `follow_up_events` completed that day.
  - Recordings, lead entry and drafts never score. Company and self-collected work both count once.
- The effective date is chosen by the owner. The earliest it can be is the first business day after release verification.

## 3. Historical self leads — reporting only
- Report the 158 leads that have a creator audit row as "attributable".
- Show the 3 others as "attribution unverified".
- Never rewrite ownership, source or history.

## 4. Combined 60 cap — analysis
- 50 + 10 currently does **not** guarantee 60. A routed collected lead takes one of the 50 slots, so the true limits are 50 company + 10 self entries with the self leads possibly eating company slots.
- After the fix, routed self leads skip the ledger. That gives at most 50 company leads plus at most 10 self leads accepted that day.
- Caveat: a self lead accepted earlier but routed on a later day is not a "new" lead for that later day. So the true bound is "≤50 company assignments + ≤10 new self acceptances per Dhaka day".
- Add a read-only daily check (HQ panel and a test) that flags any agent-day above 50 company or above 10 self. No separate 60 trigger is needed.

## Minimal additive changes (after approval)
1. **Migration A (additive only).**
   - New table `self_lead_attribution` (lead_id unique, collector_id, receipt_id, source 'receipt' | 'legacy_audit', created_at), append-only. Grants go to service_role only; row security is on with no policies.
   - Backfill: rows for receipts, plus the 158 legacy self leads found through audit rows. This is the only DML, and it is part of the additive change.
   - Replace `enforce_daily_lead_cap` with a version that does all of 0160, plus returns early (no ledger row) when the lead has an attribution row.
   - `submit_collected_leads_atomic` also inserts the attribution row inside the same transaction.
2. **LeadHub routing (server).** For leads that have an attribution row, the default target is the collector. If HQ routes to someone else, the reason must be recorded in an audit row. Attribution never changes.
3. **Backlog exclusion.** `pendingBacklogByAgent` and the accountability inputs exclude attributed leads.
4. **HQ report (read-only).** Self-collected counts by collector and outcome, attributable versus unverified, plus the over-cap check from section 4.
5. **Score versions (Migration B).** Add the versions table only. The V2 cutover happens only once the owner sets a date.

## Rollback
- Each migration is additive.
- Rollback = re-apply the previous `enforce_daily_lead_cap` body (0160) and stop reading the new table. The new table is kept, never dropped.
- The LeadHub and report code changes are reversible by redeploying the previous build.

## Backup evidence required before Migration A
- A `crm_backup_runs` row with status completed, dated within 24h. Its hash and row counts must be recorded.
- Pre-migration counts for leads, lead_daily_assignment_ledger, agent_lead_receipts, audit_logs and lead_events. These must be unchanged or higher afterwards.

## Staging strategy
- Preview and live share one database, so no real submissions are made.
- Logic tests use mocked Vitest runs (tests/setup/block-live-database.ts).
- Database behaviour is tested only through the opt-in staging E2E (tests/staging), which refuses the live project.

## Acceptance tests
- 50 company assignments accepted, the 51st rejected; same-day reassignment not double-counted.
- 10 self acceptances, the 11th rejected; a batch that would pass 10 is rejected whole.
- A routed self lead goes to the collector by default and creates no ledger row. 50 company + 10 self works on the same day.
- Rerouting to another agent requires an audit reason, and attribution stays unchanged.
- Backlog/review hold: company run gives 0, while self intake is still accepted. Attributed leads are not counted as backlog.
- Duplicates: within a batch, an existing lead, and two agents in parallel. No ID leak and no slot used.
- Concurrency: parallel submissions at 9 used → exactly one accepted. Parallel LeadHub runs → still ≤50.
- Ownership: agents cannot read other agents' attribution, and HQ is read-only.
- Scoring: V1 unchanged for past days, V2 only from its effective date, lead entry = 0, recordings = 0.
- History: counts in the backup evidence list never decrease.

## Production verification (after explicit publish request)
- `scripts/check-live-release.ts` markers pass.
- Read-only queries confirm the new trigger body and that the attribution backfill count is 158 plus receipts.
- The first real self lead from an agent, routed by LeadHub, shows the collector as owner and no ledger row.
- The over-cap check shows zero violations.

## Decisions still requiring owner approval
1. The backlog hold formula in section 1 (exclude self work; keep or change the Net-50 limit of 50).
2. Score V2 effective date, and confirmation of the C/R/A/V/F event definitions.
3. Whether the 3 self leads without a creator audit row stay "unverified" in reports, or are excluded.
4. Whether HQ may route a self lead to a different agent, and if so who may (HQ only, or LeadHub operators too).
5. Approval to run Migration A on the shared database after the backup evidence is shown.
