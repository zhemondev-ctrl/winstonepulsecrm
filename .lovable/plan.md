# Six reforms: read-only audit (refresh, 14 Nov 2026 10:15 UTC)

This audit made no edits, database writes or publishes. Database evidence comes from read-only catalogue queries only. Status key: **Implemented** = the code or database shows it; **Missing** = not built; **Unverified** = not confirmed this turn.

## A. Current-state evidence

| # | Rule | Status | Evidence |
|---|---|---|---|
| 1 | 50 company leads a day | Implemented | `src/lib/lead-quota.ts` (`DEFAULT_DAILY_QUOTA=50`, `FIXED_DAILY_QUOTA={}`); trigger `zz_leads_daily_cap` on `leads` |
| 1 | LeadHub is the only way leads are handed out | Implemented | `src/lib/coordinator-deck.functions.ts` (LeadHub PIN); `claimLead` retired in `agent-desk.functions.ts`; triggers `leads_first_assignment_eligibility`, `leads_assignment_review_guard` |
| 1 | Round-robin and Friday exclusion | Implemented | `src/lib/distribution-preview.ts`, `lead-pool.server.ts`, `business-day.ts` |
| 1 | 9:10 Dhaka schedule | Unverified | The cron tables can't be read with SQL. Needs `list_http_schedules`. Caller: `src/routes/api/public/hooks/lead-distribution.ts` |
| 1 | Self leads capped at 10 a day | Partly | `drizzle/migrations/0160_self_lead_daily_cap_10.sql` (trigger `zz_leads_daily_cap`, only for `assignment_source='self' AND source='agent_app'`) |
| 1 | Separate conversion reporting for self leads | Missing | Self leads are only flagged in `agent-sales-scorecard.ts` / `daily-score.ts`, and the two use different checks |
| 1 | New lead entry, drafts and history | Unverified, switched off | `docs/agent-lead-collection.sql` is not applied, so the manual lead form fails closed |
| 2 | 1st miss: back on today's list after a 2h gap | Implemented | `src/lib/no-answer-cadence.ts` (`SAME_DAY_RETRY_MINUTES=120`); MD chose to keep the gap |
| 2 | 2nd miss: follow-up within 48 clock hours | Implemented on preview only (this session) | `no-answer-cadence.ts` (`SECOND_RETRY_MAX_HOURS=48`), `NoAnswerRetryPicker.tsx`, `tests/no-answer-cadence.test.ts` (13 pass); not published |
| 2 | 3rd miss: Unresponsive Pool, back after 7 days | Implemented | `REACTIVATION_DAYS=7` |
| 2 | Duplicate call events blocked | Implemented | call_uid matching in `call-log-reconcile.server.ts`; `lead-events-once.server.ts` |
| 2 | Android picker labels match 48h | Unverified | Older apps still send `plus3`, which the server caps |
| 3 | 10% previous-day rule with HQ review | Implemented | `src/lib/accountability.ts` / `accountability.server.ts`; table `agent_accountability_reviews` (RLS on, no-delete trigger) |
| 3 | Backlog reduces the quota (Net-50) | Implemented | `src/lib/backlog-cap.ts` `cappedQuota`, `app_config` `distribution_backlog_cap`; no row saved, so the default of 50 applies |
| 3 | Backlog over the limit stops new leads | Missing | No hold flag exists. MD chose to have both the reduction and the hold |
| 4 | Recovery window | Fixed dates in code | `backlog-cap.ts` hard-codes 12–14 Nov, and that window has passed. No `auto_distribution_pause` row is saved |
| 5 | Demerits | Partly | `src/lib/demerits.ts` counts every block review, with no effective date. HQ cancellations go to `agent_demerit_cancellations` (RLS on). `DemeritLog.tsx` shows yearly totals |
| 6 | Only the agent who entered a visit can edit it | Implemented | `site_visits` has RLS on with **no** policies (server-only). Triggers `site_visits_entered_by_guard`, `site_visits_protect`, `site_visits_no_delete`, `audit_site_visits`; server check in `site-visit-lock.ts` / `site-visits.functions.ts` |
| 7 | Score | Implemented, different formula | `daily-score.ts`: `points × min(1, count/target)`; saved formula is C20/R20/A10/V35/F15 out of 100 |
| 7 | Phone-log verified calls | 0 today | `call-log-confirmed.ts`: no synced calls carry call-log proof |

## B. Conflict matrix

| Area | Existing | Approved | Safe resolution |
|---|---|---|---|
| Self-lead detection | Two different checks | One separate cap and report | One shared personal-origin helper |
| 1st miss | 2h gap | End of today's list | Resolved: MD kept the 2h gap |
| 2nd miss | 2 working days | 48h | Resolved on preview |
| Backlog | Quota reduction | Hold over a threshold | Keep both; MD sets the threshold |
| Recovery | Fixed past dates | Future window set by HQ | Replace with an HQ-set window; past windows do nothing |
| Demerits | Every block counts | New blocks after the effective date | Add an effective-date filter; review history untouched |
| Score letters | C = call attempts, R = connected, A = appointments, V = visits, F = follow-ups | C = completed tasks, R = call reports, A = call attempts, V = verified connected calls, F = completed follow-ups | Run the new formula as a shadow score alongside the current one before any switch |

## C. Minimal sequence (one release each)
1. **Reform 2:** publish the 48h change once HQ approves; check the Android picker wording.
2. **Reform 1:** add a personal-origin helper (new `src/lib/lead-origin.ts`) and use it in `daily-score.ts`, `agent-sales-scorecard.ts` and the cap trigger (additive migration). Add a self-lead conversion column. Apply the lead-collection SQL after a backup, only if approved.
3. **Reform 3:** add an `app_config` `distribution_backlog_hold {enabled, threshold}` row and an HQ form. `lead-pool.server.ts` and `distribution-preview.ts` skip held agents unless HQ approves. Tests go in `tests/backlog-cap.test.ts`.
4. **Reform 5:** add an effective-date setting to `demerits.ts` / `demerits.functions.ts`, counting each review id once. Tests: no point before the date, one point per review.
5. **Reform 4:** add an HQ-set window (PIN plus audit row) replacing the fixed dates. The one-time unlocks are recorded HQ actions. Tests: a past window does nothing.
6. **Reform 7:** add a shadow formula and a comparison panel; no switch without HQ sign-off.
- Reform 6 needs no change, only a policy test.

## D. Schema and data risks
- Preview and live share one database: back up first, and only add things.
- Demerit totals will drop once the effective date applies.
- Older site visits without a saved profile match by name, and duplicated names are ambiguous.
- R is 0, so the new formula would penalise everyone until phones send call-log proof.
- Unapplied lead-collection SQL: the manual lead form stays switched off.

## E. Open MD/HQ decisions
1. Backlog hold threshold value, and the metric: overdue follow-ups only, or untouched company leads too.
2. Demerit effective date (which Saturday), and which block types count.
3. New recovery window: start, end, restart date, and the five agents' names.
4. Score: is it uncapped, what counts as a "completed task", and when should it switch?
5. Approve applying the lead-collection SQL (after a backup)?
6. Publish the 48h change?

## F. Go/no-go
- **Go** per reform when: its decision is answered, a backup is verified, its tests pass, the preview dry run matches, and HQ approves.
- **No-go** if: a past date would be applied, anything assigns outside LeadHub, any history row would change, or the score switches without the comparison.
