# Roadmap

## Open tasks
- [ ] Current verification batch (14 Nov): publication requested with user's explicit security-risk choice; release markers pass; real live IT PIN unlocked in 870ms; three sequential authenticated IT reloads: 62 requests, median 342.9ms/p95 1457.5ms/max 1839.8ms, all 200, no runtime errors. Connections 27→28/160, memory 10→11%. Second usage remains pre-optimization (0.739028462 database requested credits). 17 call-score/refresh tests pass; no demonstrated remaining call-score path, fresh deep scan pending. Blockers: isolated backend for actual peak benchmark; staff session failed to unlock Desk/password login unavailable; Android workflow access/signing runner absent; automatic history needs Lovable API connection; cost comparison awaits ingestion. Evidence: docs/CRM_RELEASE_BENCHMARK_2026-11-14.md. No customer writes or migrations.
- [x] Database optimization (14 Nov): measured project requested credits (database 0.739028462; 1.19 large instance-hours), health, query/index/storage/schedule evidence. Removed visitor realtime connections and shell immediate burst reloads; full lead reads reuse bounded paging, no preliminary count. 26 isolated tests passed; signed-out HQ subscription joins reduced to zero, preview build OK. Report: docs/DATABASE_OPTIMIZATION_2026-11-14.md. No data/schema/schedule/instance changes or publication. Representative signed-in load, query plans and realized credit savings remain unverified; database tuning needs reviewed measurements and verified backup. Deep scan completed 15:56 UTC: five critical news-permission findings and two warnings, marked outdated; unrelated findings unchanged.
- [x] 14 Nov 2026 publication requested for latest saved code c340ebe9. Live HQ (/hq), IT (/system), Nexus (/leadhub) and Agents (/desk) each returned HTTP 200; compared against preview: master PIN, dedicated LeadHub PIN and agent identifier/password screens match, zero page runtime errors. Manual 1.7.0/$35.29/50 markers pass. Evidence: /tmp/browser/publish-latest/. Successful credential/PIN submission and exact deployed Git SHA are not verified; fresh deep scan still pending/outdated (latest available 15:20 UTC), basic checks clean. Lovable URL rename/visibility remains available in publish settings.
- [ ] Call-evidence spoofing fix implemented (lov_finding_9769fcbac687c648): device sync remains claim-only; shared guards stop device flags, historical labels, log IDs and recorder claims earning V or new lead/report verification; late reconciliation clears trust markers and pending-report verification only. 112 isolated regressions passed across 15 files, preview build OK. Fresh deep-scan confirmation for the saved fix revision remains pending; no production data rewrite. Publication requested 14 Nov 2026; live access-screen and release-marker checks recorded above.
- [ ] Build Android 2.22 (33) from current source for handset call-evidence testing — official signing inputs and JDK/Android SDK unavailable in this sandbox; no connected build runner or handset. Use approved signed build workflow or key custodian script; never substitute an old or differently signed APK. Installation/sync remains unverified.
- [ ] Automatic Security history with provider-supplied commit SHA and completed-scan refresh — blocked: no accessible Lovable API account connection; do not infer revision from timestamps or scaffold unverified provider reads.
- [x] Publication requested after user chose to proceed despite the critical call-score finding; basic scan clean. Live HQ/IT/System/Nexus/Agents and Security return 200, Security History title matches preview, HQ/IT/Nexus Master PIN dialogs and Agents identifier/password form match preview, zero page runtime errors observed. Manual 1.7.0/$35.29/50 release markers pass. Successful credential/PIN submission and exact deployed Git SHA remain unverified; automatic history still blocked on connection. Evidence: /tmp/browser/release-gates/check_gates.py and screenshots (14 Nov 2026).
- [x] Read-only OAuth registration investigation: verified managed Google source, separate workspace Google service helpers and enabled CRM OAuth consent configuration; reported exact documented Google setup and distinguished app returns from provider callbacks. External provider/purpose remains unanswered; no settings or credential changes.
- [x] Add authority-only Security history with dated scan evidence, explicit code-revision linkage and before/after comparisons; pending/stale results never imply verification. Twelve tests pass; signed-in desktop/phone comparison and filtering verified, PIN access tab retained. Curated evidence only, no automatic scan import or publication.
- [x] Build an authority-gated central release dashboard for HQ, IT, Nexus, Agents and System with separate implementation/business/security/publication columns, dated evidence and unresolved checks; no live probes or production writes. Not published.
- [x] Separate implementation permission, business authorization, security review and publication/verification conditions in development instructions.
- [ ] Security review and post-scan release acceptance: deep scan completed 14 Nov 14:57 UTC with two critical findings (unassigned-lead status changes; self-rated completion inflation), marked not up to date. Live HQ, IT/System, Nexus, Agents and dated scores each return 200 with correct titles and access gates, no runtime errors; manual 1.7.0/$35.29/50 markers pass. Remaining: authenticated live confirmation of removed meeting UI and preserved notices; address security findings before wide rollout. No production writes or fixes in verification.
- [x] Remove owner/MD approval as a prerequisite for requested CRM development; prior development-only approval blockers are superseded. Business approvals, security, real-data requirements, isolated testing and explicit production-action scope remain.
- [x] Remove Meeting approvals navigation/screens from HQ and IT, including the HQ meeting approval report shortcut; retain billing notices, site-visit alerts and stored approval history. Not published.
- [x] Fix dialer/incoming proof-sync failed-write acknowledgements and preserve verified talk time; 36 isolated tests pass, including synced V +1/+4 points and no retry double credit. Handset installation/real call remains unverified; publication requested separately.
- [x] Build HQ dated score version page; 12 isolated tests pass. Real HQ read shows 10 agents, Nov 13/14 use V1, V2 is scheduled Nov 15; phone has no sideways overflow or runtime errors. No production writes or publishing; future-day V2 verified by tests only.
- [x] Prepare a plan for agents to enter leads from their profile and find their own submissions again; preserve canonical intake, LeadHub-only assignment, privacy and existing daily rules. Plan only; no customer writes or publication.
- [x] Prepare profile lead entry, private drafts, scoped receipts/search, reviewed-import recovery and atomic personal allowance; 118 isolated tests pass. Signed-in desktop/phone entry renders without runtime errors or sideways overflow; saving remains explicitly inactive. No live schema changes, customer test writes or publication.
- [ ] Collection release acceptance: verify the complete saved-entry flow on an isolated staging backend, reconcile personal-origin LeadHub assignment/50-company-ledger accounting, finish source/status history filters and optional desktop card/table selection. Do not apply the prepared SQL or publish until those checks pass; shared-live activation also requires explicit authorisation and a verified backup.
27. [x] Dry-run preview (LeadHub › Assign, read-only; skips paused days) of the morning distribution: per-agent allocation with Net-50, review lock, pause and pool flags; no writes.
26. [x] Operations manual (v1.7.0, PDF rebuilt, manual:check in sync): document same-day missed-call cadence, Net-50 limit, Saturday 14 Nov pause and demerit rules; rebuild PDF and pass manual:check.
24. [x] Account clean-up: owner chose never-worked company leads only, effective Saturday. One-time database job set for Sat 14 Nov 00:05 Dhaka (717 leads today); worked/follow-up/closed/self leads stay; recall rows block the same agent. [ ] Verify the run on Saturday. [ ] Old published app still runs the 09:10 hand-out without the pause/Net-50 — needs publishing or a Saturday hold (owner choice).
25. "Full production readiness" request (12 Nov, citing HQ approval 11 Nov):
   - [ ] #1 Live mode in Call Sandbox — owner chose to add it (12 Nov). Needs scope details before building.
   - [ ] #2 50 company + 10 personal leads/day — owner chose this (supersedes unlimited). Score formula 2C+2R+A+4V+1.5F: letter meanings needed before building.
   - [x] #3 Retry rules — automatic +2/+3 follow-ups already removed; 1st miss retries the same day, 2nd miss = agent picks within 2 days. Owner confirmed: keep 2 hours later.
   - [x] #4a Site-visit edit lock (owner agent only) — built earlier.
   - [ ] #4b HQ PIN one-time bulk unblock for the 5 blocked agents.
   - [x] #4c Distribution pause 12–14 Nov (only 14 Nov matters: 12 already ran, 13 is Friday) — built, needs publishing.
   - [x] #4d Demerit point tracking — built earlier.
