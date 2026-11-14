# WINSTONE PULSE — 100% Scope Read-Only Audit

**Date:** 14 November 2026. **Evidence collection:** 15:20–15:26 UTC (21:20–21:26 Dhaka).  
**Audited source revision:** `3359baa888b5113a12ea75f5aadd4f2ddd20cacd` (`3359baa8`), committed 2026-11-14 15:13:51 UTC.  
**Selected fixes revision:** `e41e0544`, preceding the audited history-view commit.  
**Canonical production:** https://crm.winstonebd.com. **Product:** Winstone Pulse, premium real-estate CRM.  
**Decision:** **NO-GO for unconditional production/Android distribution or “100% verified” sign-off.** This is a complete report across the requested scope, not certification of exhaustive behavioral verification.

## Executive summary

- Source contains 133 route modules plus the root, 497 library modules and 323 component files. Four operational workspaces share one managed database; IT and System use the same `/system` address.
- Actual database inventory: **157 tables, all RLS enabled; 74 public policies; 406 indexes; 126 application triggers; 104 functions, 48 security-definer; 141 foreign keys, 125 CHECK constraints, 63 UNIQUE constraints, 157 primary keys**. RLS with no policy is intentionally fail-closed for many server-only tables, not automatically a defect.
- Full isolated test execution: **2,215 tests: 2,174 passed, 4 failed, 37 pending/skipped**; **316 test files: 312 passed, 4 failed**. New ownership and completion-guard tests passed (15 + 11). Lint failed: **22,808 problems (22,743 errors, 65 warnings)**, mostly formatting; no autofix performed.
- Freshly completed deep scan at **15:20:49 UTC** does not re-report either selected finding, but is marked **not up to date**. Its completion notification names `e41e0544`; the persisted scan payload does not expose a commit SHA. Thus it supports absence of recurrence on that scan, **not clearance of current `3359baa8`**. It reports a new **Critical call-evidence spoofing** issue and **Warning arbitrary WhatsApp recipient** issue.
- Fresh dependency audit reports **one High and six Moderate advisories**. Secret-safe repository/public-download inspection found no keys/secrets in 2,864 scanned files; this is not a private-key custody audit or proof binaries contain no secrets.
- Production manual returns 200 and passes `1.7.0 / $35.29 / 50-lead` markers. Production `/security` still has the old PIN title, while preview source has Security History: **confirmed presentation parity gap**. Exact published commit is unknown; markers do not identify it.
- Latest application backup is **13 Nov 17:30:02 UTC**, done with checksum metadata, but covers only six tables. Current source lists ten; there is no verified ten-table post-migration backup, actual checksum revalidation or isolated restore drill. It is not a whole-system backup.
- Android source is **2.22 (33), com.winstone.connect**; live release catalog is **2.13 (24)**. All 36 documented device acceptance rows remain NOT DONE. No phone test/build/signing occurred in this audit.
- Database capacity snapshot is healthy; 15 unresolved runtime issue groups and 355 cumulative occurrences remain. Integrations are mostly source-implemented or preparation-only; no external messages, AI calls, provider probes or delivery tests were run.

## 1. Safety, methodology and status vocabulary

Only the requested report is created. No application source, schema/migration, record, secret, setting, permission, integration, security disposition or service state changed. No publishing, signed APK build, live write probe, restore, backup run, or mutation-bearing E2E was executed. Public HTTPS GETs and aggregate/catalog SELECTs were used; no customer names, numbers, IDs, notes, call content or secret values were selected. Database tool calls naturally generate operational telemetry; no application business action was invoked.

**Implemented:** exists in source. **Partially implemented:** some stages exist but contract/coverage missing. **Configured:** observed configuration only. **Verified:** specified check actually executed here. **Unverified/unknown:** no adequate execution/evidence. **Blocked:** prerequisite unavailable or unsafe in this read-only scope. **Not applicable:** e.g. retired UI/service path, not an operational success.

Evidence sources: repository paths cited below; managed scan/linter/health/schedule tools; read-only catalog/aggregate queries; `git status/log`; full Vitest JSON and lint output; unauthenticated production HTTP reads. Temporary evidence is under `/tmp/winstone-audit` and tool-results paths below; temporary files are not durable artifacts. Core results are reproduced in this report. Specialized read-only source reviews: route/access, workflow/backup, Android/CI. No claim of exhaustive function-by-function authorization proof is made.

## 2. Identity, revisions, publication and parity

Baseline working tree was clean. Latest source commit was `3359baa8`; selected security changes are in `e41e0544`. Source is TanStack Start/React 19/Vite 7 with Tailwind v4, managed database/auth/storage, Worker deployment target. `src/start.ts` preserves bearer middleware and server-function CSRF controls. `src/router.tsx` supplies Query cache/navigation behavior. Shared preview/live database prevents safe mutation demonstrations.

Executed `bun scripts/check-live-release.ts`: HTTP 200, live manual 1.7.0; all three markers PASS, script prints DEPLOYED. **Interpretation is strictly marker-level release evidence**; no commit matching, authenticated feature acceptance or latest security-fix deployment proof follows. Current public `/security` title is `PIN ও অ্যাক্সেস — Winstone Pulse`; source `src/routes/security.tsx` title is `Security History & Access — Winstone Pulse`.

`/hq`, `/system`, `/leadhub`, `/desk`, `/score-versions`, `/security`, `/release-status`, `/manual` each returned 200. These prove reachable pages, not successful HQ/IT/PIN sessions. No authenticated production navigation was performed because loading operational pages can invoke reads with audit writes/presence effects. Exact deployed commit, hosted publishing audience, and platform deployment metadata are **unknown**.

Production headers on all eight sampled pages: HSTS `max-age=31536000; includeSubDomains`, nosniff and strict-origin-when-cross-origin referrer policy present; CSP and X-Frame-Options not observed. This is header evidence only; application frame/CSP mitigations outside those headers were not exhaustively tested. Single-request times 0.20–2.70s are not a benchmark or SLA.

## 3. Module/page inventory and authorization model

Appendix A enumerates **all 133 route definitions** and their direct backend imports/component dependencies. Root layout is `src/routes/__root.tsx`. Route imports are static evidence, not a complete transitive data-flow graph. Large workspaces assemble many panels/functions; full per-function grants require further focused review.

Main workspaces: `/desk` own-work agent; `/hq` executive oversight; `/system` IT tools (operation-specific gates); `/leadhub` separate LeadHub PIN. `/dispatch` redirects to LeadHub; coordinator deck resolves none and is retired even though legacy scope types/comments exist. `/security` retains own-role PIN guidance for staff and authority-only scan history via `readSecurityHistory`; `/release-status` is authority-gated dated evidence, not monitoring. Guides/legal/public preparation do not confer authority.

### Role paths

| Path | Implemented controls | Verification/limitation |
|---|---|---|
| Staff session | verified claims + active/approved profile, protected role/grant resolution | source reviewed; no multi-account live access matrix |
| Agent own work | session-first `resolveWorkCaller`, current canonical ownership, read-only denial | isolated tests; full workflow E2E blocked |
| HQ | authority read-only generally; dedicated booking/accountability review exceptions | role tests pass; business exceptions need endpoint matrix |
| IT full PIN | verified full scope; write gates separate from authority-read gate | shared-token replay risk below |
| LeadHub | `requireLeadHub`, sole assignment path | source and database guards, not allocation executed |
| Architect | separate financial verification/unlock path | source only; no billing action |
| Android | hashed `x-device-token`, stored profile/device, active/approved/unrevoked | source; no real handset proof |
| Public hooks/webhooks | signature/job token/device credentials inside handler | varies by endpoint; no external delivery test |

Evidence: `src/lib/access.server.ts:56–62,103–147,158–204`; `src/lib/device-auth.server.ts:117–145`; `src/lib/pin-auth.server.ts:24–36`; `src/start.ts:25–30`; `src/lib/lead-access.server.ts`; `src/lib/assigned-lead-scope.server.ts`.

### Selected ownership fix

`triageMyLead` now rejects missing verified staff identity, unassigned/foreign/conflicting owners for non-authority callers; matches both saved owner columns at update time; requires a returned row before follow-up/history. Writable authority remains, HQ read-only remains. Evidence `src/lib/agent-desk.functions.ts:143–184`; **15 tests pass**. Mock tests record filter construction but do not execute actual concurrent SQL; missing userId test is coupled with missing profile, so independent missing-session coverage remains a known gap. Do not exaggerate these as complete auth/transfer E2E.

### Administrative session risk

`src/lib/admin-gate.server.ts:17–21,67–84` mints deterministic HMAC scope tokens, with no per-session expiry/nonce/user binding or individual revocation. `src/lib/local-session.ts:8,27–40,54–66,101–108` persists them in JS-readable localStorage. PIN rotation can leave environment PIN fallback and existing scope tokens valid. This is a **High design risk**, not evidence of a demonstrated XSS exploit. PIN-attempt cookies/atomic counters address attempts, not long-lived token replay.

`accounts.functions.ts:21–81` identifier login reads a bounded first 500 profiles and has no visible app-level web attempt limiter; hosted Auth limits/password settings are **unverified**. The mobile login route has a separate limiter. General `rate-limit.ts` uses instance-local state; not distributed flood protection.

## 4. Database, policies, grants, migrations and immutability

Actual table summary is Appendix B. All 157 tables enable RLS; 104 no-policy linter entries are expected candidates for server-only access. There are 74 public policies; policy evidence includes lead own/supervisor reads/updates, report owner updates, recording owner/supervisor reads, protected roles and storage access. Broad SQL privileges alone do not defeat RLS. Effective privilege checks showed many tables grant anon/staff SELECT/INSERT/UPDATE; therefore correct RLS and server boundaries remain critical. `information_schema.role_table_grants` returned no rows in the inspection context; that does not establish absence of grants—`has_table_privilege` confirmed effective privileges instead.

