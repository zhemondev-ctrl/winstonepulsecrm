/**
 * Formats coverage/coverage-summary.json as a markdown table.
 * Used by .github/workflows/web-ci.yml for the job summary and the PR comment.
 * Exits 0 with a fallback message when no report exists (e.g. tests failed
 * before coverage was written), so summary steps never break the workflow.
 */
import { readFileSync } from "node:fs";

const MARKER = "<!-- web-ci-coverage -->";

function render(): string {
  let total: Record<string, { total: number; covered: number; pct: number }>;
  try {
    total = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8")).total;
  } catch {
    return `${MARKER}\n## Test coverage\n\nNo coverage report was produced — the test run may have failed before coverage was written.\n`;
  }
  const rows: Array<[string, keyof typeof total]> = [
    ["Lines", "lines"],
    ["Statements", "statements"],
    ["Functions", "functions"],
    ["Branches", "branches"],
  ];
  let out = `${MARKER}\n## Test coverage\n\n| Metric | Covered | Total | % |\n| --- | ---: | ---: | ---: |\n`;
  for (const [label, key] of rows) {
    const m = total[key];
    out += `| ${label} | ${m.covered.toLocaleString("en-US")} | ${m.total.toLocaleString("en-US")} | ${m.pct}% |\n`;
  }
  return out;
}

process.stdout.write(render());
