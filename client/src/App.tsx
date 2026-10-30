
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CycleProvider } from "./context/CycleContext";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { CalendarPage } from "./pages/CalendarPage";
import { VoiceFlowPage } from "./pages/VoiceFlowPage";
import { VaultPage } from "./pages/VaultPage";
import { ChroniclePage } from "./pages/ChroniclePage";
import { StatsPage } from "./pages/StatsPage";
import { DiaryScannerPage } from "./pages/DiaryScannerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { unlockApp, lockNow } from "./lib/appLock";
import { isDemoActive, enterDemoMode } from "./lib/demoMode";

function LockGate({ children }: { children: React.ReactNode }) {
  const encrypted = typeof localStorage !== "undefined" && !!localStorage.getItem("feather_encrypted_vault_v1");
  const [locked, setLocked] = useState(encrypted);
  const [pass, setPass] = useState(""); const [error, setError] = useState(""); const [attempts, setAttempts] = useState(0);
  useEffect(()=>{ if (typeof localStorage!=="undefined" && localStorage.getItem("feather_discreet")==="true") document.title = "Notes"; if (new URLSearchParams(window.location.search).get("demo")==="1" && !isDemoActive()) { enterDemoMode(); window.location.search=""; } },[]);
  useEffect(()=>{ if (!localStorage.getItem("feather_app_lock_enabled")) return; let timer:any; const reset=()=>{ const mins=parseInt(localStorage.getItem("feather_autolock_minutes")||"5",10)||5; clearTimeout(timer); timer=setTimeout(()=>{ lockNow().catch(()=>{}); }, mins*60*1000); }; const onVis=()=>{ if(document.hidden && localStorage.getItem("feather_autolock_hidden")==="true") lockNow().catch(()=>{}); }; window.addEventListener("pointerdown",reset); document.addEventListener("visibilitychange",onVis); reset(); return ()=>{ clearTimeout(timer); window.removeEventListener("pointerdown",reset); document.removeEventListener("visibilitychange",onVis); }; },[]);
  if (!locked) return <>{children}</>;
  return <div className="min-h-screen flex items-center justify-center p-6"><div className="liquid-glass-card liquid-glass-sheet rounded-[28px] p-6 max-w-sm w-full space-y-3"><h1 className="font-serif text-xl font-semibold">{typeof localStorage!=="undefined" && localStorage.getItem("feather_discreet")==="true" ? "Notes" : "Feather is locked"}</h1><p className="text-xs text-stone-600">Enter your passphrase to unlock. This protects against casual access, not a determined attacker with your device.</p><input type="password" aria-label="Passphrase" value={pass} onChange={e=>setPass(e.target.value)} className="w-full border rounded-xl px-3 py-2 min-h-[44px]" /><button type="button" className="liquid-glass-button rounded-full px-5 min-h-[44px] w-full" onClick={async()=>{ try{ await unlockApp(pass); window.location.reload(); }catch{ const n=attempts+1; setAttempts(n); setError(`Wrong passphrase. Please wait ${Math.min(30,n*2)} seconds and try again.`); } }}>Unlock</button>{error && <p role="alert" className="text-xs text-rose-700">{error}</p>}</div></div>;
}
function DemoBanner(){ const [demo,setDemo]=useState(isDemoActive()); useEffect(()=>{ setDemo(isDemoActive()); },[]); if(!demo) return null; return <div role="status" className="liquid-glass-banner fixed top-0 left-0 right-0 z-[70] text-stone-900 text-center text-xs font-bold py-1.5">Demo data — fictional cycles only. <button type="button" className="underline" onClick={()=>{ localStorage.removeItem("feather_demo_active"); window.location.reload(); }}>Exit demo</button></div>; }
function QuickHide(){ const [hidden,setHidden]=useState(false); if(hidden) return <div className="fixed inset-0 z-[80] bg-white flex items-center justify-center" onClick={()=>setHidden(false)}><p className="font-serif text-xl">Notes</p></div>; return <button type="button" aria-label="Quick hide" className="fixed bottom-24 right-3 z-[65] liquid-glass-button rounded-full px-3 min-h-[44px] text-xs md:bottom-6" onClick={()=>setHidden(true)}>Hide</button>; }
export function App() {
  return (
    <BrowserRouter>
      <LockGate>
      <CycleProvider>
        <DemoBanner /><QuickHide />
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/voice" element={<VoiceFlowPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/chronicle" element={<ChroniclePage />} />
            <Route path="/vault" element={<VaultPage />} />
            <Route path="/scanner" element={<DiaryScannerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </CycleProvider>
      </LockGate>
    </BrowserRouter>
  );
}