Linter: **114 issues: 104 INFO RLS/no-policy, five WARN mutable search_path, two WARN anonymous security-definer, three WARN authenticated security-definer**. Callable definer functions are `guard_assignment_review`, `guard_it_onboarding_transition` (trigger functions) and `is_active_staff` (authenticated only). Trigger functions' EXECUTE grants are not by themselves callable row mutations through RPC; review actual function signatures/behavior before treating as exploitable. Mutable path functions: `append_only_block`, `block_messenger_history_mutation`, `block_messenger_sync_decision_mutation`, `block_meta_verification_mutation`, `credential_incidents_append_only`.

Live migration ledgers: **213 Drizzle records**, latest created timestamp **2026-11-14 14:27:06 UTC**; legacy managed migrations latest version `20260910183753`. Source contains both legacy `supabase/migrations` and Drizzle migrations. Row counts/timestamps and live objects do not prove every migration hash equals source; a complete hash/schema diff was not run. Latest self/score tables and score version are present; selected completion guard function and enabled trigger observed.

Key actual indexes: phone-key canonical identity primary/unique index, alias index, `(agent_id,work_date,lead_id)` assignment ledger primary key; unique CallLog/client-upload/external-call IDs; one pending report per agent; unique follow-up parent and idempotency keys; ownership/time paging indexes. **Duplicate canonical-phone key groups: 0** (aggregate only). This does not prove all legacy lead numbers have keys.

Enabled guards include lead no-delete, completion/outcome, ownership synchronization, provenance, first-assignment eligibility/review/cap, report validation/protection/auto-booking, booking no-delete/link/review/outbox, follow-up lifecycle/no-delete/change immutability, receipt/request/attribution/version immutability, meeting history protections, audit triggers. Core record audit captures six tables; not every table has a trigger (see Appendix B). Service-role bypass remains intentional and requires server authorization. No destructive test of any guard performed.

Storage: **14 buckets, all private**. Aggregate object counts: android-apk 2; app-downloads 2; call-audio 55; crm-backups 30; database export 1; HQ daily reports 10; HQ documents 1; project photos 15; staff photos 15. Bucket privacy is not a proof of each signed-URL/ownership path. Policies were inspected from `pg_policies`; no objects downloaded, private URL minted or customer media listened to. Sensitive content and credential tables have zero-policy server access by design.

## 5. Lead lifecycle and operational rules

Implemented canonical intake, normalization, dedup lookup and unique-race recovery (`lead-intake.server.ts:50–108`); source display preserves unknown arrival/verification (`lead-provenance.ts`). Indexed phone keys/aliases replace full-row phone extraction. CSV/file intake uses validation/review before canonical import; whole-file malformed input/fuzz/large-upload acceptance not executed.

Latest collection SQL (`drizzle/migrations/0165_self_lead_attribution.sql:80–128`) uses agent/day/request locks, payload replay hash, draft revision, sorted phone locks, count checks, receipts and immutable attribution; creates **unassigned** entries. LeadHub routing to collector skips company ledger. Older `intakeLead` can insert owned self rows; actual path must be distinguished, not inferred from stale comments. Capture/manual callbacks cannot assign via arbitrary payload. Two related tests fail (section 10), so intake behavior is not fully accepted.

Company cap **50 unique/day** and separate self **10/day**, both Dhaka-based; Friday blocks distribution. Company review/backlog holds do not block self entry. Database review guard still applies Friday before self exemption. Net-50 previews/configured backlog rules are implemented; every sibling allocator's end-to-end behavior remains unverified. Zero-work neglect notices/recall, worked-lead alerts, permanent recalls/disputes, no same-agent recalled reassignment and morning briefing gate exist. `tests/staging/call-flow.staging.ts:19–31` requires opt-in, non-live URL, matching confirmation; current match is substring-based, not full parsed origin proof. No staging run was attempted against the shared live database.

Known risks: serial allocation bounded to 5,000 rows and max+1 is non-atomic (`lead-intake.server.ts:143–155`); older intake insert/log calls are not one transaction. Unknown: complete post-transfer visibility across every historical feed and import path, retained legacy phone-key completeness.

## 6. Calls, reports, follow-up, scoring, visits and bookings

Calling is agent-owned SIM via Android, not central telephony. Outgoing OFFHOOK means initiated only; matched Android CallLog carries talk time; missing permission/ambiguous evidence never assumes answered. Device queue identity/call UID is stable, cross-account queue rejected, late evidence uniquely reconciled. Evidence labels are display-only, not independent verification. Server lifecycle patches preserve already-confirmed duration; failed writes return failure.

**Critical trust boundary:** device can submit positive duration and `talk_time_source='call_log'`; a compromised/replayed legitimate device credential can assert the source. Ownership and idempotency protect identity/duplicates but **do not independently attest native call history**. `call-state.ts:23–33,135` / `incoming-call.ts:43–44,220`; current scanner finding `lov_finding_9769fcbac687c648`. Do not call V tamper-proof; no exploit request sent.

Reports share qualification/finalization (`call-reports.server.ts:420–647`, `finalize_call_report_v2`): six factual answers server-scored; rejection mode preserves null classification where appropriate; submitted edits protect saved grades; report close requires reason; append-only linked follow-up transitions check current task/lead scope. Recording/audio never contributes to score. Report submission explicitly permits completion of pending reports without the blanket 9:05 check (`api/public/agent/report.ts:192–197`); reconcile documented exception rather than claim universal briefing coverage.

No-answer cadence exists in `no-answer-cadence.ts`: same-day retry, bounded next attempt, three strikes, unresponsive/reactivation and holiday rules. Some memory/manual timing descriptions conflict; authoritative behavior needs isolated time-boundary matrix and business interpretation, not invented scheduling.

Scoring: actual `score_formula_versions` has **policy_v2 effective 2026-11-15**. `score-version.ts` chooses latest effective row and rejects unknown versions. 14 Nov remains historical points100 fallback; policy V2 `2C+2R+A+4V+1.5F`, uncapped, company+self, one row once; C final closed outcomes, R submitted reports, A attempts, V phone-log claims, F completed follow-ups. Prior memory “replaces now” differs from saved effective date; **database day selection wins for observed implementation**. Historical displays can be recomputed from saved activity, not certified immutable score snapshots. Version-aware use by every consumer not fully established.

Completion guard `guard_lead_work_outcome` exists live and blocks authenticated direct changes to work/status/outcome/temperature/grade/classifier fields; actual migration executed offline by **11 passing tests**. Providing ratings cannot bypass it. Server finalization remains privileged. Full RLS end-user request path was not attacked.

Site visit functions and booking functions enforce scoped access/read-only checks. Auto-booking from converted submitted report starts pending; HQ/IT reviewer + trigger controls OS queue; pipelines distinguish pending/rejected approval. Manual create handlers do not explicitly require saved report signal in reviewed code (`site-visits.functions.ts:51–67`, `bookings.functions.ts:63–85`); shared/trigger proof of the mandatory signal on every creation path remains **unverified**, not an asserted exploitable bypass. Five-stage lead pipeline exists; no customer stage changed here.

## 7. AI and integration inventory

| Integration / feature | State established | Remaining evidence |
|---|---|---|
| Managed AI gateway / alternate Meta/Vertex paths | implemented server-side model selection and grounded JSON helpers | per-prompt full data inventory, provider retention/permissions and real read authorization unknown |
| Winstone AI/Command Agent | scoped proposals/read-only aggregate review; whitelisted confirmed actions elsewhere | no AI call or action executed; all prompts/audio PII transformation not exhaustively audited |
| Coaching, summaries, transcription, support knowledge | implemented bounded/cache/server logic | accuracy, consent, cost and provider delivery unknown |
| Google Drive / Sheets | approved-folder knowledge, recording/backups, literal ID sheet updates/schedulers implemented | connector availability after workspace move and actual delivery not freshly verified |
| WhatsApp | template-only/count-only alert server paths and signed delivery inbox | arbitrary-recipient opt-in finding; phone ownership/consent proof and delivery unknown |
| HQ daily report | scheduled 17:40 Dhaka, bounded totals/PDF path | no send/PDF delivery or recipient proof tested |
| Meta Messenger | separate inbox/preparation, stored receipt/ownership path gated | approvals/subscription/storage activation unverified, fail-closed preparation |
| Windsor | configuration-presence/full-PIN path; no rows without reviewed contract | contract/account/timezone/source grants unverified |
| Winstone OS | signed/idempotent inbound/outbox implementation | inbound also permits bearer secret, not HMAC-only; outbound contract/dispatch delivery unknown |
| FinOS | authenticated aggregate-only summary bridge/log-first design | reciprocal configuration/real consumer acceptance unverified |
| n8n | timestamped HMAC/idempotent receipt/unassigned canonical intake | configured enablement and live delivery not probed |
| Website/RSS knowledge | stored pages, attributed news, requested visits | freshness/remote source accuracy and real ingestion not tested |
| Firebase | push/connectivity/provider dependency code | delivery unverified; grpc-js High advisory |
| Appwrite | independent connectivity test/public config only | not CRM system of record; no ping run |
| Email / Paddle | authenticated/signature webhook code | hosted email/auth/billing settings and end-to-end receipts unknown |
| MCP/OAuth | managed endpoints and SDK dependency | scopes/auth audience/actual external session flow unverified; six dependency advisories |

Evidence `ai-model.server.ts:108–156`, `integration-readiness.ts`, `messenger-readiness.ts`, `windsor-reporting.ts:19–29`, `docs/integrations.md`, respective `/api/public/*` handlers. Secret presence was not inspected or changed; no service was enabled. Current schedules are configured metadata only and **do not establish provider permission or delivery**. Exact third-party connections were not re-linked/listed; previous workspace claims are not reused as verified configuration.

## 8. Android audit

Source release `com.winstone.connect`, 2.22 (33), minSdk24/target35/compile35. Debug `.test`, sandbox `.sandbox`; sandbox manifest removes internet/calling/production components, invalid endpoints, synthetic export only. AGP8.7.3, Kotlin/Compose2.0.21, Gradle8.9, Java17, SDK/buildtools35. Android Appwrite SDK24.0.0 compatibility pin. Main API literal canonical domain can differ from configurable BuildConfig CRM_BASE_URL.

