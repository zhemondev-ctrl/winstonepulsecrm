# Agent profile lead entry and recall

## Goal
Agents can enter leads from their own profile, save unfinished entries, and easily find what they submitted later. Keep the existing CRM rather than creating a separate application.

## 1. Put lead entry where agents expect it
- Add a **My collected leads** section beside the agent profile in My Desk, with a matching shortcut in Contacts.
- Offer **Add lead**, **Continue draft**, and the existing reviewed **Import file** action.
- Separate **Drafts**, **Submitted — awaiting LeadHub**, and **Assigned to me**. Entering a lead records who collected it; it does not grant ownership.
- Use the existing Bangla/English language choice, visual style and phone-friendly controls. No new workspace or authority privileges.

## 2. Make detailed input easy, not compulsory
- Keep **customer name** and a **valid phone number** required for submission.
- Keep address, organisation, reference and notes available under **More details**. Use existing CRM fields; do not require agents to invent budgets, appointments or customer intentions.
- Record the collecting agent and Dhaka submission time automatically. Do not let a typed reference name change attribution or ownership.
- Use the shared phone normalisation and duplicate checks, including supported Bangla digits and Bangladesh number formats. Keep any supported international-format entry consistent with the existing canonical validator.
- Provide **Save draft**, **Submit**, and **Submit & add another**. Clear the form only after a confirmed successful save. Keep input after validation or connection errors.
- Resuming a private draft restores exactly what the agent entered. Drafts are not leads, assignments, calls or performance credit.

## 3. Make saved work easy to find again
- Show submission reference, saved date/time and an accurate state: draft, received/awaiting LeadHub, or assigned to the agent.
- Search currently owned leads by name or number, with date and source/status filters. Find pending receipts by reference and submission date without exposing the wider unassigned pool.
- After submission, show a receipt and a direct **View submission** action. After assignment, open the existing lead dossier rather than creating a second customer record.
- Show current-owner lead details and existing call/report/follow-up history only through their existing permission checks. A submission receipt is not permission to read another agent's customer.
- Keep a minimal receipt after a lead is transferred away, but remove customer details and work actions from that agent's view.
- Use stacked records on phones and the existing optional table pattern on larger screens; keep pagination and clear unavailable/empty states.

## 4. Preserve routing, limits and real evidence
- All final submissions use canonical intake, number identity checks and duplicate protection. New records remain unassigned until an authorised **LeadHub Nexus** assignment.
- Link the genuine collector to the submission without adding a self-claim button or an agent-selected owner.
- Honour the owner's latest saved policy: **50 company leads plus at most 10 newly accepted self-collected leads per agent per Dhaka day**. The 11th new self-collected lead is refused before creating a lead. A checked-in migration already caps direct self-owned inserts at 10; its live application is unverified. Preserve that threshold and cover the proposed unassigned submissions without weakening company limits.
- Drafts and rejected duplicates do not consume the new-lead allowance. Retried submissions must count only once. Display confirmed usage and remaining allowance, not an estimated total.
- Self-collected work never replaces company tasks. Keep the saved C/R/A/V/F formula and self-lead scoring setting unchanged; merely entering a lead earns no call, reach, appointment, visit or follow-up points.
- Retain the server-side briefing requirement for new agent mutations and Friday/holiday assignment restrictions. No bypass through file import, another device or a repeated request.
- Duplicate notices must not reveal an existing foreign customer's identity, owner or internal lead ID. Never reassign or overwrite an existing lead on duplicate entry.

## 5. Keep reviewed imports reliable
- Reuse the existing file review process; do not add a new paid AI/OCR service.
- Show accepted, duplicate, invalid and unsaved row counts before/after submission. Validate again when saving.
- Retain rejected/failed rows for correction rather than clearing the whole review after a partial success. Do not silently save an over-limit subset; let the agent choose a valid batch.
- Imported leads stay unassigned and preserve the submitting agent's attribution. Imports must follow the same applicable personal-lead limit, not create a separate bypass.

## Technical details
- Extend `NewLeadDialog`, My Desk/profile placement, and existing reviewed import controls; reuse design-system buttons and language helpers.
- The current web `submitMyLead` passes the agent as `ownerId`, while project rules require LeadHub-only assignment. Replace that immediate ownership with unassigned canonical intake plus a collector receipt. Preserve existing assigned leads and history; no retroactive reassignment.
- The agent-visible file parser currently requires a LeadHub PIN, while the legacy import saver uses different access checks and direct ownership. Reconcile both with verified agent submission and unassigned intake; agents must never borrow a LeadHub PIN to enter personal leads.
- Store private drafts and minimal submission receipts separately from canonical leads, with authenticated, agent-scoped reads. Do not put customer draft contents in persistent browser storage, URLs, analytics or error logs.
- Authorise the verified staff session on every read/write. Browser-supplied agent IDs, profile fields and saved PIN tokens cannot select the actor or grant broader access.
- Use bounded, indexed queries and stable paging for submission history. Derive assignment state from canonical ownership; do not duplicate ownership into profile data.
- Make cap enforcement and new-lead/receipt persistence atomic and idempotent across concurrent web/import/phone requests. Commit audit evidence with the accepted submission; a lost response can be safely retried.
- The existing self-cap counts current-owned inserts and exits for unassigned rows. Use immutable collector/day attribution for the proposed intake allowance so transfers cannot restore slots; verify all existing gates and later LeadHub assignment accounting before changing the intake path.
- Use additive reviewed migrations with explicit grants, restricted access and existing append-only audit rules. Verify backups before any live data change; retain legacy records.
- Keep the existing authenticated server-call conventions and metadata on any changed content page. No new public customer-read endpoint.

## Implementation order
1. Add the profile entry point, grouped form, safe draft handling and honest success/error states.
2. Add collector receipts, unassigned submission, duplicate privacy and atomic 10/day enforcement across applicable intake paths.
3. Add scoped history/search and improve partial-failure import recovery.
4. Verify the complete agent flow and permission boundaries before requesting publication.

## Acceptance checks
- A signed-in agent can save a draft, reopen it, submit a genuine new lead, reload and find the saved receipt; after authorised assignment the existing dossier opens.
- Required fields and optional details are preserved exactly. A failed save does not clear the entry or claim success.
- Ten new personal leads are accepted in one Dhaka day; the eleventh is refused. Duplicates/retries do not consume another slot, and two concurrent submissions cannot exceed the allowance.
- An agent cannot submit as another agent, inspect another agent's drafts/receipts, claim a pool lead, reveal a foreign duplicate or read customer work after transfer.
- Imports remain reviewed and unassigned; partial failures stay recoverable, and limits cannot be bypassed by a file or phone submission.
- Lead entry does not increase C/R/A/V/F scores without the existing saved work evidence. Company-task and briefing rules remain intact.
- Run existing lead/phone/permission tests plus focused new rule tests. Exercise save, reload, duplicate, limit and transfer flows on an isolated staging backend; never insert test customers into the shared live database.
- Check signed-in desktop and phone layouts, submission read-back, searches and error states. Where staging/device access is unavailable, report that check as unverified.

## Scope and release
This is a plan only. No customer records, assignments, live settings, messages or published pages change now. Approval permits preparing the implementation, not applying live migrations, publishing, assigning leads or writing test customers to production; those actions require separate explicit authorisation.