23. Daily audit accuracy + priority list (12 Nov, TrendFlux):
   - [x] Save call start time on every new call report (web + Android); old reports keep empty value, audit falls back to report-open time.
   - [x] Count reports left unfinished that day in the daily audit 10% check (accountability review), no double count for already-pending leads.
   - [x] Compare agents' daily audit results across selected dates (up to 7 days, metric picker, CSV).
   - [x] Daily assignment audit: why each agent received today's count (cap, backlog, review lock, pause).
   - [x] Five separate counters: assigned today, active backlog, follow-up due/overdue, called leads, genuine closed/converted (+ closed on unanswered call).
   - [ ] Wrongly closed lead recovery list (closed with no answered call) — read-only; recovery via LeadHub.
   - [ ] Three-call closure policy — conflicts with owner rule of 31 Oct (Not Interested/Wrong Number allowed on unanswered calls); waiting on owner choice.
   - [ ] Remember bill-notice dismissal on phone — waiting on how long to remember.
   - [ ] Evidence-based implementation & testing plan document.
22. MD report 11 Nov "direct build" (owner Zahid Hasan, 12 Nov):
   - [ ] #1 50+10 policy — not built: conflicts with owner's later decision (12 Nov) that self-collected leads are unlimited. Waiting on owner choice.
   - [x] #2 Same-day 2nd attempt: 1st miss → retry later today; 2nd miss → agent date within 2 working days; 3rd → Unresponsive Pool.
   - [x] #3 Backlog cap (Net-50): daily distribution gives at most 50 − pending backlog.
   - [x] #4 3-day clearance: pause morning auto-distribution on configured days (14 Nov).
   - [x] #5 Demerit log: one point per system block, permanent; HQ cancels with reason.
   - [x] #6 Site-visit edit lock: only the entering agent can change it (IT unchanged); HQ remains view-only — widening HQ write access awaits owner choice.
   - [ ] Publish so the morning cron uses the new rules before Sat 14 Nov (not authorized yet). Operations manual/PDF still describes the old +2/+3 cadence.