`CallSyncQueue.kt`, `CallOutcomeWorker`, `CallHistoryEvidence`, `SyncErrorClassifier`, `SecureTokenStore`, `RecordingConsent`, `QueueOwnership`, `ActiveCallStore`, `ReportReplay`: offline local cursor/network retries, keystore encrypted token, owner stamps, matched-number/time proof, consent, account-switch drops, durable call ID and replay implemented. Permanent errors stop, auth/briefing wait, transient retry; unknown/audit-trail retries can continue indefinitely. These are not verified handset outcomes.

Official signing scripts/workflow pin approved public fingerprint, refuse wrong signer/in-project keystore/debuggable APK, preserve runner-temp cleanup; environment reviewer configuration and key custody/backups unknown. Respect owner's selected signer; **do not propose changing signer as audit remediation**. Documentation still contains historical pending fields/contradictions and version2.17/2.21 versus current2.22. Runtime release catalog latest2.13(24), showing a distribution metadata gap, not proof what is installed on a phone.

`.github/workflows/android-tests.yml` runs JVM tests + unsigned release/sandbox; only android/workflow paths trigger it; no connected instrumentation/device E2E. Manual android-release workflow needs protected environment; protection settings not read. Actions use moving version tags; wrapper distribution SHA missing: reproducibility defense-depth risk.

**No Android tests, Gradle build, signed APK verification, ADB install or real-device call executed here.** Java/Android tools not discovered in shell; do not install/build for this read-only report. Historical doc claims (113 tests/builds etc.) are historical, not this audit's proof. All36 device acceptance rows NOT DONE, tester/phone/APK fields blank. Official agent distribution remains blocked until same signed APK acceptance/pilot and queue-preserving update proof.

## 9. Security scans and selected fix verification

Fresh deep completion notification: job `security-scan-990267f3-e41e0544-c2f5e03c`, completed in this audit. Retrieved twice; payload timestamp **2026-11-14T15:20:49.823987541Z**, `up_to_date=false`. Both original IDs absent:
- `lov_finding_8a3e16b247fedc86`: ownership fix committed, tests pass; not re-reported by completed e41 scan.
- `lov_finding_d831a56546e40269`: live guard + offline tests pass; not re-reported by completed e41 scan.

**Conclusion:** regression and live schema support the two fixes; completed scan provides no recurrence for job-linked `e41e0544`, but cannot certify latest `3359baa8` because marked stale/no payload SHA. Absence also follows prior disposition deletion; fresh scan timing is essential and does not establish independent exploit testing. Do not mark current code “clean”. No findings changed in this audit.

Open scanner findings (only two currently persisted deep findings):
1. **Critical/error** `lov_finding_9769fcbac687c648`, agent-submitted call-log flag/duration can inflate score; source trust boundary confirmed, no exploit run.
2. **Warning** `lov_finding_8ca1df3cdd6ad624`, signed-in user's saved WhatsApp number used for test template send without ownership proof. No access_basis metadata; do not infer internet/colleague reachability or change severity from assumed publishing audience.

Existing basic DB result dated14:30:45 stale; prior quick checks passed, but **no new basic/deep scan initiated in this audit** (only existing scans read, linter and dependency audit executed). Advanced pentest result18Oct stale. Fresh dependency audit **69 production packages checked**, 7 advisories: firebase12.19.0 → grpc-js High fixed1.13.6; mcp-js3.4.0 → two hono/node-server Moderate fixed2.1.6; Hono wildcard/mount/CSRF/form Moderate fixed4.13.16 or >4.13.15. Reachability must be assessed per runtime; no upgrade/disposition applied. No deep-check-disabled flag returned; absence is not proof all possible testing coverage exists.

## 10. Automated quality results and CI

Executed default full suite with `RUN_LIVE_SCOPE_TESTS` and `STAGING_E2E` unset:
`env -u RUN_LIVE_SCOPE_TESTS -u STAGING_E2E bunx vitest run --reporter=json --outputFile=/tmp/winstone-audit/vitest.json`
Result **success=false**, 2,215 total, 2,174 pass, 4 fail, 37 pending; 316 file results (312 pass,4 fail). Vitest also reports nested suite totals787/780pass/7fail; **do not confuse nested suite count with file count**.

Failures:
- `tests/optimization-pass.test.ts`, “never auto-assigns or trusts a payload agent_id”: static expectation `ownerId: null,` absent in source. Could be brittle source contract drift; intake safety not thereby proven broken.
- `tests/publish-gate-sync-fixes.test.ts`, “ignores assign=true and a payload agent_id; keeps capture attribution”: mocked request expected201, got400. Validation/mock/API drift needs diagnosis; don't declare bypass from assertion.
- `tests/recovery-weekly-pdf.test.ts`, “builds”: ENOENT `/tmp/x/w.pdf`; test assumes directory. PDF content/layout not verified. Audit did not repair/create prerequisite then rerun.
- `tests/route-role-access.test.ts`, inventory expects66 page files, observed69; inventory assertion stale. Not complete authorization coverage.

Selected tests: ownership15, completion guard11, security history4, authority-history4 **passed in full suite**. Database tests use isolated PGlite; runtime backend fetch guard denies shared-live access. No staging or mutation-bearing live scope run. Coverage percentage unknown: suite ran without instrumentation/coverage. CI history pass/fail unknown; only Android workflows found, no web CI workflow verified.

`bunx eslint .`: exit1,22,808 issues (22,743errors,65warnings);22,685errors/1warning potentially autofixable. No formatting/autofix. `bun run scan:sensitive`:2,864tracked/public files, no signing keys/secrets found. Binary exclusions/size limits mean not comprehensive secret proof. `manual-meta.mjs check`: PDF/hash/version in sync1.7.0, not visual PDF inspection. `check-build-tool-pin.mjs`: installed/bun.lock2.25.2 OK; declaration2.27.1 warning, override forces2.25.2; no package-lock SKIP. Semantic-color checker passed.

Build: no manual build run (platform build policy); observed harness build OK entries latest15:24:12UTC. This establishes preview compile signal, **not a clean production-install build or Worker runtime test**. Typecheck not run: project tsgo binary absent; no package/dependency install allowed. Do not equate build green with typecheck pass. No tests were altered to make audit green.

## 11. Backup, recovery and schedule evidence

Current `crm-backup.server.ts:3–7` allowlist10 tables: leads,reports,follow-ups,bookings,visits,profiles,assignment ledger,receipts,audit logs,lead events. Latest stored done backup13Nov17:30:02.823833UTC: counts leads6475,call_reports6577,follow_up_events2336,bookings38,profiles12,site_visits13; bytes2,210,183; checksum-present=true. Prior5 runs done with checksum metadata.30storageobjects observed. No download/checksum recompute/object-body inspection permitted; complete readable recovery file **unverified**.

Nightly `crm-nightly-backup`17:30UTC/23:30Dhaka active. Latest backup age roughly21h56m, within24h; does not include four required baseline tables or newer attribution/version/request/audit structures. Fresh source ten-table coverage is **not observed in completed artifacts**. Delta is expected across time but cannot prove post-migration consistency: current leads+13,reports+192,follow-ups+68 versus backup.

Implementation limitations: sequential offset reads not consistent snapshot; checksum generated not validated on load; same-date check/upsert/upload has no atomic lease and upload upsert can overwrite on racing runs; metadata/pruning error checks missing; retention30days pruning only after new run; source excludes credential/legal_name identity detail; backup omits most157tables/auth/media. Restore only lead/report fields; denylist misses source/reference_by/work_date despite no-provenance comment; write and restore-audit non-atomic, no CAS row version. **No restore drill or full recovery/RPO/RTO evidence exists in this audit.** No backup/restore endpoint called.

Configured schedules (all19active) listed Appendix D. Some old schedule metadata omits target/auth details; do not read raw commands because they may hold credentials. Identical17:30Dhaka shift-summary and lead-report jobs can race absent sequential chaining proof. Provider runs/failures were not queried with raw payloads; schedule active ≠ successful.

## 12. Aggregate production reconciliation

Single aggregate observation **2026-11-14 15:21:22.057629UTC**:

| Dataset | Count |
|---|---:|
| Leads |6488|
| Assignment ledger |1946|
| Collection receipts |0|
| Audit logs |11529|
| Lead events |30763|
| Follow-up events |2404|
| Call reports |6769|
| Call recordings |788|
| Bookings |38|
| Site visits |13|
| Profiles |12|

Lead status closed3162/contacted388/follow_up230/pending2708 =6488. Work state completed3698/duplicate_skipped307/pending2399/snoozed68/unresponsive16 =6488. Unassigned2616, assigned3872; owner-column conflicts0.
Assignment sources: bulk_rebalance190,company_reset717,coordinator_manual43,duplicate_skipped312,lead_database3478,null1587,self161 =6488. Thus **161 self-tagged historical leads do not imply161 new collection receipts**; receipt0 is distinct newer path, not necessarily missing data. No real collection submission was demonstrated.

Completed≠closed:584 completed but not closed;48 closed but not completed; difference3698−3162=536=584−48. Duplicate source312 versus work-state307 are different fields, not identical counters. Reports6769 and recordings788 are different units and optional audio is not required evidence for every report; do not subtract and label5981 lost calls. Assignment ledger is unique historical agent/day/lead, not current owned lead count. No individual dashboard loaded/read; strict dashboard totals reconciliation requires authorized aggregate query contract/date/scope/effective formula. These distinctions explain apparent inconsistencies, not certify every UI KPI.

Device aggregate:69rows,64unrevoked,1seen24h,mostrecent14Nov14:19:51UTC. These are registrations/activity—not64working phones or accepted clients. Runtime issue aggregate15open/355occurrences,2resolved/2occurrences; latest open seen12Nov14:32:49UTC. No messages/stack customer payloads selected. Audit-history timestamp query failed because column assumption; latest record timestamp remains unknown, not an absence of audit.

## 13. Performance, observability, privacy, accessibility and exports

Database health: DB/pool up; memory10%,disk4%,connections25/160,pool1/800,125.4MB database,128MBWAL,0restarts sinceboot,no recent exhaustion alerts.20,692rolled-back transactions sinceboot are cumulative—not current incident rate. No load/concurrency/stress test run; no query-text log inspected (avoids possible embedded data).

