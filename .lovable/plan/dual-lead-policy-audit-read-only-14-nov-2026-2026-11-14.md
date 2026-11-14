# Dual-Lead Policy Audit (read-only) — 14 Nov 2026

Only SELECT queries were run. Nothing was edited, migrated, written or published. No customer data is shown below.
Labels: **[code]** = what the project files say. **[live]** = what the shared live database returned today.

## A. Confirmed facts (code)
- **Company cap of 50.** [code] `drizzle/migrations/0160_self_lead_daily_cap_10.sql` → `enforce_daily_lead_cap()`. It runs whenever a lead's owner changes. It locks per agent per Dhaka day, records each lead in `lead_daily_assignment_ledger`, and refuses the 51st with "Daily lead cap reached". Moving the same lead again on the same day does not count twice.
- **Old self-lead cap.** [code] The same function caps 10/day only when a lead is inserted with `assignment_source='self'` and `source='agent_app'`. That is the older path where the agent becomes the owner straight away.
- **New intake path.** [code] `drizzle/migrations/0164_agent_lead_collection.sql` → `submit_collected_leads_atomic`.
  - It inserts leads with `assigned_to`, `assigned_agent_id` and `assignment_source` all NULL. The cap trigger above therefore exits early and never sees these leads.
  - The 10/day cap is enforced inside the function instead. It counts `agent_lead_receipts` for the agent and day, under a per-agent per-day lock, plus per-phone and per-request locks, and refuses the batch when `used + needed > 10`.
  - Duplicates go through `lead_phone_status` and the `unique_violation` fallback. A duplicate gets no receipt and no customer ID. A receipt and an `audit_logs` row are written for each accepted lead.
  - Receipts and requests are append-only (immutable triggers).
- **App fails closed.** [code] `src/lib/lead-collection.server.ts` returns `ready:false` only when the database functions are missing (codes PGRST202, 42P01, 42883). Any other error is a hard error.
- **Backlog (Net-50).** [code] `src/lib/backlog-cap.ts` `cappedQuota` = min(quota, limit − backlog), default limit 50. This **reduces** the day's quota; it is not a stop. `distribution-preview.ts` flags net50_zero and net50_reduced. Self-collected leads are excluded from backlog.
- **10% review.** [code] `agent_accountability_reviews` with HQ approval (`accountability.functions.ts`). It locks company distribution while a review is pending.
- **Scoring.** [code] Two scorers exist side by side:
  - The saved formula (`score-formula.ts`): points must total 100. Its letters mean C=Calls, R=Reach, A=Appointments, V=Visits, F=Follow-ups.
  - `policyScores` (`daily-score.ts`): 2C+2R+A+4V+1.5F, uncapped. C = leads worked to a final outcome, R = reports, A = attempts, V = connected calls confirmed by the phone's call log, F = completed follow-ups. It is computed at read time, so no stored history is rewritten. Lead entry alone adds nothing.

## B. Live database facts [live]
- The 210 recorded migrations include 0160. The live `enforce_daily_lead_cap` contains the 10-self branch and the 50 ledger, so 0154 has been superseded by 0160.
- The lead-collection setup (0164) is present:
  - 3 tables (drafts, receipts, requests), all with row security on and no policies, so the browser cannot read them directly.
  - 4 functions. Signed-in users cannot run `submit_collected_leads_atomic` directly; only the server can.
  - Immutable triggers on receipts and requests, and trigger `zz_leads_daily_cap` on leads.
- Aggregates: 0 receipts, 0 drafts, 0 unassigned agent_app leads. 161 historic `assignment_source='self'` leads, 1 of them in the last 7 days. No company ledger rows today (Saturday).
- `app_config`:
  - `lead_pool_daily.perAgent = 50`.
  - `daily_score_formula` is the 100-point letter set.
  - There is no `distribution_backlog_cap` row, so the code default (on, 50) applies.

## C. Policy vs current behaviour
| Policy | Current | Status |
|---|---|---|
| 50 company/day | Trigger + ledger, atomic | Implemented [live] |
| ≤10 new self/day | Receipt count under lock in the intake function; old direct-self path also capped | Implemented [live]. The two caps are counted separately (see risk R2). |
| Combined max 60 | No combined check; only follows from 50 + 10 | Implicit only |
| Backlog >10% stops company | 10% leads to an HQ review lock; Net-50 only reduces quota | Partial |
| Self intake allowed during backlog | Intake function does not check the backlog or review lock | Implemented [code] |
| Self work scores, entry doesn't | `policyScores` counts activities only | Implemented [code]. The saved 100-point formula is still the one configured. |
| Preserve history / duplicates / audit | Append-only receipts, audit row, dedupe | Implemented |

## D. Why "Self-Lead saving unavailable" appeared
That statement in the Nov 14 plan is **out of date**. The setup was missing before migration 0164, so the server got a "function not found" error and showed the form as unavailable. 0164 is now live, and the form opened on the live site today (signed in as an agent, with Save draft and Submit showing). No submission has been made yet, so saving itself is still untested in production.

## E. Minimal additive plan (needs approval)
1. **Key gap R1.** Accepted self-collected leads enter the LeadHub pool unassigned. When LeadHub later routes one, `enforce_daily_lead_cap` counts it as a **company** lead in the 50 ledger. It may also go to an agent other than the one who collected it. Fix (additive): when LeadHub assigns a lead that has an `agent_lead_receipts` row, skip the 50 ledger.
2. Make the backlog rule a hard stop: when the configured threshold is exceeded, company distribution receives 0 (same idea as the review lock). Self intake stays untouched.
3. Add a separate self-collected conversion report (counts only) for HQ.
4. Only after an owner decision: make `policyScores` the official daily score. Keep the old formula readable for past dates.
All steps would be additive new migrations. Back up first and keep every existing row.

## F. Acceptance tests (staging or mocked only; preview and live share one database)
- 50 company assignments succeed; the 51st is rejected; reassigning the same lead the same day is not double-counted.
- 10 self submissions accepted; the 11th is rejected; a 3+8 batch is rejected as a whole.
- 50 company + 10 self on the same day = 60. A self lead routed by LeadHub does not take one of the 50 slots (after fix R1).
- Backlog over the threshold or 10%: company run gives 0, while self intake is still accepted.
- Duplicates: same phone across rows, existing lead, and a duplicate inside one batch. Never returns another agent's lead ID and uses no slot.
- Concurrency: 2–5 parallel submissions at count 9 → exactly one accepted. Parallel LeadHub runs → still 50.
- Ownership: an agent cannot read another agent's drafts or receipts, and HQ is read-only.
- Scoring: entry alone = 0; one self-lead call is counted once; recordings add nothing.
- History: row counts in audit_logs, lead_events, follow_up_events and the ledger never go down.

## G. Open owner decisions
1. When LeadHub routes a self-collected lead, should it go back to the collecting agent, and should it be exempt from the 50?
2. What is the backlog hold threshold and metric? Is "10%" the existing previous-day review, or a new overdue-backlog percentage?
3. Should 2C+2R+A+4V+1.5F replace the 100-point saved formula as the official score, and from which date?
4. Should the 161 historic direct-self leads be counted in the new self reports?
