/** Pure tally of dry-run preview opens. */
export type UsageRow = { target_day: string; mode: string; weekday: string; blocked: string };
const count = (rows: UsageRow[], key: (r: UsageRow) => string) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m].map(([label, n]) => ({ label, n }));
};
const WEEK = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
export function tallyDryRunUsage(rows: UsageRow[]) {
  return {
    total: rows.length,
    byDate: count(rows, (r) => r.target_day).sort((a, b) => b.label.localeCompare(a.label)),
    byWeekday: count(rows, (r) => r.weekday).sort((a, b) => WEEK.indexOf(a.label) - WEEK.indexOf(b.label)),
    byStatus: count(rows, (r) => r.blocked).sort((a, b) => b.n - a.n),
    byMode: count(rows, (r) => r.mode).sort((a, b) => b.n - a.n),
  };
}

const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV of the displayed tallies: one row per (section, label, count). */
export function dryRunUsageCsv(t: ReturnType<typeof tallyDryRunUsage>, statusLabel: (s: string) => string = (s) => s) {
  const rows: (string | number)[][] = [["section", "label", "previews"]];
  for (const r of t.byDate) rows.push(["date", r.label, r.n]);
  for (const r of t.byWeekday) rows.push(["weekday", r.label, r.n]);
  for (const r of t.byStatus) rows.push(["status", statusLabel(r.label), r.n]);
  rows.push(["total", "all", t.total]);
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
