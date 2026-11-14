# Database performance and running-credit review

Date: 14 November 2026, measurements approximately 15:54–15:58 UTC (21:54–21:58 Dhaka).
Method: **database-optimization** skill; authorized project usage, read-only database diagnostics, source inspection, isolated regression tests and local browser observation.

## Financial baseline

Recording window: **1 November 2026 00:00 UTC through 14 November 2026 15:54:08 UTC**, current day partial. Returned usage was not truncated. Recording dates may lag activity; this is not proof of complete runtime activity attribution or cash paid.

| Item | Returned quantity | Requested credits |
| --- | --- | --- |
| Large database compute | 1.19 instance-hours | 0.736990800 |
| Database storage | 2.38 GB-hours | 0.002037662 |
| Database total | Different units; not additive | **0.739028462** |
| Build mode | Unknown quantity | 75.401000000 |
| Plan mode | Unknown quantity | 4.000000000 |
| All returned categories | — | 80.140028462 |

Database optimization does not reduce development-message credits. No AI, network or other runtime amounts were returned; absence does not prove zero activity. The financial lookup did not provide environment attribution, resource inventory or measured pause behavior.

Current quotes before allowances: large **0.619320 credits/instance-hour**, medium **0.330368**, small **0.167700**; database storage **0.000856160 credits/GB-hour**. These current quotes do not reprice historical usage. Query improvements alone do not lower the compute hourly rate. No realized credit savings are claimed.

## Database health

Initial: database/pool up; zero restarts; memory 10%; disk 4%; connections 23/160; pool clients 1/800; database 125.4 MB; write-ahead log 128 MB; no returned recent resource-exhaustion alerts. Follow-up: same memory/disk/size, connections 27/160. Rolled-back transactions rose from 20,748 to 20,755; cumulative counters do not explain causes and are not a rate.

No evidence supports increasing compute or disk. A smaller instance is a **candidate**, not an established safe change: first measure representative signed-in daytime traffic, query latency and memory headroom over a useful interval. Instance size and pause behavior were not changed. Use Lovable Cloud Advanced settings to review sizing after that measurement.

## Measured query and index evidence

`extensions.pg_stat_statements` was read, ordered by total execution time. Counters are cumulative; their reset window was not established, so they are not a current-period billing breakdown.

| Query family | Calls | Mean milliseconds | Total milliseconds |
| --- | ---: | ---: | ---: |
| Realtime change extraction | 264,957 | 11.46 | 3,035,198.60 |
| Managed cron HTTP dispatch including `pg_sleep` | 108 | 23,164.38 | 2,501,753.07 |
| `filter_eligible_lead_ids` | 1,874 | 622.52 | 1,166,598.76 |
| Agent lead-event history | 26,784 | 8.78 | 235,090.12 |
| `lead_phone_status` | 235 | 871.67 | 204,843.00 |
| Pending-lead reads | 7,830 | 13.21 | 103,436.26 |
| Floor lead-event history | 5,757 | 13.49 | 77,664.40 |
| Full ordered lead reads | 1,764 | 42.86 | 75,599.39 |

Cron elapsed time includes deliberate waiting: do not mistake it for CPU consumption. Realtime is managed infrastructure; no managed schema changes were made.

Existing indexes already cover lead-event agent/date/id and global date/id ordering; lead/date lookups; call-report lead lookups; canonical phone keys and legacy aliases. Some overlapping indexes exist (for example two lead-ID indexes on phone keys); none was dropped without a query-plan/write-cost review.

Live function definitions confirm eligibility matches only target lead phones, then indexed canonical phone candidates; `lead_phone_was_ever_worked` unions keys and legacy aliases before checking work history. The slow historical aggregates alone do not establish these current definitions are still the bottleneck. Do not replace canonical eligibility or weaken work-history checks.

Table statistics indicate substantial cumulative scans on system alerts (89,620 scans, approximately 240.9 million tuples read), leads (5,727 scans, approximately 36.2 million tuples), and follow-ups (15,291 scans, approximately 35.3 million tuples). Statistics estimates are not exact row counts. Largest returned table storage: record audit about 25.1 MB, lead events 16.1 MB, cron run details 10.4 MB, leads 10.0 MB, audit logs 8.9 MB. These are modest relative to capacity; append-only history remains intact.

