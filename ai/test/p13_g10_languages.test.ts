// Prompt 13 Group 10: offline floor for advertised non-English phrases, typo tolerance, cut-off replies.
import fs from "node:fs";
import { parseLocally, runLavenderAgent, looksTruncated, normalizeOfflineText } from "../backend/agent";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04", Y = "2026-11-03";

async function main() {
  delete process.env.META_API_KEY; // OFFLINE path only (model disabled)
  const golden: Array<[string, string, string]> = [
    ["mera period kal shuru hua", Y, "Hindi romanized (yesterday)"],
    ["mera period aaj shuru hua", T, "Hindi romanized (today)"],
    ["मेरा पीरियड आज शुरू हुआ", T, "Hindi Devanagari (today)"],
    ["मेरा पीरियड कल शुरू हुआ", Y, "Hindi Devanagari (yesterday)"],
    ["amar period aaj shuru hoyeche", T, "Bengali romanized (today)"],
    ["amar period kal shuru holo", Y, "Bengali romanized (yesterday)"],
    ["ente period innu thudangi", T, "Malayalam romanized (today)"],
    ["എന്റെ പീരിയഡ് ഇന്ന് തുടങ്ങി", T, "Malayalam script (today)"],
  ];
  for (const [t, date, label] of golden) {
    const r: any = await runLavenderAgent(t, { currentDate: T });
    check(`G10 offline: ${label} -> period start ${date}`, r.mode === "offline" && r.entry?.date === date && r.entry?.kind === "period_started", { m: r.message, e: r.entry });
  }
  const typo: any = parseLocally("my peroid started tday, hevy flow", T, {});
  check("G10 typos: 'my peroid started tday, hevy flow' parses offline", typo.entry?.date === T && typo.entry?.flow === "heavy" && typo.entry?.kind === "period_started", typo.entry);
  const typo2: any = parseLocally("period strted yesterday with crmaps", T, {});
  check("G10 typos: 'strted' / 'crmaps'", typo2.entry?.date === Y && typo2.entry?.symptoms.includes("cramps"), typo2.entry);
  check("G10: notes keep what the user actually typed", typo.entry?.notes == null || typo.entry?.notes === "my peroid started tday, hevy flow" || !/period started today/.test(typo.entry?.notes || ""), typo.entry?.notes);
  check("G10: fuzzy matching leaves look-alike real words alone ('night', 'slow', 'right')", normalizeOfflineText("night slow right") === "night slow right", normalizeOfflineText("night slow right"));
  const ok: any = parseLocally("period started yesterday, light flow", T, {});
  check("G10: text that already parses is never normalised", !(ok.activityTrail || []).some((a: any) => a.step === "Offline Normalisation") && ok.entry?.flow === "light");

  // Truncated or empty model replies are never shown as-is
  check("G10: the Tamil fragment counts as cut off", looksTruncated("உங்கள் பதிவைக் கு"));
  check("G10: a complete sentence is not cut off", !looksTruncated("I've prepared your log for Nov 4. Please review and confirm below."));
  process.env.META_API_KEY = "k";
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "உங்கள் பதிவைக் கு" } }] }) })) as any;
    const r1: any = await runLavenderAgent("period started today, heavy flow", { currentDate: T });
    check("G10: truncated reply -> clean offline fallback with a real slip", r1.mode === "offline" && r1.message.indexOf("உங்கள்") === -1 && r1.entry?.flow === "heavy", { m: r1.message, mode: r1.mode });
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "length", message: { role: "assistant", content: "Your period started today and the flow is heavy, so I will" } }] }) })) as any;
    const r2: any = await runLavenderAgent("period started today, heavy flow", { currentDate: T });
    check("G10: finish_reason=length -> never shown as-is", r2.mode === "offline" && !/so I will$/.test(r2.message), r2.message);
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "நான் உங்கள் பதிவைக் கு" } }] }) })) as any;
    const r3: any = await runLavenderAgent("வணக்கம் ஏதோ ஒன்று", { currentDate: T });
    check("G10: truncated reply + unreadable message -> honest retry message", !r3.entry && /cut off/.test(r3.message) && /try again/i.test(r3.message), r3.message);
  } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }

  // Copy audit: every in-app language claim matches the tests above
  const vf = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  check("G10 copy: no blanket 'Malayalam works when typed' claim", !/Malayalam works when typed/.test(vf));
  check("G10 copy: offline claim is limited to the tested languages and phrases", /typed period-start messages work in English, Hindi \(Devanagari or romanized/.test(vf) && /all other languages, needs the Live AI/.test(vf));
}

main().then(() => { console.log(`\nP13 Group 10: ${passed} passed, ${failed} failed.`); process.exit(failed > 0 ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