Indexed own-lead paging/current-owner checks, page-all bounded parallel pages/dedup/fail-on-partial, query coalescing8s/hidden-tabstale, lazy shell overlays and recovery backoff present. Some bounded scans (profile500,serial5000) risk incomplete results. Runtime telemetry sanitization/read-only diagnostic access exists;15openissues require safe category triage. Empty/errored reads must not infer zeros.

Export comparison: `audit-export.ts:2–7` strips/formula-protects whitespace; `migration-export.tsx:49–58` first-character-only guard has weaker protection against whitespace-prefixed formula payloads; exploit depends on spreadsheet. Migration export chunks1000rows network but holds full JSON/CSV/ZIP in browser (`:79–139`), not consistent DB snapshot or streamed disk, risking phone freeze. ID-matched sheet writes preserve HQ cells in source; no write exported/refreshed here. CSV/PDF exact-total and layout QA not performed; PDF test failure remains.

Privacy: no customer PII accessed by audit. AI/provider content/retention, recording consent real execution, downloadableAPKbinary review, backup credentials minimization and deletion retention acceptance unknown. Recording consent/app-owned queue scopes are source safeguards, not audio capture proof.

Accessibility source includes semantic regions, labels, focus/reduced-motion and phone layouts. No full keyboard/screen-reader/contrast/browser audit run here. Shared shell skip-to-main not found by targeted static review; context-dependent dialogs/tables need acceptance. Previous screenshots/tests are prior evidence only; not rerun for audit.

## 14. Ranked risk register

|ID|Severity|Evidence and business impact|Recommended owner|Remediation recommendation (not executed)|Acceptance criterion|
|---|---|---|---|---|---|
|R01|Critical|Device-controlled CallLog flag/duration; new scan error; fabricated V/KPI possible|Security+Android/server lead|Threat-model trusted call evidence; prevent unsupported self-attestation being treated as independently verified|isolated forged/replay tests denied, approved real call proof accepted once, fresh current-SHA scan|
|R02|High|Deterministic persistent PIN tokens, no expiry/user revocation|Security/IT|Bound sessions and revocation; retain required HQ/LeadHub scope boundaries|expired/stolen/session-cross-user tokens denied; rotation invalidates intended access|
|R03|High|Backup6actual vs10source and157system; no verified restore/checksum/read snapshot|IT recovery owner|Complete explicitly scoped backup contract + integrity/lease/CAS/atomic restore audit; independent full recovery coverage|post-migration complete counts/checksum validated; isolated restore/RPO/RTO drill witnessed|
|R04|High|7production advisories,1High|Dependency maintainer/security|Reachability review/upstream-compatible patch with pinned lockfile|fresh scan clears applicable advisories; clean-install regressions|
|R05|High|Four failed tests;lint22,808;typecheckunknown|QA/web lead|Diagnose intake400/static drift/PDFdirectory/routeinventory; separate formatting from behavioral issues|full isolated suite green; lint/typecheck/build gates reproducible|
|R06|High|Android2.22source vs2.13release;36acceptanceNOTDONE|Android release custodian/QA|Same approved signer, verified build provenance, real-device acceptance/pilot|36rows evidenced, correctID/hash/signature/version, queue-preserving update|
|R07|High|CurrentSHA not confirmed scanned/published; Security title parity gap|Release manager|Independent current-SHA scan/provenance and gated release acceptance after explicit publish scope|exactSHA recorded; deep fresh; authenticated page checks; markerpass|
|R08|Medium|WhatsApp arbitrary opted-in number, Warning|Messaging owner/security|Verify recipient ownership/consent and safe bounded test send|foreign number cannot receive test without verified consent; ownnumber success|
|R09|Medium|Site/booking report-signal gate not proved on manual paths|CRM workflow owner|Trace every creation path and enforce existing factual-origin rule|no unsupported entity creation in isolated tests; saved signal accepted|
|R10|Medium|OS inbound bearer fallback conflicts HMAC-only instruction|Integration/security lead|Reconcile authenticated bridge contract/replay scope without loosening controls|approved signed/idempotent contract, replay/wrongcaller tests|
|R11|Medium|Weblogin limiter/hostedAuthsettingsunknown;bounded500lookup|Auth/IT|Document hosted guards and indexed identifier path|attack/legitimate account acceptance without500cutoff or enumeration|
|R12|Medium|CSVescape inconsistency/full-memory exports|Reporting/web QA|Unified safe export rules and bounded/streamed delivery|formula injection edge inputs safe; totals exact; phone memory stress passes|
|R13|Medium|Provider permissions/activations/deliveryunknown|Integration owner|Separate config/consent/delivery proofs; keep unavailable paths failclosed|service-specific signed test receipt with no invented entities|
|R14|Medium|Scoringeffective15Nov/historyrecompute/briefingexception/docsdrift|Business+QA|Reconcile dated formula and documented exception across all consumers|14/15day boundary, no crossday credit, authorized snapshot semantics|
|R15|Medium|15openruntimeissues/355occurrences, no incidentrate|IT observability|Safely categorize/redact/reproduce issues; bounded alerting|known causes addressed and no new occurrences in defined window|
|R16|Medium|BroadSQLgrants/267adminclientreferences;no exhaustive functionmatrix|Security/database owner|Audit endpoint-by-endpoint scope and currentowner; no blanket grant weakening|complete auth/RLS/storage matrix and denied-role tests|
|R17|Low|Mutable searchpath/callabletriggerdefiner lint|DB maintainer|Classify genuine exposure vs trigger-only lint and harden paths|linter disposition backed by signature/evidence; no behavior loss|
|R18|Low|MutableCIactiontags/noGradlehash/docsversionsconflict|Build/release lead|Provenance/reproducibility and current document consistency|pinned verified tooling; custody/doc fields truthful|
|R19|Low|Accessibilitycoverageunknown/skiplinknotfound|Frontend QA|Independent keyboard/screen-reader/phone acceptance|critical flows usable at phone/desktop;labels/focus/contrast checked|

These are audit assessments, not new persisted scanner dispositions. Unknowns are acceptance blockers, not fabricated failures. No Critical claim is made about mere no-policy/server-only tables.

## 15. Production decision and exact sign-off checklist

**NO-GO for 100% sign-off / broad Android rollout / unconditional new release.** Existing site is reachable and core protections exist, but do not disable or change it in this audit. Controlled existing operation is a business decision separate from technical acceptance.

- [ ] Resolve or evidence-bound the new Critical call-proof spoofing issue; real answered/unanswered and forged-source tests.
- [ ] Fresh deep review identifies latest intended code SHA, up-to-date status, retained open findings/disabled checks; no inference from deleted findings.
- [ ] Fix or formally assess WhatsApp recipient ownership, long-lived administrative replay and applicable dependency advisories.
- [ ] Full isolated test suite passes; lint/types/cleanproductionbuild gates recorded; routeinventory matchesactual133definitions.
- [ ] Independent stage/backend isolation proven before mutation E2E; no tests against sharedproductiondata.
- [ ] Complete post-migration backup coverage/count/checksum; checksum read-validation; witnessed isolated restore; RPO/RTO and auth/media coverage.
- [ ] Exact published SHA/provenance and authenticated HQ/IT/Nexus/Agent/System acceptance; meetingUI absent and billing/visitalerts preserved; manualmarkers pass.
- [ ] Official APK latestcode/sameapprovedsigner/hash/ID/version/nondebuggable proven; all36handsetrows and oneagentpilot; queue/accountswitch/update/reboot proofs.
- [ ] Every write/read endpoint has documented role/read-only/current-owner contract, including service-role paths, storage signed links and API/webhook/job scopes.
- [ ] Quota/backlog/self/Friday/report/followup/scoring14vs15Nov boundaries accepted; manualcreatefacts/OSbearerexception reconciled.
- [ ] Integrations individually evidence configuration, permission, consent and actual signed/idempotent delivery; inactive paths stay failclosed.
- [ ] AggregateKPIcontracts/timefilters reconcile UIcounts; reports/CSV/PDF totals/privacy/formulas safe; no inventeddata.
- [ ] Runtime openissues assessed, browser/accessibility/performance/export stress acceptance, providerprivacy/retention/cost documented.
- [ ] Explicit publish/production-action scope provided separately; this audit never authorizes migrations, writes, messages or release.

“100%” can describe checked requested categories only; a system cannot be certified risk-free by this report. Every unchecked item is an explicit limitation or prerequisite, not an automatic failed system.

## 16. Evidence manifest and failed-inspection disclosure

Durable evidence: source/test/workflow/document paths; baseline SHA above; this report's embedded totals. Temporary evidence: `/tmp/winstone-audit/vitest.json`, `vitest.log`, `lint.log`, `sensitive.log`, `public-checks.json`, `routes.json`, `tables.json`. Tool catalog evidence paths:
- scans `/tmp/tool-results/security--get_scan_results/20261114-152227-526044`;
- tables `/tmp/tool-results/supabase--read_query/20261114-152116-051664`;
- policies `/tmp/tool-results/supabase--read_query/20261114-152117-862291`;
- functions `/tmp/tool-results/supabase--read_query/20261114-152120-621787`;
- grants `/tmp/tool-results/supabase--read_query/20261114-152251-487180`;
- triggers `/tmp/tool-results/supabase--read_query/20261114-152408-029237`;
- selectedindexes `/tmp/tool-results/supabase--read_query/20261114-152409-533219`.

Four read-only query assumptions returned errors, not data changes: backup `started_at` (corrected tocreated_at), phone-key `phone` (corrected tocanonical_phone), record-audit `created_at` (latesttimestampunknown); multi-SELECT request returned only final result (reissued groupedaggregate). A guessed sales-access source path absent; no claim based on it. No credential needed or exposed. Temporary logs are not a promise of permanent audit-log retention.

## Appendix A — Complete route/import inventory

Each entry includes direct backend and mounted CRM component dependencies; recursive dependencies and actual access are not inferred from import names. Dynamic/backend authorization must be evaluated separately. Route IDs with `_` are un-nested IDs; public URLs strip those markers.

