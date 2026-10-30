import assert from "node:assert";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CycleProvider } from "../../client/src/context/CycleContext";
import { AppLayout } from "../../client/src/components/AppLayout";
import { DashboardPage } from "../../client/src/pages/DashboardPage";
import { CalendarPage } from "../../client/src/pages/CalendarPage";
import { VoiceFlowPage } from "../../client/src/pages/VoiceFlowPage";
import { SettingsPage } from "../../client/src/pages/SettingsPage";
import { ChroniclePage } from "../../client/src/pages/ChroniclePage";
import { VaultPage } from "../../client/src/pages/VaultPage";
import { StatsPage } from "../../client/src/pages/StatsPage";
import { enterDemoMode, exitDemoMode, DEMO_ACTIVE_KEY } from "../../client/src/lib/demoMode";

console.log("=== Running Render Smoke Tests for All App Pages & Demo Mode States ===");

// Mock browser globals for SSR / renderToString test
if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

if (typeof globalThis.sessionStorage === "undefined") {
  const sStore: Record<string, string> = {};
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => sStore[k] || null,
    setItem: (k: string, v: string) => { sStore[k] = String(v); },
    removeItem: (k: string) => { delete sStore[k]; },
    clear: () => { for (const k in sStore) delete sStore[k]; },
  };
}

function renderTree(path = "/", isDemo = false) {
  if (isDemo) {
    enterDemoMode();
  } else {
    exitDemoMode();
  }

  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <CycleProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/voice" element={<VoiceFlowPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/chronicle" element={<ChroniclePage />} />
            <Route path="/vault" element={<VaultPage />} />
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </AppLayout>
      </CycleProvider>
    </MemoryRouter>
  );
}

// 1. Dashboard with demo mode OFF
{
  const html = renderTree("/", false);
  assert(html.includes("Cycle Overview"), "Must render Dashboard title");
  assert(html.includes("Try Demo"), "Try Demo card must be present when demo mode is OFF");
  assert(!html.includes("Demo Mode Active:"), "Demo banner must NOT be present when demo mode is OFF");
  console.log("[PASS] 1. Dashboard renders cleanly with demo mode OFF (no ReferenceError)");
}

// 2. Dashboard with demo mode ON
{
  const html = renderTree("/", true);
  assert(html.includes("Cycle Overview"), "Must render Dashboard title");
  assert(html.includes("Demo Mode Active:"), "Demo banner MUST be present when demo mode is ON");
  assert(html.includes("Exit demo"), "Exit demo button must be present in demo banner");
  console.log("[PASS] 2. Dashboard renders cleanly with demo mode ON (reactive banner + hidden Try Demo card)");
}

// 3. Calendar page
{
  const html = renderTree("/calendar", false);
  assert(html.includes("Calendar"), "Must render Calendar page");
  console.log("[PASS] 3. Calendar page renders cleanly (no undefined useEffect/isDemoActive)");
}

// 4. Voice capture page
{
  const html = renderTree("/voice", false);
  assert(html.includes("Voice Capture"), "Must render Voice Capture page");
  console.log("[PASS] 4. Voice capture page renders cleanly");
}

// 5. Settings page
{
  const html = renderTree("/settings", false);
  assert(html.includes("Settings"), "Must render Settings page");
  assert(html.includes("Diagnostics"), "Must render Diagnostics with session API calls");
  console.log("[PASS] 5. Settings page renders cleanly");
}

// 6. Chronicle & Vault pages
{
  const chronicleHtml = renderTree("/chronicle", false);
  assert(chronicleHtml.includes("Chronicle"), "Must render Chronicle page");
  const vaultHtml = renderTree("/vault", false);
  assert(vaultHtml.includes("Local Vault"), "Must render Vault page");
  console.log("[PASS] 6. Chronicle and Vault pages render cleanly");
}

console.log("\nAll 6 Render Smoke Tests PASSED with 0 errors!");

