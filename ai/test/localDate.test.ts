/**
 * Batch 1.1 -- local-date helper tests.
 * Run twice via npm scripts with TZ=Asia/Kolkata and TZ=America/Los_Angeles.
 * The fixed instant 2026-01-01T00:30Z is 06:00 on Jan 1 in Kolkata and
 * 16:30 on Dec 31 in Los Angeles, so the local key MUST differ by TZ.
 */
import {
  todayLocal,
  toLocalKey,
  parseDateKey,
  isValidDateKey,
  addDaysToKey,
  diffDateKeys,
  weekdayOfKey,
  parseMonthDay,
} from "../../client/src/lib/localDate";

let passed = 0;
let failed = 0;
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { console.log(`[PASS] ${name}${detail ? ` (${detail})` : ""}`); passed++; }
  else { console.error(`[FAIL] ${name}${detail ? ` (${detail})` : ""}`); failed++; }
}

const tz = process.env.TZ || "(unset)";
console.log(`TZ=${tz}`);

// Midnight edge: same UTC instant, different local calendar dates.
const instant = new Date(Date.UTC(2026, 0, 1, 0, 30));
if (tz === "Asia/Kolkata") {
  assert(toLocalKey(instant) === "2026-01-01", "Kolkata: 2026-01-01T00:30Z is Jan 1 local", toLocalKey(instant));
} else if (tz === "America/Los_Angeles") {
  assert(toLocalKey(instant) === "2025-12-31", "Los Angeles: 2026-01-01T00:30Z is Dec 31 local", toLocalKey(instant));
} else {
  // Fallback: key must match the runtime's own local components.
  const expected = `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, "0")}-${String(instant.getDate()).padStart(2, "0")}`;
  assert(toLocalKey(instant) === expected, "toLocalKey matches local components", toLocalKey(instant));
}

// Locally-constructed dates always map to their own calendar day, any TZ.
assert(toLocalKey(new Date(2026, 5, 15, 0, 5)) === "2026-06-15", "local midnight-ish date keeps its day");
assert(todayLocal(new Date(2026, 11, 31, 23, 59)) === "2026-12-31", "todayLocal uses the local date");

// Strict parsing: no human strings, no nonexistent dates.
assert(isValidDateKey("2028-02-29") === true, "leap day is valid");
assert(isValidDateKey("2026-02-29") === false, "2026-02-29 does not exist");
assert(isValidDateKey("Nov 3 2026") === false, "human strings are not date keys");
let threw = false;
try { parseDateKey("2026-13-01"); } catch { threw = true; }
assert(threw, "parseDateKey rejects month 13");

// Safe month/day parsing (never new Date(string)).
assert(parseMonthDay("Nov 3", 2026) === "2026-11-03", 'parseMonthDay "Nov 3"');
assert(parseMonthDay("3 Nov", 2026) === "2026-11-03", 'parseMonthDay "3 Nov"');
assert(parseMonthDay("3rd November", 2026) === "2026-11-03", 'parseMonthDay "3rd November"');
assert(parseMonthDay("November 3rd", 2026) === "2026-11-03", 'parseMonthDay "November 3rd"');
assert(parseMonthDay("Feb 31", 2026) === null, 'parseMonthDay "Feb 31" is null');
assert(parseMonthDay("next week", 2026) === null, "parseMonthDay rejects non-dates");

// Calendar arithmetic is TZ/DST independent.
assert(addDaysToKey("2026-02-28", 1) === "2026-03-01", "addDays month boundary");
assert(addDaysToKey("2028-02-28", 1) === "2028-02-29", "addDays leap day");
assert(addDaysToKey("2026-03-08", 1) === "2026-03-09", "addDays across US DST start");
assert(diffDateKeys("2026-01-01", "2027-01-01") === 365, "diffDateKeys full year");
assert(weekdayOfKey("2026-11-05") === 4, "2026-11-05 is a Thursday");

console.log(`\nlocalDate: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
