// Prompt 13 Group 1: landmark plans resolve to the NEXT occurrence; logs stay past.
import { parseLocally } from "../backend/agent";
import { resolveNextLandmarkOccurrence, landmarkOccurrencesAround, parseRelativeExpression } from "../backend/dateArithmetic";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const ev = (r: any) => (r.plannedEvents || []).map((e: any) => [e.title, e.date]);

// Plans / events -> next occurrence, never the past
const a = parseLocally("exam 2 days before New Year's", "2026-11-04", {});
check("G1: '2 days before New Year's' plan on 2026-11-04 -> 2026-12-30", JSON.stringify(ev(a)) === JSON.stringify([["exam", "2026-12-30"]]) && !a.entry, ev(a));
const b = parseLocally("exam 2 days before New Year's", "2027-01-05", {});
check("G1: same plan on 2027-01-05 -> 2027-12-30 (fixed-date landmark rolls past the table)", JSON.stringify(ev(b)) === JSON.stringify([["exam", "2027-12-30"]]) && !b.entry, { ev: ev(b), entry: b.entry });
const c = parseLocally("wedding a week before Diwali", "2026-11-04", {});
check("G1: 'a week before Diwali' applies -7 and rolls to next Diwali", JSON.stringify(ev(c)) === JSON.stringify([["wedding", "2027-10-22"]]), ev(c));
const d = parseLocally("I have a trip 3 days after Christmas", "2026-11-04", {});
check("G1: titles are readable ('trip', not 'I have a trip')", JSON.stringify(ev(d)) === JSON.stringify([["trip", "2026-12-28"]]), ev(d));
const n = resolveNextLandmarkOccurrence("2 days before New Year's", "2026-11-04");
check("G1: resolveNextLandmarkOccurrence('2 days before New Year's', 2026-11-04) = 2026-12-30", !!n && n.resolvedDate === "2026-12-30", n);
const plan = parseLocally("I'm planning around 2 days before New Year's", "2026-11-04", {});
check("G1: plan-word phrasing never resolves into the past", ev(plan).every((e: any) => e[1] >= "2026-11-04"), ev(plan));

// Logs keep the past-occurrence rule (no future logs)
const log = parseLocally("my period started 2 days before New Year's", "2026-11-04", {});
check("G1: past-tense period log stays in the past (2025-12-30), never a future log", !!log.entry && log.entry.date === "2025-12-30", log.entry);

// Live tool returns both, labelled
const occ = landmarkOccurrencesAround("New Year's Day", "2026-11-04", -2);
check("G1: live milestone_lookup exposes mostRecentPast and nextUpcoming", !!occ && occ.mostRecentPast === "2025-12-30" && occ.nextUpcoming === "2026-12-30", occ);

// Week offsets
check("G1: 'a week before' = -7", parseRelativeExpression("a week before diwali").days === -7);
check("G1: 'two weeks after' = +14", parseRelativeExpression("two weeks after christmas").days === 14);
check("G1: 'week of' is not an offset", parseRelativeExpression("the week of diwali").days === 0);

console.log(`\nP13 Group 1: ${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
