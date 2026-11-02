/** Q6.4: ?date= default end to end (offline + live), voice button rule. */
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { canLogDay } from "../../client/src/pages/CalendarPage";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-01";
const toolMsg = (calls: any[]) => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: calls } }] });
const textMsg = (content: string) => ({ choices: [{ message: { role: "assistant", content } }] });
const logCall = (id: string, args: any) => ({ id, function: { name: "log_entry", arguments: JSON.stringify(args) } });

async function main() {
  const r = parseLocally("cramps and heavy flow", TODAY, { defaultDate: "2026-10-20" } as any);
  check("Q6.4: offline slip shows ?date=", (r.entry as any)?.date === "2026-10-20", JSON.stringify((r.entry as any)?.date));

  const bodies: any[] = [];
  process.env.META_API_KEY = "test-key";
  process.env.META_BASE_URL = "https://mock.meta.test/v1";
  const orig = globalThis.fetch;
  globalThis.fetch = (async (_url: any, opts: any) => {
    bodies.push(JSON.parse(opts.body));
    const calls = bodies.length === 1
      ? [logCall("a1", { date: "2026-10-20", flow: "medium", kind: "daily_log", symptoms: ["cramps"] })]
      : [];
    const r = calls.length ? toolMsg(calls) : textMsg("Logged for Oct 20.");
    return { ok: true, json: async () => r };
  }) as any;
  try {
    const live: any = await runLavenderAgent("cramps and heavy flow", { currentDate: TODAY, defaultDate: "2026-10-20" } as any);
    const sys = bodies.length ? bodies[0].messages[0].content : "";
    check("Q6.4: live model is told the calendar date", sys.indexOf("opened voice from the calendar on 2026-10-20") !== -1, sys.slice(0, 160));
    check("Q6.4: live slip shows ?date=", live.entry && (live.entry as any).date === "2026-10-20", JSON.stringify(live.entry && (live.entry as any).date));
  } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }

  check("Q6.4: past day gets the button", canLogDay("2026-10-20", TODAY) === true, "past");
  check("Q6.4: today gets the button", canLogDay(TODAY, TODAY) === true, "today");
  check("Q6.4: future day shows notice instead", canLogDay("2026-11-05", TODAY) === false, "future");
}
main().then(() => {
  console.log("Q6 Voice-Date Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
});