- [x] Desk Contacts lead dashboard: cards are the default on phone and laptop (1/2/3 columns); Cards/Table switch keeps the table optional and remembers the choice. Signed-in 1235/390px checks: no page sideways overflow in either view, choice survives reload; 3 tests pass. Not published.
- [x] Removed duplicate Desk desktop sidebar and drawer subsections; added Home to the top grid. Signed-in 1548/390px checks confirm no overflow, Today selection and Home return; six navigation tests pass. No business writes or publication.
- [x] Improved inset gold keyboard focus and Alt+M active-link entry on desktop/phone; verified arrows, Home/End, wrap, Tab/Shift+Tab at 1234/390px, Enter section navigation and phone Escape trigger restoration. Seven regression tests pass; no business writes or publication.
- [x] Track permitted web dial handoff (not connected proof), blocked/request-failed start and online-saved failed outcome; reuse call_captured for saved call end without a duplicate. 24 isolated tests pass, nine-event catalog validates against HEAD; no customer fields, live calls or publication. Actual collector arrival unverified; verified CallLog connected-lead daily goal remains uninstrumented.
- [x] Matched desktop/phone navigation to logo's dominant exact blue RGB(17,33,58); measured header offset prevents sidebar moving under wrapped header. Verified 1234/1280/1024px before/after scroll and fixed bottom drawers at 740/390/320px; 6 tests pass, build OK. Phone menu remains open-on-demand as before; not published.
- [x] Verified 24 real Desk cards at 1234/1280/740/390/320px: desktop/tablet keep two columns, phones stack; fixed in-progress call controls wrapping/height. Repeated check shows no card overflow at all five widths; 19 tests pass. Call state simulated locally only, no calls or CRM writes; not published.
- [x] Restore keyboard focus after IT/Architect back actions: PIN trigger on dialog close, operator email after password-step return, Architect trigger when available (safe PIN fallback otherwise). PIN and Architect fallback focus plus Tab/history verified at 625×433; 30 tests pass. Real signed-in operator return not exercised; not published.
- [x] Match IT/Architect browser Back/Forward with visible back actions; PIN dialog uses history step names only and URL steps cannot grant access. 30 tests pass; browser PIN Back/Forward, dialog back and Architect fallback verified at 625×433; authenticated operator/password navigation not exercised with real credentials. Not published.
- [x] Add a safe own-account CRM password change form in IT access after PIN + operator login; current-password proof and session-owner update, secret fields cleared, no Gmail or live password changes. 31 tests pass and PIN-first mobile screen verified; full authenticated change not exercised against a real account.
- [x] Fix failed-call cadence through the shared report path without rewriting old reports; attempt and idempotency regression checks use isolated mocks.
- [x] Resolve signed-in HQ loading and verify the private approval PDF download: original v2 report, 217077 bytes, exact SHA-256 match; no click errors. No publication or historical lead backfill.
- [x] Extend meeting approvals with HQ-recorded MD decision dates and an item status tracker; preserve recorded timestamps and final locks. No meeting decisions or test records written to production.
21. Scorecard source trends:
   - [x] Per-agent Trend window: stacked daily (weekly above 31 days) bars per source, dated by latest saved assignment to current owner; undated and outside-period counts shown. 7 tests; real check: Debbroto 297 in period + 19 undated + 278 earlier = 594 portfolio; phone no overflow.
