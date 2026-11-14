# Six reforms: read-only audit and repair plan

Nothing was changed, migrated, or published to produce this plan. Every finding below comes from reading the code. Database contents (live rows, RLS policies, schedules) have not been queried yet. Step 0 checks them before any work starts.

## A. Current-state findings

| # | Area | What the code does now | Evidence |
|---|---|---|---|
| 1 | Company hand-out | Default quota is 50 and `FIXED_DAILY_QUOTA` is empty. Round-robin runs in the distribution preview and pool. A scheduled hook triggers the morning run. | `src/lib/lead-quota.ts:14,22`, `src/lib/distribution-preview.ts:4`, `src/lib/lead-pool.server.ts:534`, `src/routes/api/public/hooks/lead-distribution.ts` |
| 1 | Self-sourced cap | A DB trigger caps self leads at 10 a day, but only where `assignment_source='self' AND source='agent_app'`. The new collection path (not yet applied) creates unassigned `agent_app` rows, which the scoring code may not recognise as self leads. | `drizzle/migrations/0160_self_lead_daily_cap_10.sql`, `0154_self_leads_exempt_daily_cap.sql`, `src/lib/daily-score.ts`, `src/lib/agent-sales-scorecard.ts`, `docs/agent-lead-collection.sql` |
| 2 | Missed calls | 1st miss: back on the list after 2 hours (moves to the next morning after 17:00). 2nd miss: the agent picks a date within 2 **working days**. 3rd miss: Unresponsive Pool, back after 7 days. | `src/lib/no-answer-cadence.ts:1-40` |
| 3 | Backlog | "Net 50" **subtracts** older pending company backlog from the quota (`cappedQuota`). It does not hold distribution. The limit is stored in `app_config` as `distribution_backlog_cap` (default 50, range 0–500). | `src/lib/backlog-cap.ts:1-25` |
| 3 | 10% rule | Above the threshold, an HQ review for the next business day is created in `agent_accountability_reviews`. | `src/lib/accountability.ts:7,68`, `accountability.server.ts` |
| 4 | Recovery window | The built-in clearance days are hard-coded to 12–14 Nov 2026. A pause is stored in `app_config` as `auto_distribution_pause`. | `src/lib/backlog-cap.ts:27+` |
| 5 | Demerits | Every block review counts as one point. HQ can cancel a point with a reason, recorded in the append-only `agent_demerit_cancellations`. The code shows no effective-date filter. | `src/lib/demerits.ts:1-20`, `demerits.functions.ts`, `0156_agent_demerit_cancellations.sql`, `components/crm/hq/DemeritLog.tsx` |
| 6 | Site-visit edits | `agentEnteredVisit` checks the owner plus `created_by_profile_id`, falling back to the entry name on older rows. `protect_site_visit_entered_by` and `protect_site_visit_link` exist. Whether RLS blocks direct writes has not been checked. | `src/lib/site-visit-lock.ts`, `site-visits.functions.ts`, `0157_site_visit_entered_by.sql` |
| 7 | Score | Each letter earns `points × min(1, count ÷ target)`, out of 100, saved in `app_config` under `daily_score_formula`. R means call-log-confirmed answered calls, and that count is currently 0 for everyone. | `src/lib/daily-score.ts`, `score-formula.ts`, `call-log-confirmed.ts` |

## B. Conflict matrix

| Reform | Existing rule | Approved rule | Safe resolution |
|---|---|---|---|
| 1 | Self cap counts only `assignment_source='self'` rows | Separate 10/day cap and reporting for self leads | One shared "personal origin" check used by the cap trigger, scores and scorecards. Never decide it from the current owner. |
| 2 | 1st miss: back after 2h | 1st miss: end of today's queue | Order the remaining list by attempt time and keep the 2h minimum gap. Needs MD confirmation (E1). |
| 2 | 2nd miss: within 2 working days | Within 48 hours | Over a Friday these differ. MD must choose (E2). |
| 3 | Backlog subtracts from quota | Backlog over a threshold holds distribution | Add a separate hold flag next to the subtraction. Keep Net-50 unless MD retires it (E3). |
| 4 | Hard-coded 12–14 Nov dates | Forward-looking window set by HQ | Replace the dates with an HQ-set window (start, end, restart) stored in `app_config`. Never apply a past window. |
| 5 | Every block counts | Only new blocks after the effective date | Filter by an `effective_from` setting. The current DemeritLog totals will change; the review history itself is never edited. |
| 7 | Capped 100-point formula | 2C+2R+A+4V+1.5F, no cap | Run the new formula as a shadow score beside the current one, and switch only after HQ reviews the impact. The letters also mean different things (C becomes completed tasks, A becomes call attempts). |

