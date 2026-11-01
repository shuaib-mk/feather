/** Q3: offline floor - guardrail additions and resolver coverage. */
import { checkMedicalAdviceGuardrail, checkSevereSymptomEscalation } from "../backend/guardrail";
import { resolveDateExpression } from "../backend/dateArithmetic";
import { parseLocally } from "../backend/agent";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-01";

// --- Q3.1 verdict cue beats logging; hospital+heavy flow escalates ---
{
  check("Q3.1: mean-I-have-PCOS refused", checkMedicalAdviceGuardrail("does heavy flow mean I have PCOS").isRefusal === true, null);
  check("Q3.1: sign-of-cancer refused", checkMedicalAdviceGuardrail("is spotting between periods a sign of cancer").isRefusal === true, null);
  const hosp = parseLocally("my flow is very heavy, should I go to the hospital", TODAY, {} as any);
  check("Q3.1: hospital plus heavy flow escalates", typeof hosp.message === "string" && hosp.message.indexOf("need prompt medical care") !== -1, hosp.message);
}

// --- Q3.5 multilingual safety patterns (explicit expectations; no substring classifier) ---
// Severe red-flags (faint/dizzy/chest pain) escalate end-to-end via parseLocally.
// Medicine/tablet and "is it normal" questions refuse via the guardrail.
// The "doctor ko dikhana chahiye" wording is itself a guardrail pattern, so it
// refuses (guardrail runs before severe) - pinned here deliberately.
{
  const severeCases: Array<[string, string]> = [
    ["hi-roman-chakkar", "mujhe chakkar aa rahe hain"],
    ["hi-roman-behosh", "behosh ho gayi"],
    ["hi-roman-chest", "seene mein dard hai, kya karoon"],
    ["ta-mayakkam", "mayakkam varugiradhu"],
    ["ta-nenju", "nenju vali irukku"],
    ["kn-dizzy", "nanage talasutti bartide"],
    ["kn-chest", "ede novu ide"],
    ["ml-dizzy", "thalakarakkam undu"],
    ["ml-faint", "mayakkam varunnu"],
    ["ml-chest", "nenjuvedana undu"],
  ];
  for (const [name, text] of severeCases) {
    const r = parseLocally(text, TODAY, {} as any);
    check("Q3.5 severe escalates: " + name, typeof r.message === "string" && r.message.indexOf("need prompt medical care") !== -1, r.message);
  }
  const refuseCases: Array<[string, string]> = [
    ["hi-roman-medicine", "kaun si dava loon dard ke liye"],
    ["hi-roman-normal", "kya ye normal hai"],
    ["hi-roman-doctor-phrase-refuses", "behosh ho gayi, doctor ko dikhana chahiye"],
    ["ta-medicine", "valikku mathirai edukkalama"],
    ["ta-normal", "idu normal ah"],
    ["kn-medicine", "aushadhi tegedukollabeka"],
    ["kn-normal", "idu normal na"],
    ["ml-medicine", "marunnu kazhikkamo"],
    ["ml-normal", "ithu normal ano"],
  ];
  for (const [name, text] of refuseCases) {
    const r = parseLocally(text, TODAY, {} as any);
    check("Q3.5 refused: " + name, typeof r.message === "string" && r.message.indexOf("I can only help with logging") !== -1, r.message);
  }
}


// --- Q3.2 resolver additions: never default silently ---
{
  const dateCases: Array<[string, string | null, string | null]> = [
    ["3 days back", "2026-10-29", null],
    ["three days back", "2026-10-29", null],
    ["two weeks back", "2026-10-18", null],
    ["5 days back", "2026-10-27", null],
    ["a day ago", "2026-10-31", null],
    ["a week ago", "2026-10-25", null],
    ["a fortnight ago", "2026-10-18", null],
    ["a month ago", "2026-10-01", null],
    ["on monday", "2026-10-26", null],
    ["on sunday", "2026-11-01", null],
    ["October twenty second", "2026-10-22", null],
    ["the twenty-first", "2026-10-21", null],
    ["20.10.2026", "2026-10-20", null],
    ["15.09.2026", "2026-09-15", null],
    ["November third", null, "more than 6 months"],
    ["fifteenth of December", null, "more than 6 months"],
    ["earlier this month", null, "earlier this month"],
  ];
  for (const [text, wantDate, wantAsk] of dateCases) {
    const r = resolveDateExpression(text, TODAY);
    if (wantDate !== null) {
      check("Q3.2 resolves: " + text, r.date === wantDate, r.date);
    } else {
      check("Q3.2 asks: " + text, r.date === null && (r.needsClarification === true) && (r.clarificationQuestion || "").indexOf(wantAsk as string) !== -1, r.clarificationQuestion);
    }
  }
  const e2e = parseLocally("I had cramps three days back", TODAY, {} as any);
  check("Q3.2 end-to-end: cramps three days back", e2e.entry !== null && (e2e.entry as any).date === "2026-10-29", (e2e.entry as any)?.date);
  const e2eAsk = parseLocally("my period started earlier this month", TODAY, {} as any);
  check("Q3.2 end-to-end: earlier this month asks", e2eAsk.entry === null && typeof e2eAsk.message === "string" && e2eAsk.message.indexOf("earlier this month") !== -1, e2eAsk.message);
}


// --- Q3.3 correction scoping: today-statements never edit old entries ---
{
  const mk = (date: string, flow: any, symptoms: any[]) => ({ date, flow, symptoms, mood: null, energy: null, sleep: null, notes: "x", landmarkName: null, isApproximate: false, kind: "daily_log" });
  const old = mk("2026-10-30", "heavy", ["cramps"]);
  const rToday = parseLocally("no cramps today", TODAY, { recentEntry: old } as any);
  check("Q3.3: no-cramps-today does not edit old entry", !rToday.replacesExisting && (rToday.entry === null || (rToday.entry as any).date !== "2026-10-30" || (rToday.entry as any).flow !== "light"), JSON.stringify(rToday.entry));
  const rSpot = parseLocally("not heavy today, just spotting", TODAY, { recentEntry: old } as any);
  check("Q3.3: today-statement logs today, no replace", !rSpot.replacesExisting && (rSpot.entry as any)?.date === TODAY && (rSpot.entry as any)?.flow === "spotting", JSON.stringify(rSpot.entry));
  const rLast = parseLocally("change my last entry to medium flow", TODAY, { recentEntry: old } as any);
  check("Q3.3: my-last-entry corrects recent", rLast.replacesExisting === true && (rLast.entry as any)?.date === "2026-10-30" && (rLast.entry as any)?.flow === "medium", JSON.stringify(rLast.entry));
  const oct3 = mk("2026-10-03", "heavy", []);
  const oct31 = mk("2026-10-31", "heavy", []);
  const rNamed = parseLocally("change my october 3 entry to medium flow", TODAY, { recentEntry: oct31, recentEntries: [oct31, oct3] } as any);
  check("Q3.3: date-named entry corrected", rNamed.replacesExisting === true && (rNamed.entry as any)?.date === "2026-10-03" && (rNamed.entry as any)?.flow === "medium", JSON.stringify(rNamed.entry));
  const rBare = parseLocally("actually it was light, not heavy", TODAY, { recentEntry: oct31, recentEntries: [oct31, oct3] } as any);
  check("Q3.3: bare contradiction still targets negated flow", rBare.replacesExisting === true && (rBare.entry as any)?.flow === "light", JSON.stringify(rBare.entry));
}

console.log("Q3 part 1 Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
