/** Q7.7: voice thread lives in React context memory, never in storage. */
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CycleProvider } from "../../client/src/context/CycleContext";
import { VoiceThreadProvider, useVoiceThread, EMPTY_VOICE_THREAD, applyThreadPatch } from "../../client/src/context/VoiceThreadContext";
import { VoiceFlowPage } from "../../client/src/pages/VoiceFlowPage";
import { enableAppLock, lockNow } from "../../client/src/lib/appLock";
import { saveCycleData } from "../../client/src/cycleStorage";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
async function main() {
  const base = { ...EMPTY_VOICE_THREAD };
  const merged = applyThreadPatch(base, { transcript: "hello" });
  check("Q7.7: patch merges one field", merged.transcript === "hello" && merged.agentMessage === "" && merged.conversationHistory.length === 0, JSON.stringify(merged).slice(0, 80));
  const merged2 = applyThreadPatch(merged, (prev) => ({ conversationHistory: [...prev.conversationHistory, { role: "user", content: "hi" }] }));
  check("Q7.7: updater form resolves against latest", merged2.conversationHistory.length === 1 && merged2.transcript === "hello", JSON.stringify(merged2.conversationHistory));
  check("Q7.7: EMPTY default is blank", EMPTY_VOICE_THREAD.transcript === "" && EMPTY_VOICE_THREAD.confirmEntry === null, "empty");
  function Probe() {
    const v = useVoiceThread();
    return React.createElement("span", { "data-t": v.thread.transcript, "data-n": String(v.thread.conversationHistory.length) }, "probe");
  }
  const html = renderToString(React.createElement(VoiceThreadProvider, null, React.createElement(Probe, null)));
  check("Q7.7: fresh provider starts empty (reload clears)", html.indexOf("data-t=") !== -1, html.slice(0, 120));
  const writes: string[] = [];
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { writes.push("local:" + k); store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
  const sstore: Record<string, string> = {};
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => sstore[k] ?? null,
    setItem: (k: string, v: string) => { writes.push("session:" + k); sstore[k] = String(v); },
    removeItem: (k: string) => { delete sstore[k]; },
    clear: () => { for (const k in sstore) delete sstore[k]; },
  };
  renderToString(React.createElement(MemoryRouter, { initialEntries: ["/voice"] },
    React.createElement(CycleProvider, null,
      React.createElement(VoiceThreadProvider, null, React.createElement(VoiceFlowPage, null)))));
  check("Q7.7: rendering voice writes nothing to storage", writes.length === 0, writes.join(","));
  check("Q7.7: thread key never persisted", !writes.some((w) => w.indexOf("voice_pending") !== -1 || w.indexOf("voice_thread") !== -1), writes.join(","));
  const fs = await import("node:fs");
  const page = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  check("Q7.7: page keeps thread in context", page.indexOf("useVoiceThread()") !== -1 && page.indexOf("clearThread()") !== -1, "context use");
  check("Q7.7: page no longer persists the thread", page.indexOf("saveVoicePendingSession({") === -1 && page.indexOf("= loadVoicePendingSession();") === -1 && page.indexOf("clearVoicePendingSession();") === -1, "no session IO");
  const app = fs.readFileSync("client/src/App.tsx", "utf8");
  check("Q7.7: provider wraps the app", app.indexOf("<VoiceThreadProvider>") !== -1, "provider");
  saveCycleData({ periods: [], logs: [] });
  await enableAppLock("correct-horse-12");
  let reloaded: boolean = false;
  (globalThis as any).window = { location: { reload: () => { reloaded = true; } } };
  await lockNow();
  (globalThis as any).window = undefined;
  check("Q7.7: Lock now reloads (in-memory thread clears)", reloaded, String(reloaded));
  console.log("Q7 Voice Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
}
main();
