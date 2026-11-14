# Database performance and Run-credit optimization

Method: **database-optimization**. Measurements: 14 November 2026 23:33–23:36 UTC / 15 November 05:33–05:36 Dhaka. Read-only live diagnostics; isolated code tests, no customer writes.

## Current recorded usage

Recording window: 1 November 00:00 UTC through 14 November 23:33:47 UTC, including a partial current UTC date. Returned usage is not truncated; ingestion can lag activity. Amounts below are **requested credits**, not deductions or cash paid.

| Resource | Recorded quantity | Requested credits |
|---|---:|---:|
| XL compute | 2.85 instance-hours | 3.530466000 |
| Large compute | 4.35 instance-hours | 2.694042001 |
| Database storage | 20.1 GB-hours | 0.017208818 |
| Database total | Units not additive | **6.241716819** |
| Network | 0.234308079 GB | 0.105438639 |
| Build/Plan, separate from running | Unknown quantity | 205.601000000 |

Compute dominates database requested credits. Current quotes: XL 1.238760 credits/hour; large 0.619320; medium 0.330368; storage 0.000856160 credits/GB-hour. They do not reprice past usage. Faster SQL alone cannot lower hourly compute prices. Earlier 0.739028462-credit evidence covered a shorter recording interval; it is not a comparable before/after saving.

## Health and capacity

Two snapshots: database/pool up, zero restarts, memory 5%, disk 4%, connections 17/240, pool clients 2/1000, database 125.7 MB, WAL 128 MB, rollback counter unchanged at 852; no returned exhaustion alerts. These are quiet snapshots, not sustained peak headroom. Compute usage records include XL and large; current instance configuration and resize history were not independently established. No resize is recommended until sustained CPU, memory, concurrency and peak-latency history is collected. No manual pause: it would interrupt auth and staff work.

## Query evidence and indexes

Statistics reset: **14 November 18:33:04.655917 UTC**. Sample at 23:33 UTC covers about five hours since reset, not the financial window. Total elapsed SQL time is not measured CPU use.

| Query family | Calls | Mean ms | Total ms |
|---|---:|---:|---:|
| Global date-filtered lead events | 945 | 7.17 | 6777.37 |
| Full ordered leads | 218 | 17.73 | 3866.19 |
| Submitted reports ordered by creation | 56 | 17.95 | 1005.28 |
| Full ordered recordings | 61 | 13.15 | 802.23 |

Bounded EXPLAIN ANALYZE probes, first 1000 rows, database-side only (no private rows returned):

- 31-day events: uses existing `lead_events_created_at_id_idx`, 0.866ms execution, 726 buffer hits, zero disk reads.
- Ordered leads: uses existing `leads_updated_at_id_idx`, 1.202ms, 1004 hits, zero disk reads.
- Submitted reports: scans 6769 rows and top-N sorts by created_at/id, 5.548ms, 414 hits, zero disk reads.

These privileged warm-cache probes exclude browser latency, serialization and staff RLS overhead; they are not an authenticated E2E benchmark. Existing global/agent event indexes, lead ownership/update indexes, recording date/id index and canonical phone indexes were inspected. Adding another lead/event index would duplicate existing coverage. A submitted-report `(status, created_at, id)` index is only a candidate: its modest current elapsed time does not justify an unrequested production migration; compare equivalent later-page plans, write overhead and peak load first.

Table statistics have implausibly low live-tuple estimates after reset, so they are **not customer counts**. Largest table is record_audit_log at 25.2MB, followed by lead_events 16.2MB and leads 10.1MB. No storage cleanup, history deletion or index removal is justified.

## Implemented safe fix

`AppShell` mounts `useCrmRealtime`, while dashboard panels mount `useSnapshot`. Both listeners independently scheduled an eight-second `crm-snapshot` invalidation for overlapping lead/call/message changes. When callbacks arrive at different times while a read is unresolved, the second timer can invalidate again after the first settles.

`acquireCrmRefresh` in `crm-live-refresh.ts` now shares one pending timer per QueryClient across both listener paths. Subscriber teardown is reference-counted; only the final release cancels the timer. Hidden tabs still mark data stale without refetching, access gating and the eight-second window stay unchanged, and immediate report/follow-up/IT-notice invalidations remain unchanged. No cached assignment or eligibility decisions were introduced. Existing subscriptions remain separate because they also serve different queries.

Reproduction using two listener handles 20ms apart and an unresolved invalidation: two independent timer paths would call invalidation twice; the shared scheduler calls it **once**. This is a deterministic isolated reduction per overlapping burst, not measured live database credits or total traffic savings. Existing full-floor/31-day event reads are still needed by current dashboards; no rows or freshness guarantees were removed.

## Scheduled work

19 active schedules returned. Analysis, reminders and deploy health each run every 15 minutes: 96 potential starts/day each, 288 combined. Metadata does not expose legacy target paths or execution history. `analysis-queue.server.ts` reads at most three pending/failed/expired-lease recordings, caps attempts at five and atomically claims work. `reminders.server.ts` reads current ownership and due work, then deduplicates pushes. Deploy health checks stored authorization before its live check. No handler was invoked because these paths can write or send notifications.

An enqueue-driven analysis queue with expiry recovery is a future candidate only after useful-work/execution history is measured. Reminders are time-driven and must retain delivery windows. Disabling or changing schedules without evidence risks missed reminders, recovery or monitoring; no schedules were altered.

## Verification and remaining gates

- 25 tests passed in six files: shared scheduler, shell hook, eligibility, paging, Desk scope and delta merge.
- Preview build log: **build OK**, 23:35:43 UTC.
- No production schema/data/settings changes, resize, pause, publication, external messages or AI calls.
- Real signed-in event-to-dashboard flow is not verified: live staff access remains maintenance-gated, and no live test changes were made. Tests use mocked callbacks, no customer records.
- Collect sustained peak capacity before choosing a smaller instance; collect equivalent successful dashboard loads/subscription events after explicit publication, then compare equal-duration ingested resource records. Realized credit savings remain unknown.

Priority: (1) shared refresh fix now prepared; (2) sustained capacity review for the dominant compute meter; (3) review submitted-report later-page plans and actual schedule useful-work counts before schema/cadence proposals. Preserve all ownership, quota, evidence and immutable-history rules.