# Lead form tracking + forecast accuracy report

## 1. Lead form tracking
Three events are added to the existing personal lead form in `src/components/crm/NewLeadDialog.tsx`. Each one fires only when its action succeeds.

| Event | When it fires | Details sent |
|---|---|---|
| `project.lead_form_started` | The agent types the first character into a fresh form, once per form | `resumed_draft` (yes/no) |
| `project.lead_draft_saved` | The draft is saved successfully | `revision` (number) |
| `project.lead_submitted` | The server accepts the lead and returns a receipt | `from_draft` (yes/no), `another` (yes/no) |

- A refused duplicate does not count as a submission.
- No names, phone numbers or other customer details are sent.
- All three events are registered in `.lovable/events.json` and checked with schema_check.
- Saving is still switched off until the lead-entry setup is approved. Until then, only "started" events will appear.

## 2. Forecast vs received report
This adds a date-range report to LeadHub, behind the existing PIN.
- It uses the saved forecasts in `distribution_forecast_snapshots`. For each day, only the latest forecast saved before that day began counts, and actual hand-outs come from `lead_assignments` (same rule as Hand-out results).
- **Columns, per agent:** forecast total, received total, difference, and accuracy. Accuracy = 1 − |difference| ÷ forecast, shown as a percentage.
- **Daily trend:** a line for overall accuracy, with each agent's best and worst days highlighted.
- Days with no saved forecast are listed as "no forecast" and left out of accuracy, never counted as zero.
- The range can be up to 62 days, with a CSV export and a totals row.
- It is read-only and shows no customer details.

Files:
- `src/lib/handout-results.ts`: new pure `forecastAccuracy()` with tests in `tests/handout-results.test.ts`
- `src/lib/lead-pool.functions.ts`: new `readForecastAccuracy`
- New `src/components/crm/ForecastAccuracy.tsx`, mounted in `src/routes/leadhub.tsx` after Hand-out history

## 3. Dual-lead SQL draft (your "হ্যাঁ")
The separate setup for company and self-collected leads already exists as a prepared, not-yet-applied file (`docs/agent-lead-collection.sql`). I will not write a second, competing version.

The proposed score formula (2C + 2R + A + 4V + 1.5F) and the scheduled-task limit belong to another tool. They are not part of this change.

## Not included
- No publish, and no live database writes. The report only reads saved data.