|Route ID|Evidence file|Purpose/title or handler category|Direct backend / mounted CRM dependencies|Visible gate signals|
|---|---|---|---|---|
|`/.lovable/oauth/consent`|`src/routes/[.]lovable.oauth.consent.tsx`|Approve access · Winstone Pulse|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/.well-known/oauth-protected-resource`|`src/routes/[.well-known]/oauth-protected-resource.ts`|Utility/identity/redirect endpoint|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/agent-activity`|`src/routes/agent-activity.tsx`|Agent activity — Winstone Pulse|`@/components/crm/AppShell`<br>`@/components/crm/AgentOnboarding`<br>`@/components/crm/RoleGate`|RoleGate|
|`/api/public/agent/briefing`|`src/routes/api/public/agent/briefing.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/call-start`|`src/routes/api/public/agent/call-start.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/call-state`|`src/routes/api/public/agent/call-state.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/coach`|`src/routes/api/public/agent/coach.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/dashboard-metrics`|`src/routes/api/public/agent/dashboard-metrics.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/device-capability`|`src/routes/api/public/agent/device-capability.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/incoming-call`|`src/routes/api/public/agent/incoming-call.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/login`|`src/routes/api/public/agent/login.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/logout`|`src/routes/api/public/agent/logout.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/notices`|`src/routes/api/public/agent/notices.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/presence`|`src/routes/api/public/agent/presence.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/recorder`|`src/routes/api/public/agent/recorder.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/reminders`|`src/routes/api/public/agent/reminders.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/report`|`src/routes/api/public/agent/report.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/support`|`src/routes/api/public/agent/support.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/sync-failures`|`src/routes/api/public/agent/sync-failures.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/version-handoff`|`src/routes/api/public/agent/version-handoff.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/version`|`src/routes/api/public/agent/version.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/whatsapp`|`src/routes/api/public/agent/whatsapp.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/agent/workspace`|`src/routes/api/public/agent/workspace.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/backups/run`|`src/routes/api/public/backups/run.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/config/maintenance`|`src/routes/api/public/config/maintenance.ts`|🔒 SYSTEM MAINTENANCE LOCKED|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/config/rules`|`src/routes/api/public/config/rules.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/download/apk`|`src/routes/api/public/download/apk.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/email-events`|`src/routes/api/public/email-events.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/finos/summary`|`src/routes/api/public/finos/summary.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/deploy-health`|`src/routes/api/public/hooks/deploy-health.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/drive-backup`|`src/routes/api/public/hooks/drive-backup.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/lead-distribution`|`src/routes/api/public/hooks/lead-distribution.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/lead-neglect`|`src/routes/api/public/hooks/lead-neglect.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/market-news`|`src/routes/api/public/hooks/market-news.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/monthly-summary`|`src/routes/api/public/hooks/monthly-summary.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/os-outbound`|`src/routes/api/public/hooks/os-outbound.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/reminders`|`src/routes/api/public/hooks/reminders.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/service-billing`|`src/routes/api/public/hooks/service-billing.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/shift-summary`|`src/routes/api/public/hooks/shift-summary.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/hooks/website-knowledge`|`src/routes/api/public/hooks/website-knowledge.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/ingest/analyze`|`src/routes/api/public/ingest/analyze.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/ingest/lead`|`src/routes/api/public/ingest/lead.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/ingest/message`|`src/routes/api/public/ingest/message.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/ingest/outcome`|`src/routes/api/public/ingest/outcome.ts`|External/managed API handler|Inspect local handler/imported helpers|verifyLeadFromCallEvidence|
|`/api/public/ingest/recording`|`src/routes/api/public/ingest/recording.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/ingest/reprocess`|`src/routes/api/public/ingest/reprocess.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/integrations/status`|`src/routes/api/public/integrations/status.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/jobs/agent-whatsapp-alerts`|`src/routes/api/public/jobs/agent-whatsapp-alerts.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/jobs/firebase-grpc-watch`|`src/routes/api/public/jobs/firebase-grpc-watch.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/jobs/inventory-sheet`|`src/routes/api/public/jobs/inventory-sheet.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/jobs/lead-report-sheet`|`src/routes/api/public/jobs/lead-report-sheet.ts`|External/managed API handler|`@/lib/lead-report-schedule.server`|No direct signal; inspect delegated backend|
|`/api/public/jobs/messenger-retention`|`src/routes/api/public/jobs/messenger-retention.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/jobs/sheet-lead-intake`|`src/routes/api/public/jobs/sheet-lead-intake.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/meta/messenger`|`src/routes/api/public/meta/messenger.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/n8n/leads`|`src/routes/api/public/n8n/leads.ts`|External/managed API handler|`@/lib/n8n-pipeline.server`|verifyOsRequest|
|`/api/public/os/events`|`src/routes/api/public/os/events.ts`|External/managed API handler|Inspect local handler/imported helpers|verifyBearer, verifyOsRequest|
|`/api/public/paddle/webhook`|`src/routes/api/public/paddle/webhook.ts`|External/managed API handler|Inspect local handler/imported helpers|verifyWebhook|
|`/api/public/reports/summary`|`src/routes/api/public/reports/summary.ts`|External/managed API handler|Inspect local handler/imported helpers|resolveCaller|
|`/api/public/smoke`|`src/routes/api/public/smoke.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/telemetry/runtime-error`|`src/routes/api/public/telemetry/runtime-error.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/tmp-bulk-import`|`src/routes/api/public/tmp-bulk-import.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/api/public/whatsapp/webhook`|`src/routes/api/public/whatsapp/webhook.ts`|External/managed API handler|Inspect local handler/imported helpers|verifyWebhookRequest|
|`/audit-log`|`src/routes/audit-log.tsx`|Audit log & backups — Winstone Pulse|`@/lib/crm-backup.functions`<br>`@/components/crm/AiTeamSummary`<br>`@/components/crm/AppShell`<br>`@/components/crm/CredentialIncidentTracker`<br>`@/components/crm/MetaVerificationReport`<br>`@/components/crm/PageHeader`<br>`@/components/crm/RoleGate`|RoleGate|
|`/audit-report`|`src/routes/audit-report.tsx`|Production Readiness / Audit Report — WINSTONE PULSE|`@/components/crm/audit/AuditWorkspace`|No direct signal; inspect delegated backend|
|`/auth`|`src/routes/auth.tsx`|Sign in — Winstone Pulse|`@/lib/accounts.functions`|No direct signal; inspect delegated backend|
|`/booking-review`|`src/routes/booking-review.tsx`|Booking Review — Winstone Pulse|`@/lib/bookings.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/hq/BookingPipelinePanel`<br>`@/components/crm/RoleGate`|RoleGate|
|`/call-records`|`src/routes/call-records.tsx`|Call records — Winstone Pulse|`@/lib/call-records.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`|RoleGate|
|`/call-sandbox`|`src/routes/call-sandbox.tsx`|Offline call sandbox — Winstone Pulse|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/coach`|`src/routes/coach.tsx`|AI Sales Coach — Winstone Pulse|`@/lib/coach.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/SnapshotSkeleton`|No direct signal; inspect delegated backend|
|`/contributions`|`src/routes/contributions.tsx`|এজেন্ট অবদান রিপোর্ট — Winstone Pulse|`@/lib/agent-contribution.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/PageHeader`<br>`@/components/crm/RoleGate`|RoleGate|
|`/credits`|`src/routes/credits.tsx`|ক্রেডিট বিল — Winstone Pulse|`@/lib/credits-report.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`|RoleGate|
|`/customers`|`src/routes/customers.tsx`|Support Customers — Winstone Support Desk|`@/lib/support-staff.functions`<br>`@/components/crm/AppShell`|No direct signal; inspect delegated backend|
|`/desk`|`src/routes/desk.tsx`|My Desk — Winstone Pulse|`@/lib/desk-work.functions`<br>`@/components/crm/DailyAllocationSummary`<br>`@/components/crm/LeadNeglectPanel`<br>`@/components/crm/PhotoUpload`<br>`@/components/crm/StaffAvatar`<br>`@/components/crm/Bi`<br>`@/components/crm/SalesChartsDashboard`<br>`@/components/crm/desk/DeskCommandCenter`<br>`@/components/crm/hq/SiteVisitsPanel`<br>`@/components/crm/AppShell`<br>`@/components/crm/CommandAgentPanel`<br>`@/components/crm/MyCallLog`<br>`@/components/crm/MyPhoneSetup`<br>`@/components/crm/PhoneSyncGuide`<br>`@/components/crm/MyProfileCard`<br>`@/components/crm/MyCollectedLeads`<br>`@/components/crm/CarryOverLeads`<br>`@/components/crm/LeadDayBoard`<br>`@/components/crm/desk/WorkViews`<br>`@/components/crm/FollowUpAlarm`<br>`@/components/crm/FollowUpCalendar`<br>`@/components/crm/FollowUpWeek`<br>`@/components/crm/DocSummaryPanel`<br>`@/components/crm/MyReports`<br>`@/components/crm/NewLeadDialog`<br>`@/components/crm/LeadImportDialog`<br>`@/components/crm/LeadDeadlineBanner`<br>`@/components/crm/KnowledgeHubCards`<br>`@/components/crm/AccountabilityBanner`<br>`@/components/crm/LeadTable`<br>`@/components/crm/MobileLeadQueue`<br>`@/components/crm/QueueBoard`<br>`@/components/crm/SmartInsightStrip`<br>`@/components/crm/TeamSupportInbox`<br>`@/components/crm/TeamSupportPanel`<br>`@/components/crm/SnapshotSkeleton`<br>`@/components/crm/WhatsappInbox`<br>`@/components/crm/MessengerInbox`<br>`@/components/crm/desk/DeskTabBar`<br>`@/components/crm/social/SocialDesk`<br>`@/components/crm/desk/TodayHero`<br>`@/components/crm/desk/MyProgressCard`<br>`@/components/crm/desk/MyWhatsAppAlerts`<br>`@/components/crm/AiLeadPriority`|No direct signal; inspect delegated backend|
|`/diagnostics`|`src/routes/diagnostics.tsx`|Call & page diagnostics — Winstone Pulse|`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`<br>`@/components/crm/CallDiagnosticsPanel`<br>`@/components/crm/AndroidApkInstallGuide`<br>`@/components/crm/ApkPreInstallChecklist`<br>`@/components/crm/PhoneTestResultsForm`<br>`@/components/crm/DeviceCallTestChecklist`<br>`@/components/crm/SandboxResultsReport`<br>`@/components/crm/DeviceCompatibilityReport`|RoleGate|
|`/dispatch`|`src/routes/dispatch.tsx`|Dispatch moved to LeadHub Nexus — Winstone Pulse|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/docs-admin`|`src/routes/docs-admin.tsx`|ডকুমেন্টেশন ব্যবস্থাপনা — Winstone Pulse|`@/lib/docs.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`|RoleGate|
|`/docs-admin_/editor/$slug`|`src/routes/docs-admin_.editor.$slug.tsx`|পাতা সম্পাদনা — Winstone Pulse ডকুমেন্টেশন|`@/lib/docs.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/MarkdownView`<br>`@/components/crm/RoleGate`|RoleGate|
|`/docs`|`src/routes/docs.tsx`|Winstone Pulse ডকুমেন্টেশন|`@/lib/docs.functions`<br>`@/components/crm/AppShell`|No direct signal; inspect delegated backend|
|`/docs_/$slug`|`src/routes/docs_.$slug.tsx`|Utility/identity/redirect endpoint|`@/lib/docs.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/MarkdownView`|No direct signal; inspect delegated backend|
|`/facebook-ads`|`src/routes/facebook-ads.tsx`|Facebook Ads Reporting Preparation — Winstone Pulse|`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`<br>`@/components/crm/WindsorReporting`|RoleGate|
|`/handover`|`src/routes/handover.tsx`|Client Handover & Feature Report — WINSTONE PULSE|`@/components/crm/DocPage`|No direct signal; inspect delegated backend|
|`/help`|`src/routes/help.tsx`|Help Centre — Winstone Support|`@/lib/support.functions`|No direct signal; inspect delegated backend|
|`/help_/$slug`|`src/routes/help_.$slug.tsx`|Utility/identity/redirect endpoint|`@/lib/support.functions`<br>`@/components/crm/MarkdownView`|No direct signal; inspect delegated backend|
|`/hq`|`src/routes/hq.tsx`|Executive HQ — Winstone Pulse|`@/components/crm/SystemManualCard`<br>`@/components/crm/DailyAllocationSummary`<br>`@/components/crm/hq/LeadPoolNotice`<br>`@/components/crm/hq/AgentTargetPanel`<br>`@/components/crm/hq/AgentKpiDashboard`<br>`@/components/crm/hq/AgentSalesScorecards`<br>`@/components/crm/hq/ScoreFormulaSettings`<br>`@/components/crm/hq/DailyScoresPanel`<br>`@/components/crm/hq/AgentSelfLeadsPanel`<br>`@/components/crm/DistributionFailurePanel`<br>`@/components/crm/hq/Lead360Workspace`<br>`@/components/crm/AgentDossier`<br>`@/components/crm/HqDrillSheet`<br>`@/components/crm/AgentRadar`<br>`@/components/crm/CommandAgentPanel`<br>`@/components/crm/AskHqPanel`<br>`@/components/crm/ExecutiveBrief`<br>`@/components/crm/ShiftSummaryPanel`<br>`@/components/crm/Leaderboard`<br>`@/components/crm/LeadDossier`<br>`@/components/crm/RoleGate`<br>`@/components/crm/MaintenanceNotice`<br>`@/components/crm/SmartInsightStrip`<br>`@/components/crm/SnapshotSkeleton`<br>`@/components/crm/AppShell`<br>`@/components/crm/hq/ExecutiveOverview`<br>`@/components/crm/hq/SalesCommandCenter`<br>`@/components/crm/hq/HqHeader`<br>`@/components/crm/hq/HqStatTiles`<br>`@/components/crm/hq/HqSmartSummary`<br>`@/components/crm/hq/HqClassificationTiles`<br>`@/components/crm/hq/HqMixCards`<br>`@/components/crm/SalesChartsDashboard`<br>`@/components/crm/hq/HqTalkChart`<br>`@/components/crm/hq/HqRecentSummaries`<br>`@/components/crm/hq/FloorLockAdminPanel`<br>`@/components/crm/news/MarketNewsFeed`<br>`@/components/crm/sales-intel/SalesIntelPanels`<br>`@/components/crm/AccountabilityReviewPanel`<br>`@/components/crm/LeadNeglectPanel`<br>`@/components/crm/social/SocialHqPanel`<br>`@/components/crm/reports/ReportsBoard`<br>`@/components/crm/hq/ConversationOutcomesPanel`<br>`@/components/crm/hq/WhatsappAgentSummary`|RoleGate|
|`/import`|`src/routes/import.tsx`|লিড ইমপোর্ট — Winstone Pulse|`@/lib/crm.functions`<br>`@/lib/lead-sheet.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`|RoleGate|
|`/inbox`|`src/routes/inbox.tsx`|Support & Messenger Inbox — Winstone Pulse|`@/lib/support-staff.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/MessengerInbox`<br>`@/components/crm/MessengerConnectionStatus`|No direct signal; inspect delegated backend|
|`/`|`src/routes/index.tsx`|Winstone Pulse — The Premium Real Estate CRM|`@/components/crm/AdminPinDialog`|No direct signal; inspect delegated backend|
|`/ingest`|`src/routes/ingest.tsx`|Ingest Validation — Winstone Pulse|`@/lib/ingest.functions`<br>`@/components/crm/AdminPinDialog`<br>`@/components/crm/AppShell`<br>`@/components/crm/SnapshotSkeleton`|No direct signal; inspect delegated backend|
|`/integrations`|`src/routes/integrations.tsx`|Integration Status — Winstone Pulse|`@/components/crm/AppShell`<br>`@/components/crm/IntegrationStatusPage`|No direct signal; inspect delegated backend|
|`/inventory`|`src/routes/inventory.tsx`|ইনভেন্টরি — Winstone Pulse|`@/lib/inventory.functions`<br>`@/components/crm/AppShell`|No direct signal; inspect delegated backend|
|`/it-access`|`src/routes/it-access.tsx`|IT access — Winstone Pulse|`@/lib/accounts.functions`<br>`@/components/crm/AdminPinDialog`<br>`@/components/crm/ItOwnPasswordForm`|No direct signal; inspect delegated backend|
|`/leadhub`|`src/routes/leadhub.tsx`|LeadHub Nexus — Winstone Pulse|`@/lib/leadhub.functions`<br>`@/components/crm/HandoutResults`<br>`@/components/crm/HandoutHistory`<br>`@/components/crm/DryRunUsage`<br>`@/components/crm/AppShell`<br>`@/components/crm/DailyAllocationSummary`<br>`@/components/crm/CsvImportDialog`<br>`@/components/crm/DistributionDryRun`<br>`@/components/crm/LeadDatabasePanel`<br>`@/components/crm/HeadLeadIntakePanel`<br>`@/components/crm/SnapshotSkeleton`<br>`@/components/crm/deck/AssignLeadsWorkspace`<br>`@/components/crm/deck/DeckKpis`<br>`@/components/crm/deck/ImportHistoryPanel`<br>`@/components/crm/deck/ImportFunnelPanel`<br>`@/components/crm/deck/LeadStorePanel`<br>`@/components/crm/AdminPinDialog`<br>`@/components/crm/Bi`<br>`@/components/crm/InstructionCopilot`<br>`@/components/crm/deck/AssignLeadsWorkspace`|checkLeadHubAccess|
|`/live-leads`|`src/routes/live-leads.tsx`|Live Lead Dashboard — Winstone Pulse|`@/lib/live-leads.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`|RoleGate|
|`/load-diagnostics`|`src/routes/load-diagnostics.tsx`|Page-load diagnostics — Winstone Pulse|`@/lib/load-diagnostics.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`|RoleGate|
|`/lovable/email/auth/preview`|`src/routes/lovable/email/auth/preview.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/lovable/email/auth/webhook`|`src/routes/lovable/email/auth/webhook.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/lovable/email/transactional/preview`|`src/routes/lovable/email/transactional/preview.ts`|External/managed API handler|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/manual`|`src/routes/manual.tsx`|System Manual & Client Handover — Winstone Pulse|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/mcp`|`src/routes/mcp.ts`|Utility/identity/redirect endpoint|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/messenger-setup`|`src/routes/messenger-setup.tsx`|Messenger & Windsor.ai Connection Progress — Winstone Pulse|`@/components/crm/AppShell`|No direct signal; inspect delegated backend|
|`/messenger`|`src/routes/messenger.tsx`|Messenger Inbox — Winstone Pulse|`@/components/crm/AppShell`<br>`@/components/crm/MessengerInbox`<br>`@/components/crm/CredentialRedactor`|No direct signal; inspect delegated backend|
|`/meta-control-center`|`src/routes/meta-control-center.tsx`|Meta Integration & Webhook Control Center — Winstone Pulse|`@/components/crm/AppShell`<br>`@/components/crm/MetaControlCenter`<br>`@/components/crm/RoleGate`|RoleGate|
|`/migration-export`|`src/routes/migration-export.tsx`|Migration Export Center — Winstone Pulse|`@/lib/migration-export.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`|RoleGate|
|`/migration`|`src/routes/migration.tsx`|মাইগ্রেশন চেকলিস্ট — Winstone Pulse|`@/lib/migration-checklist.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`|RoleGate|
|`/news`|`src/routes/news.tsx`|Market News — Winstone Pulse|`@/lib/sales-intel.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/news/MarketNewsFeed`|No direct signal; inspect delegated backend|
|`/privacy`|`src/routes/privacy.tsx`|Privacy Policy — Winstone Pulse|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/projects`|`src/routes/projects.tsx`|প্রজেক্ট ডিরেক্টরি — Winstone Pulse|`@/lib/project-reports.functions`<br>`@/lib/inventory.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/ProjectCatalog`<br>`@/components/crm/BrochureZipPanel`<br>`@/components/crm/ProjectSalesTools`<br>`@/components/crm/InventorySheetPanel`|No direct signal; inspect delegated backend|
|`/qualify`|`src/routes/qualify.tsx`|WhatsApp Lead Qualification — Winstone Pulse|`@/lib/unit-inventory.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/LangToggle`|No direct signal; inspect delegated backend|
|`/recorder`|`src/routes/recorder.tsx`|Recorder — Winstone Pulse|`@/lib/recorder.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/Bi`|No direct signal; inspect delegated backend|
|`/release-status`|`src/routes/release-status.tsx`|Implementation & Release Status — Winstone Pulse|`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`<br>`@/components/crm/ReleaseStatusDashboard`|RoleGate|
|`/reports`|`src/routes/reports.tsx`|Custom Reports — Winstone Pulse|`@/components/crm/reports/ReportsBoard`<br>`@/components/crm/RoleGate`<br>`@/components/crm/AppShell`<br>`@/components/crm/SnapshotSkeleton`|RoleGate|
|`/reset-password`|`src/routes/reset-password.tsx`|নতুন পাসওয়ার্ড সেট করুন — Winstone Pulse|`@/lib/accounts.functions`|No direct signal; inspect delegated backend|
|`/runtime-errors`|`src/routes/runtime-errors.tsx`|Runtime Errors & Deployment Health — Winstone Pulse|`@/lib/runtime-errors.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`|RoleGate|
|`/sales-intel`|`src/routes/sales-intel.tsx`|Sales Intelligence — Winstone Pulse|`@/lib/sales-intel.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/news/MarketNewsFeed`<br>`@/components/crm/sales-intel/SalesIntelPanels`|No direct signal; inspect delegated backend|
|`/score-versions`|`src/routes/score-versions.tsx`|Dated score versions — Winstone Pulse|`@/lib/score-formula.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`<br>`@/components/crm/hq/DailyScoresPanel`|RoleGate|
|`/security`|`src/routes/security.tsx`|Security History & Access — Winstone Pulse|`@/components/crm/SecurityHistoryPanel`<br>`@/components/crm/AppShell`<br>`@/components/crm/PinVaultPanel`<br>`@/components/crm/RoleGate`<br>`@/components/crm/SnapshotSkeleton`|RoleGate|
|`/service-bill-alert`|`src/routes/service-bill-alert.tsx`|Service Bill Alert — Winstone Pulse|`@/lib/service-bill-review.functions`|No direct signal; inspect delegated backend|
|`/service-bill-unlock`|`src/routes/service-bill-unlock.tsx`|Secure Service Bill Review — Winstone Pulse|`@/lib/service-bill-review.functions`|No direct signal; inspect delegated backend|
|`/signin`|`src/routes/signin.tsx`|Sign in to your workspace — Winstone Pulse|`@/components/crm/AdminPinDialog`<br>`@/components/crm/DailyPerformance`|No direct signal; inspect delegated backend|
|`/site-visits`|`src/routes/site-visits.tsx`|Site Visits — Winstone Pulse|`@/components/crm/AppShell`<br>`@/components/crm/KnowledgeHubCards`<br>`@/components/crm/hq/SiteVisitsPanel`|No direct signal; inspect delegated backend|
|`/social-pages`|`src/routes/social-pages.tsx`|সোশ্যাল পেজ ও গ্রুপ — Winstone Pulse|`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`<br>`@/components/crm/social/SocialPagesAdmin`|RoleGate|
|`/staff-portal`|`src/routes/staff-portal.tsx`|HQ Staff Portal — Winstone Pulse|`@/lib/staff-portal.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/AgentOnboarding`<br>`@/components/crm/RoleGate`|RoleGate|
|`/support-admin`|`src/routes/support-admin.tsx`|Support Admin — Knowledge Base, AI & SLA Settings|`@/components/crm/AppShell`|No direct signal; inspect delegated backend|
|`/support`|`src/routes/support.tsx`|Chat with Support — Winstone|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/sync-failures`|`src/routes/sync-failures.tsx`|Android sync failures — Winstone Pulse|`@/lib/android-sync-failures.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/RoleGate`<br>`@/components/crm/sync/CallSyncAuditLog`|RoleGate|
|`/system`|`src/routes/system.tsx`|System & Billing — Winstone Pulse|`@/components/crm/HubAlerts`<br>`@/components/crm/DistributionFailurePanel`<br>`@/components/crm/SystemManualCard`<br>`@/components/crm/DeploymentStatusPanel`<br>`@/components/crm/ItPhoneTestReports`<br>`@/components/crm/SearchConsoleDashboard`<br>`@/components/crm/AgentWhatsAppAlertsPanel`<br>`@/components/crm/DbPerformanceDashboard`<br>`@/components/crm/hq/DailyAgentAudit`<br>`@/components/crm/AccountApprovals`<br>`@/components/crm/ApkInstallCard`<br>`@/components/crm/PhoneAcceptanceChecklist`<br>`@/components/crm/AppReleasePanel`<br>`@/components/crm/AuditTrail`<br>`@/components/crm/AccountabilityReviewPanel`<br>`@/components/crm/DocSummaryPanel`<br>`@/components/crm/DriveBackupPanel`<br>`@/components/crm/ExtraLeadPanel`<br>`@/components/crm/LeadDatabasePanel`<br>`@/components/crm/hq/AgentSelfLeadsPanel`<br>`@/components/crm/TeamSupportInbox`<br>`@/components/crm/MaintenancePanel`<br>`@/components/crm/OsSyncPanel`<br>`@/components/crm/SecurityMonitorPanel`<br>`@/components/crm/YearArchivePanel`<br>`@/components/crm/LeadReportSheetPanel`<br>`@/components/crm/SheetLeadStreamPanel`<br>`@/components/crm/OfflineAlertSettingsPanel`<br>`@/components/crm/ReportSheetPanel`<br>`@/components/crm/SheetSyncHealthPanel`<br>`@/components/crm/BackendHealthPanel`<br>`@/components/crm/AppwriteConnectionTest`<br>`@/components/crm/FinosAccessLogPanel`<br>`@/components/crm/WebsiteKnowledgePanel`<br>`@/components/crm/DriveKnowledgePanel`<br>`@/components/crm/VersionDataPanel`<br>`@/components/crm/ShiftSummaryPanel`<br>`@/components/crm/StaffAccountsTable`<br>`@/components/crm/RoleGate`<br>`@/components/crm/SnapshotSkeleton`<br>`@/components/crm/AppShell`<br>`@/components/crm/CommandAgentPanel`<br>`@/components/crm/InstructionCopilot`<br>`@/components/crm/SafeWorkflowGuide`<br>`@/components/crm/CopilotDrawer`<br>`@/components/crm/SystemCustomizer`<br>`@/components/crm/SystemNoticeBar`<br>`@/components/crm/NoticeBoardPanel`<br>`@/components/crm/SystemUpdateReport`<br>`@/components/crm/CallOpsPanel`<br>`@/components/crm/SyncedCallsPanel`<br>`@/components/crm/DayCallExportPanel`<br>`@/components/crm/RecordingPipelinePanel`<br>`@/components/crm/RecordingReadinessPanel`<br>`@/components/crm/CallLogMatchSummaryPanel`|RoleGate|
|`/tech`|`src/routes/tech.tsx`|System Architect Control Center — Winstone Pulse|`@/lib/maintenance.functions`|No direct signal; inspect delegated backend|
|`/terms`|`src/routes/terms.tsx`|Terms of Service — Winstone Pulse|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/tickets`|`src/routes/tickets.tsx`|Support Tickets — Winstone Support Desk|`@/lib/support-staff.functions`<br>`@/components/crm/AppShell`|No direct signal; inspect delegated backend|
|`/unit-board`|`src/routes/unit-board.tsx`|Unit Inventory & Booking — Winstone Pulse|`@/lib/unit-inventory.functions`<br>`@/components/crm/AppShell`<br>`@/components/crm/LangToggle`<br>`@/components/crm/UnitBackupPanel`<br>`@/components/crm/InventorySheetPanel`|No direct signal; inspect delegated backend|
|`/versions`|`src/routes/versions.tsx`|Utility/identity/redirect endpoint|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/voice-transcription`|`src/routes/voice-transcription.tsx`|Voice Transcription — Winstone Pulse|Inspect local handler/imported helpers|No direct signal; inspect delegated backend|
|`/walkthrough`|`src/routes/walkthrough.tsx`|CRM Walkthrough — Winstone Pulse|`@/components/crm/CrmWalkthrough`|No direct signal; inspect delegated backend|

