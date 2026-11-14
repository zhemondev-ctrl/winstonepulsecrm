# Dual-Lead Policy — Decision Reconciliation and Runbook (planning only)

This turn changed no application code, database, production data or deployment. Only `.lovable/plan.md` was updated. It builds on the approved plan archived at `.lovable/plan/dual-lead-policy-revised-implementation-plan-owner-decision-2026-11-14.md`.

## Inconsistencies found this turn (must be resolved first)
1. **Score already switched in code (and on live).** `readDailyScores` in `src/lib/score-formula.functions.ts` calls `policyScores` (2C+2R+A+4V+1.5F) for **any** chosen day, including past days. The 100-point formula saved in `app_config.daily_score_formula` is no longer read for results.
   - That contradicts the scoped rule in `src/lib/AGENTS.md` (the score must read the saved formula, never hardcoded weights).
   - It also contradicts the earlier plan's statement that "production score stays 100-point".
   - Saved owner note (14 Nov) says V2 "replaces the saved 100-point formula now". So past days opened today show V2 numbers, not what HQ saw before.
   - No scores are stored, so nothing was overwritten. This is a display inconsistency, not data loss.
2. **The backlog metric was partly decided earlier.** A saved owner note says the hold counts overdue follow-ups + untouched company leads, with no threshold given. The code's Net-50 count (`pendingBacklogByAgent`) counts only pending company leads, and that count also picks up routed collected leads (source NULL).
3. **Collected leads use up company slots.** Routed collected leads are counted in the 50 ledger (`enforce_daily_lead_cap`). This is fixed by Migration A.
4. **No `distribution_backlog_cap` setting exists.** The code default (on, limit 50) applies silently.

## Recommended defaults (safe to adopt as policy, no data change)
| Topic | Recommended default |
|---|---|
| Backlog hold | Hold company leads when the previous business day's accountability share (pending ÷ eligible, company work only) is above 10%, **or** when overdue follow-ups + untouched company leads reach the configured limit. Self intake is never blocked. |
| Net-50 limit | Keep 50 as the saved value, stored in settings (not hardcoded), and changeable by MD/HQ. |
| Score V2 dates | V2 applies from **Sunday 15 Nov 2026 (Dhaka)**. Days before that show the 100-point result, rebuilt from the saved version history. |
| C | Distinct leads whose submitted report that day reached a final outcome (closed, lost or disqualified) |
| R | Call reports with status submitted, by submitted_at that day |
| A | Call attempts (call_recordings rows started that day) |
| V | Calls with talk_time_source = call_log and duration > 0 |
| F | Follow-ups with completed_at that day |
| Never score | Recordings, lead entry, drafts and duplicates. Each row counts once; company and self work both count. |
| 3 unattributed historic self leads | Report them as "collector not confirmed". Exclude them from per-agent self totals and never reassign them. |
| Rerouting a self lead | Executive HQ only, with a required reason, audited. LeadHub operators route to the collector only. Attribution never changes. |

## Requires explicit owner approval (not authorised by this request or by "next")
- Running Migration A (attribution table, backfill and cap trigger change) on the shared live database.
- Running Migration B (score versions table).
- Changing live distribution behaviour (backlog hold, saved limit).
- The V2 effective date, and showing past days with the 100-point result.
- Publishing.

## Runbook
**Phase 0 — Decisions.** The owner confirms the checklist below. Gate: written approval.

**Phase 1 — Backup gate.**
- A completed `crm_backup_runs` row less than 24h old, with its hash.
- Record counts for leads, lead_daily_assignment_ledger, agent_lead_receipts, audit_logs, lead_events and follow_up_events.

**Phase 2 — Code (preview, mocked tests).**
1. Score versioning: read the dated version. Before the effective date, use the saved 100-point formula; from it, use V2. This also fixes the AGENTS.md rule breach.
2. Backlog: exclude attributed leads from the backlog count; add the follow-up count; read the limit from settings.
3. LeadHub: route attributed leads to their collector by default; rerouting is HQ only, with a reason.
4. HQ report: self-lead totals by collector, the "not confirmed" bucket and an over-cap check.
- Gate: Vitest passes with no requests to the live database, and the build is OK.

**Phase 3 — Database (only after approval).**
- Migration A: an append-only `self_lead_attribution` table (server-only) plus a backfill (receipts and the 158 audited leads), the cap trigger skipping attributed leads, and intake writing attribution in the same transaction.
- Migration B: the `score_formula_versions` table.
- Gate: the opt-in staging E2E passes first. After applying, read-only checks confirm the trigger body, 158 attribution rows, and Phase 1 counts unchanged or higher.

**Phase 4 — Publish (only on request).** `scripts/check-live-release.ts` markers pass, plus the live checks below.

## Rollback
- Re-apply the 0160 body of `enforce_daily_lead_cap`.
- Have the code ignore the new tables. They are kept, never dropped.
- Redeploy the previous build.
- Point the score version back to the prior active entry. History is append-only.

## Acceptance criteria
- 50 company assignments are accepted and the 51st is rejected. Same-day reassignment is not counted twice.
- 10 self acceptances are accepted and the 11th is rejected. A batch that would cross 10 is rejected whole.
- A routed self lead goes to the collector and writes no ledger row. 50 + 10 works on the same day.
- An HQ reroute requires a reason and an audit row; the collector stays unchanged. A non-HQ reroute is refused.
- A backlog or review hold stops company leads only; self intake still succeeds. Attributed leads are not counted as backlog.
- Duplicates (inside a batch, an existing lead, two agents in parallel): no lead ID leaks and no slot is used.
- Concurrency: parallel submissions at 9 used allow exactly 1 more. Parallel LeadHub runs stay at 50 or fewer.
- Scores: days before the effective date match the 100-point version; days after use V2. Lead entry and recordings score 0.
- History: every Phase 1 count is unchanged or higher.

## Owner decision checklist (recommended answers)
1. Backlog hold = 10% accountability share (company only) OR overdue follow-ups + untouched company leads reaching the limit; Net-50 limit stays 50, stored in settings. **Recommend: yes.**
2. Score V2 effective from 15 Nov 2026 (Dhaka); earlier days shown with the 100-point result; C/R/A/V/F as defined above. **Recommend: yes.**
3. The 3 unattributed historic self leads go under "collector not confirmed", excluded from agent totals. **Recommend: yes.**
4. Self-lead reroute: Executive HQ only, with a required reason. **Recommend: yes.**
5. Approve Migration A and B on the shared database after the Phase 1 backup evidence. **Needs explicit approval.**
