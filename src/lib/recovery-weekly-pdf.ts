/**
 * Weekly Recovery review PDF — built in the browser from data HQ already loaded.
 * Read-only: aggregates come from closure-recovery-charts.ts, so the PDF and the
 * charts always agree. Nothing is saved or sent.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { byAgent, byDate, byKind, type ClosureCell } from "./closure-recovery-charts";
import type { ClosureKind } from "./closure-attempts";

export type WeeklyRow = { closedAt: string; name: string; agentName: string; kind: ClosureKind; day: string };

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** The 7 Dhaka days ending on `to`, clipped to the loaded range start. */
export function weekWindow(loadedFrom: string, to: string) {
  const from = addDays(to, -6);
  return { from: from < loadedFrom ? loadedFrom : from, to };
}

/** Standard PDF fonts only cover Latin text; anything else becomes "?" so the file never fails. */
export const pdfSafe = (s: string) => s.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?").replace(/\?{2,}/g, "?");

const KIND_LABEL: Record<ClosureKind, string> = { unreachable: "Closed as unreachable (needs 3 recorded attempts)", conversation: "Closed after claimed conversation (needs 1 phone-proven talk)" };
const pct = (r: number | null) => (r === null ? "-" : `${r}%`);

export async function buildWeeklyRecoveryPdf(input: {
  cells: ClosureCell[];
  rows: WeeklyRow[];
  agentNames: Record<string, string>;
  from: string;
  to: string;
  generatedAt: Date;
}): Promise<Uint8Array> {
  const { from, to } = input;
  const cells = input.cells.filter((c) => c.day >= from && c.day <= to);
  const rows = input.rows.filter((r) => r.day >= from && r.day <= to);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.12, 0.14), muted = rgb(0.42, 0.42, 0.45), line = rgb(0.85, 0.84, 0.8), accent = rgb(0.07, 0.13, 0.23), warn = rgb(0.72, 0.2, 0.15);
  let page: PDFPage = doc.addPage([595, 842]);
  let y = 800;
  const M = 48;
  const newPage = () => { page = doc.addPage([595, 842]); y = 800; };
  const need = (h: number) => { if (y - h < 56) newPage(); };
  const text = (s: string, x: number, size = 10, f: PDFFont = font, color = ink) => page.drawText(pdfSafe(s), { x, y, size, font: f, color });
  const heading = (s: string) => { need(40); y -= 10; text(s, M, 13, bold, accent); y -= 8; page.drawLine({ start: { x: M, y }, end: { x: 547, y }, thickness: 0.6, color: line }); y -= 16; };
  const table = (cols: { label: string; x: number; right?: boolean }[], data: string[][], warnCol?: number) => {
    need(20);
    cols.forEach((c) => text(c.label, c.right ? c.x - bold.widthOfTextAtSize(c.label, 9) : c.x, 9, bold, muted));
    y -= 14;
    for (const r of data) {
      need(14);
      r.forEach((v, i) => {
        const c = cols[i]; const s = pdfSafe(v);
        const f = i === 0 ? bold : font;
        const w = f.widthOfTextAtSize(s, 9);
        page.drawText(s, { x: c.right ? c.x - w : c.x, y, size: 9, font: f, color: i === warnCol && v !== "0" && v !== "-" ? warn : ink });
      });
      y -= 13;
    }
    y -= 6;
  };

  text("Winstone Pulse - Executive HQ", M, 9, bold, muted); y -= 20;
  text("Weekly Recovery review", M, 20, bold, accent); y -= 18;
  text(`Week ${from} to ${to} (Dhaka)  -  generated ${input.generatedAt.toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}`, M, 9, font, muted); y -= 14;
  text("Read-only. A gap in verified calls is a review signal, not proof of fault. No lead was changed.", M, 9, font, muted); y -= 22;

  const tot = cells.reduce((a, c) => ({ checked: a.checked + c.checked, short: a.short + c.short }), { checked: 0, short: 0 });
  const rate = tot.checked ? Math.round((tot.short / tot.checked) * 1000) / 10 : null;
  const stats: [string, string][] = [["Closures checked", String(tot.checked)], ["In review queue", String(tot.short)], ["Verified", String(tot.checked - tot.short)], ["Missing-call rate", pct(rate)]];
  stats.forEach(([l, v], i) => {
    const x = M + i * 126;
    page.drawRectangle({ x, y: y - 34, width: 118, height: 48, borderColor: line, borderWidth: 0.6 });
    page.drawText(v, { x: x + 10, y: y - 8, size: 16, font: bold, color: i === 1 || i === 3 ? warn : ink });
    page.drawText(l, { x: x + 10, y: y - 26, size: 8, font, color: muted });
  });
  y -= 60;

  heading("Closure-type breakdown");
  table([{ label: "Type", x: M }, { label: "Checked", x: 420, right: true }, { label: "Queued", x: 480, right: true }, { label: "Rate", x: 547, right: true }],
    byKind(cells).map((b) => [KIND_LABEL[b.key as ClosureKind], String(b.checked), String(b.short), pct(b.rate)]), 2);

  heading("Date trend");
  const trend = byDate(cells, from, to).points;
  const maxC = Math.max(1, ...trend.map((p) => p.checked));
  need(trend.length * 16 + 20);
  for (const p of trend) {
    const dow = new Date(`${p.key}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    text(`${dow} ${p.key}`, M, 9);
    const w = 260;
    page.drawRectangle({ x: 150, y: y - 2, width: (p.checked / maxC) * w, height: 9, color: rgb(0.86, 0.84, 0.78) });
    if (p.short) page.drawRectangle({ x: 150, y: y - 2, width: (p.short / maxC) * w, height: 9, color: warn });
    const s = `${p.short}/${p.checked}  ${pct(p.rate)}`;
    text(s, 547 - font.widthOfTextAtSize(s, 9), 9);
    y -= 16;
  }
  text("Bar: grey = checked closures, red = in review queue. Numbers: queued / checked, missing-call rate.", M, 8, font, muted); y -= 18;

  heading("By closing agent");
  const name = (k: string) => {
    const n = k === "none" ? "Unknown agent" : input.agentNames[k] ?? "Unknown agent";
    return /[A-Za-z]/.test(pdfSafe(n)) ? n : `Agent ${k.slice(0, 6)} (non-Latin name)`;
  };
  table([{ label: "Agent", x: M }, { label: "Checked", x: 420, right: true }, { label: "Queued", x: 480, right: true }, { label: "Rate", x: 547, right: true }],
    byAgent(cells).map((b) => [name(b.key), String(b.checked), String(b.short), pct(b.rate)]), 2);

  heading(`Queued closures this week (${rows.length})`);
  const list = [...rows].sort((a, b) => b.closedAt.localeCompare(a.closedAt)).slice(0, 40);
  table([{ label: "Closed (Dhaka)", x: M }, { label: "Lead", x: 150 }, { label: "Agent", x: 330 }, { label: "Type", x: 470 }],
    list.map((r) => [new Date(r.closedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }), r.name.slice(0, 32), r.agentName.slice(0, 24), r.kind === "unreachable" ? "Unreachable" : "Conversation"]));
  if (rows.length > list.length) { text(`+ ${rows.length - list.length} more in the CRM Recovery review tab.`, M, 9, font, muted); y -= 14; }

  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`Page ${i + 1} of ${pages.length}  -  Winstone Pulse Recovery review`, { x: M, y: 28, size: 8, font, color: muted }));
  return doc.save();
}
