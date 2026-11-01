/** Q3: offline floor - guardrail additions and resolver coverage. */
import { checkMedicalAdviceGuardrail, checkSevereSymptomEscalation } from "../backend/guardrail";
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

console.log("Q3 part 1 Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