## C. Data integrity and migration risks
- Preview and live share one database, so every migration needs a verified backup and must only add things.
- The lead-collection SQL (`docs/agent-lead-collection.sql`) is unapplied. The manual lead form now fails closed, so it does not work until that SQL is approved and applied.
- Demerit totals will drop when the effective-date filter is added. HQ needs to know this before release.
- Older site visits have no saved profile, so their edit check relies on the saved name. Rows with a duplicated name are ambiguous and need a listing.
- R is 0 until phones send call-history proof, so the new formula would heavily penalise everyone.
- Removing the 2-hour gap risks duplicate call events. Keep the call-UID uniqueness check and the call-log reconcile path.

## D. Ordered plan (separate release per reform)
0. **Read-only checks.** List RLS policies on `site_visits` and `leads`. Check whether 0154/0160 are applied to the live database, the scheduled hook times, the current `app_config` rows (`auto_distribution_pause`, `distribution_backlog_cap`, `daily_score_formula`), the block counts per agent since 1 Nov, and the five blocked agents.
1. **Reform 6.** Add RLS or a trigger guard that blocks agent updates on visits they did not enter, while HQ and IT keep access through the server. Tests: `tests/site-visit-lock.test.ts` plus a PGlite policy test.
2. **Reform 1.** Add a `isPersonalOrigin` helper in a new pure module. Use it in `daily-score.ts`, `agent-sales-scorecard.ts`, the cap trigger in an additive migration, and the lead-collection SQL. Add a self-lead conversion column to the scorecards. Tests: cap at 10, block and backlog still apply to self leads.
3. **Reform 3.** Add a hold setting `distribution_backlog_hold {enabled, threshold}` (no hard-coded value), with an MD-editable form in HQ. Metric: count of the agent's company leads with no work, plus overdue actionable follow-ups, shown separately from total pending. `lead-pool.server.ts` skips any agent whose 10% review is open or whose backlog is over the threshold, unless HQ approves. The dry-run preview shows both reasons. Tests in `tests/backlog-cap.test.ts`.
4. **Reform 2.** Edit `no-answer-cadence.ts` and the matching tests only after E1 and E2 are answered. The server form validation must match.
5. **Reform 5.** Add a demerit effective-date setting and filter in `demerits.ts` and `demerits.functions.ts`. Deduplicate by review id. The annual totals in the DemeritLog read from the same function. Tests: no points before the date, one point per review.
6. **Reform 4.** Add an HQ-set window form (PIN plus audit row) to replace the hard-coded dates in `backlog-cap.ts`. Inbound leads stay unassigned during the window. The one-time HQ unlock for the listed agents is a separate, recorded HQ action. Tests: a past window does nothing, and a restart needs HQ authorisation.
7. **Reform 7.** Add a shadow formula (`score-formula.ts`, `daily-score.ts`) shown in a side-by-side comparison panel. No switch-over until HQ signs off.
- Each step updates `src/lib/AGENTS.md` (briefly) and `roadmap.md`, and runs its own test files.

## E. Decisions for MD/HQ
1. First miss: drop the 2-hour gap, or keep it and also move the lead to the end of the queue?
2. Second miss: 48 clock hours, or 2 working days?
3. Should the backlog hold replace Net-50 or sit beside it? Which threshold value, and does it count overdue follow-ups only, or untouched leads too?
4. The exact demerit effective date (which Saturday), and which kinds of block count.
5. The new recovery window dates, the restart date, and confirming the five agents' names.
6. Is the new score uncapped? What do "completed tasks" mean exactly? When should it replace the current score?
7. Should the lead-collection SQL be applied (with a backup) so the manual lead form works again?

## F. Go/no-go
- Go for each reform only when: the step 0 facts are confirmed, its E decision is answered, a backup is verified, its tests pass, the dry run on preview matches the expected counts, and HQ approves the release.
- No-go if: any past date would be applied, any path assigns outside LeadHub, any history row would be modified, or a score switch is attempted without the comparison.