20. Workspace move (Nov 10): re-link Google Drive and Google Sheets in the new workspace and verify each with a read.
19. Scorecard source drilldown:
   - [x] Source counts open an authority-only, read-only current-owner lead list (same classifier, search, 25/page). Real check: Debbroto company database 449 = list 449, 18 pages; self-assigned 15 on phone, no overflow.
18. Cold database workflow and scorecard source breakdown:
   - [x] Delivered comprehensive Bangla workflow document in Files; three-attempt SOP remains proposed, explicit opt-outs preserved, no new universal Closed blocking.
   - [x] Added current-portfolio company database/self/unknown/other known source buckets to scorecards and CSV; concrete source tests pass; real HQ shows 10 agents and phone cards without sideways overflow.
   - [x] Ran authorized preservation-mode Daily Lead Report sync: 500 CRM snapshot rows plus 2 website enquiries read back; snapshot has 0 visits and 2 booking records (not approved conversions), with saved statuses. New Leads is empty, successful intake created 0. No reverse writes of visit/outcome mirror cells.
17. Daily Lead Report inbound stream:
   - [x] Created/read back New Leads tab; canonical unassigned intake with server-only hash receipts, bounded run claim, IT status/manual action and 9 stream tests. Real empty intake read back in IT; no invented test customers.
   - [ ] Activate 09:30/18:30 Dhaka schedule after publication and verify real new-row delivery. Live endpoint returns 404; temporary schedule was removed to avoid failed calls. Publication not authorized; real incoming row unavailable because New Leads is empty.
16. Immediate site-visit management alerts:
   - [x] Applied event-driven report/visit triggers and RLS-protected management live alerts; separate resolved history, no backfill/polling/AI/assignment or external messaging. 36 tests passed including 14 isolated PostgreSQL trigger cases; signed-in HQ read/refresh and phone layout verified. Live feed currently empty; no customer test writes or publication, so production event-to-screen delivery remains unverified.
15. VIP recovery first batch (preview only):
   - [x] Original cohort matches 17 historically Hot leads (V2 or saved legacy label); one already closed_converted excluded, leaving 16 review candidates. Three already belong to possible recipient Mehedi Ashraf, so only 13 would transfer; no invented investor eligibility or padding to 20.
   - [ ] Recipient confirmation and final approval pending; Mehedi Ashraf already has 50 unique assignments on November 10, so today’s hard cap blocks additional assignments. No reassignment or recovery-review writes performed.
