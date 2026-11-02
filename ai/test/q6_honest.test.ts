/** Q6.3: honest replies. Messages come from the real result: no phantom slip
 * updates, no phantom saves, correct multi-date counts, ranges fully placed. */
import { parseLocally, runLavenderAgent } from "../backend/agent";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-01";
const toolMsg = (calls: any[]) => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: calls } }] });
const textMsg = (content: string) => ({ choices: [{ message: { role: "assistant", content } }] });
async function withMock(responses: any[], fn: () => Promise<void>) {
  process.env.META_API_KEY = "test-key";
  process.env.META_BASE_URL = "https://mock.meta.test/v1";
  const orig = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async () => { const r = responses[Math.min(n, responses.length - 1)]; n++; return { ok: true, json: async () => r }; }) as any;
  try { await fn(); } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }
}
const ovCall = (id: string, args: any) => ({ id, function: { name: "check_overlap", arguments: JSON.stringify(args) } });
const updCall = (id: string, args: any) => ({ id, function: { name: "update_entry", arguments: JSON.stringify(args) } });

async function main() {
  await withMock([
    toolMsg([ovCall("o1", { events: [{ name: "team offsite", date: "2026-11-10", endDate: "2026-11-12" }] })]),
    textMsg("Your team offsite is set."),
  ], async () => {
    const r: any = await runLavenderAgent("team offsite from Nov 10 to Nov 12", { currentDate: TODAY });
    check("Q6.3: range fully prepared, no missing-dates line", r.message.indexOf("I only prepared") === -1, r.message);
    check("Q6.3: no wrong-year dates", r.message.indexOf("2025") === -1, r.message);
    check("Q6.3: ranged event keeps end date", (r.plannedEvents || [])[0]?.endDate === "2026-11-12", JSON.stringify(r.plannedEvents));
  });
  await withMock([
    toolMsg([ovCall("o1", { events: [{ name: "team offsite", date: "2026-11-10", endDate: "2026-11-12" }, { name: "design review", date: "2026-11-14", endDate: "2026-11-15" }] })]),
    textMsg("Both events are set."),
  ], async () => {
    const r: any = await runLavenderAgent("team offsite from Nov 10 to Nov 12 and design review Nov 14 to Nov 15", { currentDate: TODAY });
    check("Q6.3: multi-event ranges fully prepared", r.message.indexOf("I only prepared") === -1, r.message);
    check("Q6.3: both ranged events kept", (r.plannedEvents || []).length === 2 && (r.plannedEvents || []).every((e: any) => e.endDate), JSON.stringify(r.plannedEvents));
  });
  await withMock([
    toolMsg([updCall("u1", { date: "2026-11-05" })]),
    textMsg("I have updated your slip."),
  ], async () => {
    const r: any = await runLavenderAgent("move it to the 5th", { currentDate: TODAY });
    check("Q6.3: phantom slip update replaced", r.message === "There's no entry to change." && !r.entry, r.message);
  });
  const off = parseLocally("change my october 3 entry to medium flow", TODAY, {} as any);
  check("Q6.3: offline date correction with no target", off.entry === null && off.message === "There's no entry to change.", off.message);
  const offBare = parseLocally("move it to the 5th", TODAY, {} as any);
  check("Q6.3: bare-day correction keeps lookup wording", offBare.entry === null && offBare.message === "I couldn't find a recent entry to correct.", offBare.message);
}
main().then(() => {
  console.log("Q6 Honest Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
});
