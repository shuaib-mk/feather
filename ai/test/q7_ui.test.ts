/** Q7 UI pins: scanner count button, diagnostics build row, day-panel copy. */
import fs from "node:fs";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
{
  const s = fs.readFileSync("client/src/pages/DiaryScannerPage.tsx", "utf8");
  check("Q7.2: button shows checked count", s.indexOf("Import {checkedCount}") !== -1, "label");
  check("Q7.2: button disabled at zero with hint", s.indexOf("disabled={checkedCount === 0}") !== -1 && s.indexOf("Select at least one row") !== -1, "disabled+hint");
  check("Q7.2: checked means not explicitly unchecked", s.indexOf("selectedRows[i] !== false") !== -1, "predicate");
  const d = fs.readFileSync("client/src/pages/SettingsPage.tsx", "utf8");
  const headAt = d.indexOf(">Diagnostics</h3>");
  const buildAt = d.indexOf("Build: {buildId");
  const cal = fs.readFileSync("client/src/pages/CalendarPage.tsx", "utf8");
  check("Q7.8: span day without log says No daily log", cal.indexOf("sel.bleeding ? \"No daily log for this day.\"") !== -1, "day copy");
  check("Q7.4: Build row renders inside Diagnostics", headAt !== -1 && buildAt > headAt && d.slice(headAt, buildAt).indexOf("return") === -1, "build row");
}
console.log("Q7 UI Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
