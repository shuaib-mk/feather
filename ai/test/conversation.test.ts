/** Message lifecycle: stable ids, archive-once, no empty bubbles, no duplicates. */
import { appendTurn, makeTurnId, resolveShownMessage, shouldArchiveTurn } from "../../client/src/lib/conversation";
import { readFileSync as readPageFile } from "node:fs";
import { join as joinPagePath } from "node:path";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}

function main() {
  // ids unique + stable keys
  const a = makeTurnId(), b = makeTurnId();
  check("ids unique", a !== b && a.length > 0 && b.length > 0, a + "/" + b);
  // append once
  const h1 = appendTurn([], { role: "user", content: "hi", id: a + "-u" }, { role: "assistant", content: "Hello!", id: a + "-a" });
  check("append adds both turns", h1.length === 2, h1.length);
  // same ids again -> no duplicate
  const h2 = appendTurn(h1, { role: "user", content: "hi", id: a + "-u" }, { role: "assistant", content: "Hello!", id: a + "-a" });
  check("same ids never appended twice", h2.length === 2, h2.length);
  // empty assistant never stored
  const h3 = appendTurn(h2, { role: "user", content: "hi?", id: "x-u" }, { role: "assistant", content: "   ", id: "x-a" });
  check("empty assistant dropped, user kept", h3.length === 3 && h3.every((t) => t.content.trim().length > 0), h3.length);
  // cap bounds growth
  let h: any[] = [];
  for (let i = 0; i < 250; i++) h = appendTurn(h, { role: "user", content: "m" + i, id: "u" + i }, { role: "assistant", content: "r" + i, id: "a" + i });
  check("history capped", h.length === 200, h.length);
  // shown message
  check("blank with nothing -> error text", resolveShownMessage("", false, false).indexOf("try again") !== -1, resolveShownMessage("", false, false));
  check("blank with slip -> kept", resolveShownMessage("", true, false) === "", "slip");
  check("blank with question -> kept", resolveShownMessage("  ", false, true) === "  ", "clarify");
  check("real text passes through", resolveShownMessage("Hi!", false, false) === "Hi!", "text");
  check("whitespace-only counts as blank", resolveShownMessage("   ", false, false).indexOf("try again") !== -1, "ws");
  // archive lifecycle: two turns render exactly once each
  let hist: any[] = [];
  let archived: { t: string; m: string } | null = null;
  check("nothing to archive initially", shouldArchiveTurn("", "", archived) === false, "");
  // turn 1 completes in live state; turn 2 starts -> archive turn 1
  check("archive turn 1", shouldArchiveTurn("t1", "m1", archived) === true, "");
  hist = appendTurn(hist, { role: "user", content: "t1", id: "k1-u" }, { role: "assistant", content: "m1", id: "k1-a" });
  archived = { t: "t1", m: "m1" };
  check("same pair not archived twice", shouldArchiveTurn("t1", "m1", archived) === false, "");
  // turn 2 completes; turn 3 starts -> archive turn 2 only
  check("archive turn 2", shouldArchiveTurn("t2", "m2", archived) === true, "");
  hist = appendTurn(hist, { role: "user", content: "t2", id: "k2-u" }, { role: "assistant", content: "m2", id: "k2-a" });
  archived = { t: "t2", m: "m2" };
  check("history holds each turn exactly once", hist.length === 4 && hist.filter((t) => t.content === "t1").length === 1 && hist.filter((t) => t.content === "m2").length === 1, hist.map((t) => t.content));
  check("empty live state never archived", shouldArchiveTurn("", "m1", archived) === false && shouldArchiveTurn("t1", "", archived) === false, "");

// Voice page layout contract: conversation lives in the mic card scroll region,
// status pills removed, diagnostics + inputs intact (frontend-only change).
try {
  const pageSrc = readPageFile(joinPagePath(process.cwd(), "client/src/pages/VoiceFlowPage.tsx"), "utf8");
  check("layout: live-ai pill removed", pageSrc.indexOf("Processed with Live AI") === -1, "pill");
  check("layout: calendar pill removed", pageSrc.indexOf("Calendar: stays on this device") === -1 && pageSrc.indexOf("Calendar: matching titles shared") === -1, "pill");
  check("layout: conversation scroll region", pageSrc.indexOf("convoScrollRef") !== -1 && pageSrc.indexOf("overflow-y-auto") !== -1 && pageSrc.indexOf("role=\"log\"") !== -1, "scroll");
  check("layout: mic console + input intact", pageSrc.indexOf("Recording & Input Console") !== -1 && pageSrc.indexOf("Alternative Natural Text Input") !== -1 && pageSrc.indexOf("Start recording voice note") !== -1, "console");
  check("layout: under the hood intact", pageSrc.indexOf("Under The Hood Trace Disclosure") !== -1 && pageSrc.indexOf("technicalEngineString") !== -1, "diagnostics");
} catch (e) { check("layout contract readable", false, String(e)); }

  console.log("Conversation Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
}
main();
