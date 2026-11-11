# Agent self-collected leads: unlimited entry + IT Console / HQ list

## Goal
- Agents can add as many of their own collected leads (with phone) as they want, any day.
- Company leads given by IT/LeadHub stay at 50 per day and must still be completed — nothing changes there.
- IT Console and Executive HQ get one read-only view showing every self-collected lead, with agent dashboard-style details.

## 1. Remove the 50 limit for own leads only
- The daily 50 count will only include company-assigned leads. Leads an agent adds themselves (already saved as "self" source) no longer use up the 50.
- Duplicate phone check, Friday holiday, briefing acknowledgement and audit history stay exactly as today.
- Company daily task rules (accountability lock, follow-up rules) keep counting only company-assigned work, so adding own leads cannot hide unfinished company leads.

## 2. "Agent Own Leads" view (IT Console + HQ)
Read-only, no assign/edit buttons. Pick an agent (or all), Dhaka date range:
- Today's work and KPI: company leads done/pending vs. own leads added today.
- Lead database: all self-collected leads — name, masked phone, agent, date added, status, last call result.
- Lead details and history: ownership, call results, follow-ups, timeline (opens existing lead history).
- Follow-ups and call results summary per agent.
- Phone cards on mobile, full table on desktop; CSV export of shown rows.

## 3. Checks
- Tests: own lead #51+ saves; company lead #51 still blocked; agent cannot see the view; HQ/IT can.
- Visual check on phone and desktop.

## Technical details
- Migration: change `enforce_daily_lead_cap` / daily ledger to skip rows where `assignment_source = 'self'` (no data rewritten; zero-data-loss).
- Update `lead-quota` memory note: 50 cap = company leads; self leads unlimited (owner, 2026-11-12).
- New authority-only server fn `agent-self-leads.functions.ts` (IT full PIN or HQ session, read-only), reusing page-all.ts paging and existing lead history readers.
- New tab in IT Console and HQ nav; no LeadHub/assignment write paths touched.
- Not published until you ask.