## Appendix B — Complete live application table inventory

All table names are metadata, not customer data. Index/constraint/trigger totals from catalogs, not estimated row counts. All RLS=true; forceRLS=false (server owners/service role intentionally bypass).

|Table|Policies|Indexes|Constraints|Triggers|
|---|---:|---:|---:|---:|
|`agent_accountability_reviews`|0|3|4|2|
|`agent_briefing_acknowledgements`|0|3|4|2|
|`agent_contribution_reviews`|0|2|3|1|
|`agent_daily_contributions`|0|2|5|1|
|`agent_daily_target_history`|0|2|4|1|
|`agent_demerit_cancellations`|0|2|4|1|
|`agent_devices`|1|5|6|0|
|`agent_lead_drafts`|0|2|2|0|
|`agent_lead_receipts`|0|5|5|1|
|`agent_lead_submission_requests`|0|1|2|1|
|`agent_whatsapp_alerts`|0|4|6|0|
|`agent_whatsapp_optins`|0|2|2|0|
|`ai_summary_cache`|0|2|3|0|
|`ai_usage_events`|1|3|3|0|
|`ai_voice_sessions`|2|3|3|0|
|`ai_voice_turns`|2|2|2|0|
|`app_config`|1|1|1|0|
|`app_releases`|1|2|1|0|
|`architect_auth_attempts`|0|2|1|0|
|`audit_findings`|0|2|2|1|
|`audit_logs`|1|4|2|0|
|`audit_remediation_events`|0|2|4|1|
|`bookings`|0|3|6|6|
|`bulk_extra_batches`|0|2|2|0|
|`call_processing_jobs`|1|3|3|1|
|`call_recordings`|2|9|8|2|
|`call_reports`|2|9|9|9|
|`consent_records`|2|2|3|0|
|`credential_incidents`|0|1|1|1|
|`crm_activities`|3|3|5|1|
|`crm_backup_runs`|0|2|2|0|
|`crm_backup_secret`|0|1|2|0|
|`crm_usage_events`|0|3|10|2|
|`custom_reports`|1|1|1|0|
|`db_performance_snapshots`|0|2|1|0|
|`device_call_tests`|0|2|1|0|
|`distribution_forecast_snapshots`|0|2|1|1|
|`distribution_preview_views`|0|2|1|1|
|`do_not_contact`|2|2|2|0|
|`doc_pages`|4|3|3|1|
|`drive_agent_folders`|1|3|3|1|
|`drive_documents`|0|4|2|1|
|`drive_recording_imports`|0|3|3|0|
|`email_event_receipts`|0|2|2|0|
|`executive_vip_recovery_reviews`|0|3|6|1|
|`follow_up_changes`|0|3|1|1|
|`follow_up_events`|3|6|6|6|
|`hq_whatsapp_report_sends`|0|4|4|0|
|`inventory_requirements`|0|2|3|0|
|`it_notice_recipients`|0|3|4|1|
|`it_notice_replies`|0|2|4|0|
|`it_notices`|0|3|7|1|
|`it_officer_onboarding`|0|3|5|1|
|`knowledge_versions`|0|2|2|1|
|`lead_assignments`|1|3|5|0|
|`lead_bant_scores`|0|1|1|1|
|`lead_classifications`|2|3|7|0|
|`lead_consent_events`|0|1|1|1|
|`lead_daily_assignment_ledger`|0|1|1|0|
|`lead_distribution_runs`|1|1|2|1|
|`lead_events`|1|5|3|1|
|`lead_extra_grants`|1|3|3|1|
|`lead_neglect_notices`|0|3|5|1|
|`lead_neglect_recalls`|0|4|4|1|
|`lead_personal_notes`|0|2|4|1|
|`lead_phone_keys`|0|3|3|0|
|`lead_phone_legacy_aliases`|0|1|2|0|
|`lead_state_changes`|0|3|1|1|
|`lead_year_archives`|1|2|3|0|
|`leads`|3|14|8|12|
|`maintenance_audit`|0|3|1|1|
|`maintenance_unlock_requests`|0|2|1|1|
|`market_facts`|0|1|3|1|
|`market_news`|0|3|6|1|
|`market_news_audit`|0|1|2|1|
|`market_news_runs`|0|1|1|0|
|`meeting_approval_events`|0|2|3|1|
|`meeting_approval_items`|0|3|6|4|
|`meeting_approval_requests`|0|2|3|2|
|`messenger_messages`|0|2|4|1|
|`messenger_outbox`|0|2|2|0|
|`messenger_sync_decisions`|0|1|2|1|
|`messenger_thread_events`|0|1|2|1|
|`messenger_threads`|0|2|3|0|
|`messenger_webhook_receipts`|0|2|1|1|
|`meta_page_connections`|0|2|3|0|
|`meta_verification_records`|0|1|3|1|
|`n8n_event_receipts`|0|2|2|1|
|`objection_answers`|0|2|2|0|
|`os_event_receipts`|0|2|1|0|
|`payment_vouchers`|0|3|3|0|
|`phone_outcome_receipts`|0|2|3|0|
|`phone_test_reports`|0|3|2|0|
|`pin_auth_attempt_state`|1|1|3|0|
|`pin_rotations`|0|2|2|0|
|`pin_vault`|0|1|1|0|
|`pitch_events`|0|5|6|1|
|`pitch_templates`|0|1|2|1|
|`privileged_account_allowlist`|0|1|3|0|
|`profiles`|3|5|1|5|
|`project_catalog`|0|2|3|2|
|`project_discussion_notes`|0|2|4|1|
|`project_sales_updates`|0|2|4|1|
|`project_units`|0|2|4|1|
|`push_deliveries`|1|2|2|0|
|`push_tokens`|1|3|4|1|
|`record_audit_log`|0|3|1|1|
|`recorder_insights`|0|3|4|0|
|`recording_doc_backups`|1|3|3|1|
|`recording_drive_backups`|1|4|4|1|
|`runtime_error_issues`|0|3|3|0|
|`runtime_error_occurrences`|0|2|3|0|
|`sales_drafts`|0|2|2|0|
|`score_formula_versions`|0|2|3|1|
|`security_findings`|0|2|6|0|
|`security_scan_reports`|0|1|4|0|
|`self_lead_attribution`|0|2|5|1|
|`service_bill_review_attempts`|0|2|2|1|
|`service_invoices`|1|2|2|2|
|`sheet_change_proposals`|0|2|4|0|
|`sheet_lead_intake_receipts`|0|1|2|0|
|`sheet_lead_intake_runs`|0|3|2|0|
|`sheet_sync_events`|1|3|1|0|
|`shift_summaries`|1|3|1|0|
|`site_visits`|0|3|6|5|
|`social_activity_logs`|1|2|6|1|
|`social_pages`|1|1|2|0|
|`social_reply_templates`|1|1|1|0|
|`subscriptions`|2|6|2|0|
|`support_article_categories`|1|2|2|0|
|`support_articles`|1|4|5|0|
|`support_canned_replies`|0|2|2|0|
|`support_conversations`|1|5|7|0|
|`support_csat`|0|2|3|0|
|`support_customers`|0|2|1|0|
|`support_messages`|1|2|4|0|
|`support_notes`|0|4|5|0|
|`support_settings`|0|1|1|0|
|`support_ticket_events`|0|2|4|0|
|`support_tickets`|1|4|9|0|
|`sync_events`|1|3|3|0|
|`system_alerts`|2|3|2|0|
|`system_maintenance`|0|2|2|4|
|`system_settings`|1|1|1|0|
|`team_support_admins`|1|1|2|0|
|`team_support_replies`|1|2|3|0|
|`team_support_tickets`|1|4|4|1|
|`unit_inventory_backups`|0|1|1|1|
|`user_roles`|1|2|3|0|
|`version_data_ledger`|1|5|3|0|
|`webhook_deliveries`|1|4|1|0|
|`website_enquiries`|0|3|3|0|
|`website_pages`|0|3|2|1|
|`website_visit_requests`|0|3|4|2|
|`whatsapp_interactions`|2|4|3|0|
|`whatsapp_webhook_events`|0|3|2|0|
|`workspace_role_grants`|1|1|2|0|