14. Agent sales scorecards:
   - [x] HQ KPI tab now shows current-portfolio conversion from approved bookings, saved visit bookings and confirmed prior-Hot → closed/not-interested losses; Dhaka dates, agent search, CSV and freshness. 31 tests pass; signed-in real read shows 10 agents, search isolates one and CSV exports 10. Desktop/phone checks have no sideways overflow. No KPI/business-data mutations or publication.
13. Database performance and running-credit review (November 10):
   - [x] Measured project usage, database health, top statements, existing indexes and bounded query plans; inspected scheduled-job metadata.
   - [x] Reduced speculative shared paging; 77 tests pass, same rows preserved, short reads 6→1 requests and 6,075-row reads 12→7.
   - [x] Recorded usage/query/index/schedule findings and capacity/billing limits; authority snapshot loaded in signed-in Desk, agent-only cards correctly unavailable for authority session. No resize, data deletion or publication; agent-session and realized-credit measurements remain unverified.
12. Executive VIP Recovery Queue:
   - [x] Original 100 audit IDs retained in case order; HQ queue shows live lead/agent names, saved source, report evidence and one derived management review task per case.
   - [x] Server-gated append-only idempotent management reviews, search/agent/reason/stage filters and permanent history; no lead/ownership/KPI mutations. Signed-in live reads and draft controls verified; saving/read-back exercised with mocked storage only, never production test writes. Not published.
11. Six-number lead audit (November 9):
   - [x] Matched three distinct numbers (four lead rows including one duplicate), reconciled 21 reports and all 227 history IDs, checked 15 V2 scores, and produced a 75-page Bangla evidence PDF; rendered and inspected every page. No CRM writes or unsupported blame.
   - [ ] Resolve three unmatched numbers and independently confirm claimed visits/identity — original source or assignment receipts and agent/customer evidence are required.
10. Bengali 100-lead evidence and training PDF (November 9):
   - [x] Read one current snapshot of 4,184 eligible owned leads; reproducibly selected 100 distinct training cases (40 positive, 30 rejection, 20 unassessed, 10 other), explicitly not a representative conversion estimate.
   - [x] Produced 211-page Bangla PDF with sources, agent comparison, six-answer qualification, all 153 report IDs, follow-up/booking/state histories and training discussion. Reconciled unique IDs and cohort totals; inspected all pages and corrected split checklist content/index overflow. Distinguished stored verification flags from matched phone evidence. Added to Executive Lead Audit collection (pending file status). No CRM writes or publication.
9. Bengali executive audit presentation (November 9):
   - [x] Produced 39-slide downloadable PowerPoint and PDF from supplied sources, with charts, 13 case studies, six agent reviews, visit histories and speaker notes. All slides rendered and inspected; font glyph/number wrapping corrected and rechecked, schema validated. Historical claims and count mismatches explicitly separated; no CRM or live-data changes.
8. Worked pending lead inactivity alerts:
   - [x] Derived current-owner seven-business-day warnings; 22 rules/regression tests pass, signed-in authority UI shows 126 real warnings on desktop/mobile without live writes. Refresh on opening/focus and every 15 minutes while visible; no publication requested.
7. FinOS activation and publication (November 8):
   - [x] Pulse shared key presence confirmed; disabled signed probe returned 409 and unsigned probe returned 401; all 28 FinOS tests pass.
   - [x] Owner-requested FINOS_SUMMARY_ENABLED=true configured; real signed local financial/work requests returned 200 with persisted receipts.
   - [x] Pulse publication requested for https://crm.winstonebd.com; scheduling is not deployment proof.
   - [ ] Verify live release/API and FinOS-origin read — deployment pending; separate FinOS secret store, session and publication cannot be changed from this chat.
6. FinOS key safety:
   - [x] Presence-only full-IT status, secure replacement guidance and wrong-signature refusal before activation; 28 tests passed.
   - [ ] Verify matching key through a real FinOS-origin read — Pulse key is saved and private signed Pulse probes passed; FinOS configuration cannot be verified here. No key rotation performed.
5. Pulse FinOS summary API:
   - [x] Signed aggregate-only endpoint, bounded Dhaka periods, receipt-before-return and 21 passing tests prepared; local endpoint confirms disabled.
   - [ ] Real FinOS end-to-end test — receiving-project consumer now exists; Pulse activated on November 8, but matching FinOS secret and deployed authenticated consumer read remain unverified.
