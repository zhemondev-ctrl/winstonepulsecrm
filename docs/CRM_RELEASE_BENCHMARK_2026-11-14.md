# CRM live verification and bounded benchmark

14 November 2026, approximately 16:04–16:10 UTC. No customer test records, migrations or score rewrites.

## Publication and usage

Publication requested for the database optimization after the user explicitly chose to proceed despite five critical news-permission findings. Expected domain: https://crm.winstonebd.com. Live `/manual` returned 200 and passed version 1.7.0, $35.29 and 50-lead checks. These markers do not identify the exact deployed commit.

Second usage lookup at 16:08:54 UTC still returned database requested credits 0.739028462 (compute 0.736990800, storage 0.002037662), 1.19 instance-hours and 2.38 GB-hours. Latest database recording remained 15:45:20 UTC, before optimization. No comparable post-deployment period or cost reduction is established. No instance resize or pause.

## Login and PIN

A real IT PIN was submitted through the live `/system` dialog. The dialog closed in **870 ms**, Authority unlocked appeared and System & Billing content loaded; zero browser runtime errors. PIN values were read from environment, not logged or saved.

Restoring the supplied staff session on the live origin did not unlock `/desk`; its sign-in gate remained visible. This is not a successful password login. No passwords were available and no customer/account records were created to bypass the gate. Staff password login remains unverified.

## Benchmark scope and results

**Not a representative peak-load benchmark.** No isolated staging backend was configured. Project staging rules refuse the shared live backend; production concurrency/stress and synthetic customer writes were not generated. Instead, three sequential real IT-authenticated page reloads were observed as a bounded single-user smoke benchmark.

- 62 completed internal server-function requests recorded during reload windows.
- Median end-to-end request latency **342.9 ms**.
- Nearest-rank p95 **1,457.5 ms**; maximum **1,839.8 ms**.
- All recorded requests HTTP 200; zero page runtime errors.
- These timings include network, authorization, application and database work. They are not SQL-only latency, per-successful-task latency or peak capacity measurements. Periodic calls and overlapping work may appear in the sample.

Database health snapshots: connections **27/160 before**, **28/160 after**; pool clients **1/800 before**, **5/800 after**; memory **10%→11%**, disk **4%**, database **125.4 MB**, zero restarts and no returned exhaustion alerts. Snapshots are not a sampled peak or sustained headroom proof. Rolled-back transactions increased 20,756→20,777; causes are not established and cannot be attributed to this benchmark.

## Remaining database candidates

Cumulative SQL metrics before the smoke benchmark:

| Query family | Calls | Mean ms | Max ms |
| --- | ---: | ---: | ---: |
| Canonical lead eligibility | 1,874 | 622.52 | 2,011.39 |
| Canonical phone status | 235 | 871.67 | 2,522.73 |
| Agent lead-event history | 26,784 | 8.78 | 443.43 |
| Full ordered lead reads | 1,764 | 42.86 | 183.20 |
| Ownership-union lead reads | 4,098 | 17.18 | 133.66 |

Statistics reset window unknown; historical SQL duration is elapsed time, not CPU, and cannot establish current peaks. Eligibility/phone checks deserve fresh query plans and timed representative input, while preserving indexed canonical checks. Repeated full event/history reads and remaining overlapping subscriptions deserve request attribution. See DATABASE_OPTIMIZATION_2026-11-14.md for index and schedule evidence. No speculative database changes performed.

## Security and Android

Basic checks clean; fresh deep scan requested for last saved code, asynchronous completion pending. Latest completed result was marked outdated and reported five critical HQ news-permission findings and two warnings. The earlier call-score finding was absent, but absence without a scan-supplied revision does not verify it. Rechecked claim-only guards and ran **17 tests**, all passed. No demonstrated remaining call-score path was found in this check; no unrelated security fixes or finding-state changes were made.

Security history remains curated source observations, not an automatic scan importer. Accessible connections do not include Lovable API; no automatic update can be confirmed.

Official Android workflow exists at `.github/workflows/android-release.yml`: main only, protected `android-release` environment, expected **2.22 / 33**, approved certificate checked before build. No accessible GitHub workflow connection, repository mapping or signing runner was available; workflow was not dispatched and no APK produced. Key custodian can use **Actions → Android official release → Run workflow** on main, entering 2.22 and 33. Handset sync remains unverified; synchronized device claims must not earn verified V without independent evidence.

## Remaining requirements

- Isolated staging backend and a representative roster/workload for actual peak concurrency and SQL percentile measurement.
- Usable authorized staff login to complete password sign-in and own-workspace read.
- Post-publication usage ingestion and equal traffic/duration comparison for costs.
- Deep-scan completion with explicit revision evidence and Lovable API integration for automatic history.
- Authorized official Android runner/repository access and real-device acceptance.