**Query-plan blocker:** no managed direct SQL connection is present, and the read-query tool supports SELECT statements only. EXPLAIN/ANALYZE plans were not collected. No speculative index migration or maintenance operation was executed. Analyze timestamps were not successfully returned by the diagnostic query, so their freshness is unknown.

## Scheduled work

Safe schedule metadata returned 20 active jobs. Three run every 15 minutes (call analysis, reminders, deploy health): **96 runs/day each**, 288 combined. Agent new-lead alerts run twice hourly during 03:00–11:59 UTC: 18 runs/day. Market news runs every three hours: 8/day. Remaining jobs include daily shift/report/backup/distribution/billing/retention checks and a monthly summary.

Recurring jobs can keep compute active even without useful work. Analysis and reminders require inspecting actual pending work and delayed retries before replacing periodic checks with wake-on-enqueue/drain-based processing. Health monitoring cadence is an explicit freshness trade-off. Legacy schedule metadata does not expose authenticated target details or execution history here. No job was disabled, rescheduled or duplicated, and no secrets/commands were returned or logged.

## Implemented safe improvements

1. **No database subscriptions for visitors:** both snapshot and shared shell realtime hooks now wait for resolved account scope; subscriptions and queued timers are removed when access is lost. This is a client resource gate only; server authorization remains authoritative.
2. **Shell burst reloads no longer bypass existing policy:** shell events coalesce snapshot refresh over the existing eight-second window, mark hidden tabs stale without actively refetching, and do not cancel an in-flight refresh. IT notice invalidation stays immediate. Snapshot's existing coalescer and polling/focus behavior are preserved.
3. **Full lead reads use shared bounded paging:** removed preliminary exact-count and unbounded all-pages `Promise.all`; reuse `pageAllParallel`, keeping stable updated-at/id ordering, ID deduplication, first-page-only short reads and fail-closed errors/limits. Delta refresh total checks remain unchanged. No cached eligibility or assignment decisions were introduced.

Paging can speculatively read up to three subsequent pages, so fewer requests are not guaranteed for every dataset size. The established improvements are removal of the preliminary count, bounded page concurrency and one-read small datasets, not a universal latency claim. Aggregate concurrency across other snapshot datasets still deserves measurement.

## Verification

- **26 tests passed** across six files: `crm-realtime-hook`, `crm-live-refresh`, `page-all`, `crm-agent-leads`, `desk-snapshot-scope`, `delta-merge`.
- Browser reproduced signed-out HQ opening realtime before the changes. Frame-topic inspection identified the shell `crm-live-*` subscription. After both gates were implemented, the same signed-out route generated **zero database subscription joins** during the six-second check; the page and its access gate rendered normally.
- Hook tests verify authorized burst handling and teardown using fixtures, not production customers.
- Preview build log: **build OK** at 15:58:04 UTC.
- Successful signed-in full snapshot under representative load was not exercised. No phone calls, reports, leads, scores, financial data or history were changed. No schema migration, backup/restore, index deletion, instance resizing, schedule change or publication was performed.

## Completed security scan notification

Result timestamp **15:56:27 UTC**, completed but marked **not up to date**. Five Critical findings concern view-only HQ PIN mutations of news collection/editing/publishing/visibility/auto-publication. Two Warnings concern arbitrary WhatsApp recipients and attaching interest to another agent's lead. These unrelated findings were not changed or marked resolved. The absence of the earlier call-evidence finding does not by itself establish revision-matched verification; no scan-supplied code revision was returned here.

## Remaining gates

- Publish only after an explicit request and review of current security findings; app optimizations currently affect preview only.
- Capture comparable signed-in query/request latency and subscription counts before/after publication, without customer writes.
- Obtain query plans and a representative metric window before index/function changes; preserve canonical ownership, quotas, evidence checks and verified-backup requirements.
- Review pending-work queues and schedule execution history before changing recurring freshness guarantees.
- Review smaller compute only after sustained peak-load headroom is established; compare recorded instance-hours after billing data catches up in Settings → Plans & credits → Usage details. No monetary savings promise.