4. FinOS access log:
   - [x] Read-only IT Access viewer and server-only summary-serving receipt hook; privacy/failure tests passed. No backfilled reads or live writes.
   - [ ] Real FinOS-origin receipt verification — local signed probes persisted genuine receipts; receiving-app session/configuration verification remains outstanding.
3. FinOS financial/work summary read access:
   - [x] Owner authorization recorded: both summary types, aggregate-only, read-only; no customer records or mutations.
   - [ ] Verify authenticated app-to-app reads — FinOS snapshot now contains a scoped signed consumer; its configuration and deployment must be verified in its own chat. Pulse activation/publication requested November 8.
1. Re-link connectors after workspace move:
   - [x] Google Drive — linked fresh after November 8 workspace move
   - [ ] Google Search Console — skipped by user
   - [x] Google Sheets — linked fresh after November 8 workspace move
   - [ ] WhatsApp Business — skipped by user (HQ WhatsApp reports won't send until linked)
2. Android official signed APK — blocker: signing key/passwords live only in GitHub secrets / user's PC; user must fix WINSTONE_KEY_PASSWORD and run the workflow.

## MD approval report (2026-11-11)
- [x] Transcribe meeting audio My_Video1.mp3
- [x] Report v2 PDF with recommended best plan for MD approval
- [x] HQ/IT-only download button for the MD report in CRM

- [x] Own-lead view: show qualified own leads as success; company 50 stays mandatory (owner 2026-11-12)

- [x] HQ read-only recovery queue: leads closed without enough verified call attempts (Recovery review tab).
- [x] Recovery review charts: closures and missing verified-call rate by agent, closure type and date (read-only).
- [x] Weekly Recovery review PDF HQ download button.
- [ ] One-off weekly PDF in Files — needs an HQ session to read real data.
- [ ] 50 company + 10 self-generated daily cap with daily performance scoring — blocked: confirm scoring formula with owner.
- [ ] IT live call records page (HQ PIN): each agent's real calls, connection status, AI summary.
- [ ] Sunday (Nov 15) distribution dry run review.
- [x] Confirm live release markers + Saturday pause visible on LeadHub.
- [x] Dry-run preview date picker.
- [ ] Sunday hand-out recipients — blocked: only runs Sunday morning.
- [ ] Database performance + run-cost optimization (measure, queries/indexes, fix top drivers).
- [x] Hand-out results report (LeadHub).
- [x] Scoring settings form (HQ KPIs tab); scores not yet computed from it.
- [x] Verify latest publish live (score settings, hand-out results)
- [ ] Dry-run preview comparison dashboard
- [x] Save C/R/A/V/F formula
- [x] Leads/day with call-log-confirmed connected call
- [x] IT call records page (HQ PIN)
- [x] Dry-run comparison dashboard
- [x] Hand-out history by date and agent (LeadHub)

## 14 Nov requests
- [ ] Forecast vs received date-range report (accuracy trends) in LeadHub
- [ ] Dual-lead policy request (6 modules) — blocked: conflicts with approved cadence/score/lock rules; needs MD confirmation

## Dual-lead (14 Nov 2026)
- [x] Migration A: self-lead attribution, routed self leads skip 50 ledger
- [x] LeadHub routes attributed leads to collector; HQ-only reroute with reason
- [x] Migration B: score_formula_versions; V2 from 2026-11-15, older days 100-pt
- [x] Show fresh backup evidence, then publish (requested 14 Nov)
- [ ] Phone call proof → V: server path ready; blocked until agents install Android 2.22+ (devices report 2.3 and older)
- [ ] Agent draft/submit test on live data (needs owner OK: creates permanent lead)

## GitHub sync + CI (14 Nov 2026)
- [ ] Sync main to github.com/zhemondev-ctrl/winstonepulsecrm — blocked: agent cannot push/connect; user connects Git sync (creates a NEW private repo, cannot link existing) or pushes from own machine
- [x] Fix 9 failing tests so Web CI goes green and coverage reports (2,191 passed, lines 23.12%)