## Appendix C — Scan metadata as retrieved

|Scanner|Timestamp UTC|Completion|Up-to-date|Findings|
|---|---|---|---|---:|
|agent_security_v2|2026-11-14T15:20:49.823987541Z|complete|False|2|
|aikido_pentest|2026-10-18T20:54:51.816042539Z|complete|False|0|
|app_mcp|2026-11-14T15:20:49.823987541Z|complete|False|0|
|app_mcp_deep|2026-11-14T15:20:49.823987541Z|complete|False|0|
|lov_pgscan|2026-11-14T14:30:45.467661634Z|complete|False|0|
|supply_chain|2026-11-14T09:20:54.192176696Z|complete|False|0|

## Appendix D — Active schedules (safe metadata only)

All observed active. Cron expressions are interpreted UTC; holiday/business gating is inside handlers, not implied by `*` schedules.

|ID|Name|UTC cron|Known modern target/body|
|---:|---|---|---|
|3|shift-summary-1250|50 6 * * *|legacy safe target not returned|
|4|shift-summary-1730|30 11 * * *|legacy safe target not returned|
|5|drive-backup-nightly|50 17 * * *|legacy safe target not returned|
|6|call-analysis-sweep|*/15 * * * *|legacy safe target not returned|
|7|daily-lead-handout|10 3 * * *|legacy safe target not returned|
|8|service-bill-check|0 4 * * *|legacy safe target not returned|
|9|reminder-sweep|*/15 * * * *|legacy safe target not returned|
|10|market-news|15 */3 * * *|legacy safe target not returned|
|11|monthly-summary|30 0 1 * *|legacy safe target not returned|
|12|lead-neglect|55 2 * * *|legacy safe target not returned|
|13|deploy-health|*/15 * * * *|legacy safe target not returned|
|14|crm-nightly-backup|30 17 * * *|legacy safe target not returned|
|15|daily-sheet-sync|30 12 * * *|legacy safe target not returned|
|16|messenger-retention-cleanup|30 21 * * *|/api/public/jobs/messenger-retention; daily|
|17|lead-report-after-shift|30 11 * * *|/api/public/jobs/lead-report-sheet; daily|
|19|firebase-grpc-watch|0 3 * * *|/api/public/jobs/firebase-grpc-watch; daily|
|20|agent-whatsapp-new-leads|*/30 3-11 * * *|/api/public/jobs/agent-whatsapp-alerts; new_leads|
|21|agent-whatsapp-daily-progress|40 11 * * *|/api/public/jobs/agent-whatsapp-alerts; daily_progress|
|22|hq-daily-whatsapp-report|40 11 * * *|/api/public/jobs/agent-whatsapp-alerts; hq_daily_report|

## Appendix E — Public release sampling

|Path|HTTP|Seconds (single request)|Title|
|---|---:|---:|---|
|/manual|200|1.85|System Manual &amp; Client Handover — Winstone Pulse|
|/hq|200|1.65|Executive HQ — Winstone Pulse|
|/system|200|2.7|System &amp; Billing — Winstone Pulse|
|/leadhub|200|1.58|LeadHub Nexus — Winstone Pulse|
|/desk|200|0.22|My Desk — Winstone Pulse|
|/score-versions|200|1.45|Dated score versions — Winstone Pulse|
|/security|200|0.2|PIN ও অ্যাক্সেস — Winstone Pulse|
|/release-status|200|2.68|Implementation &amp; Release Status — Winstone Pulse|

**End of audit. No production action or application change was performed.**
