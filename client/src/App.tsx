
import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { CycleProvider, useCycle } from "./context/CycleContext";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { CalendarPage } from "./pages/CalendarPage";
import { VoiceFlowPage } from "./pages/VoiceFlowPage";
import { VaultPage } from "./pages/VaultPage";
import { ChroniclePage } from "./pages/ChroniclePage";
import { StatsPage } from "./pages/StatsPage";
import { DiaryScannerPage } from "./pages/DiaryScannerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { unlockApp, lockNow, getLockState, eraseLockAndStartFresh } from "./lib/appLock";
import { importCycleDataJSON } from "./cycleStorage";
import { isDemoActive as isDemoModeActive, enterDemoMode } from "./lib/demoMode";

function LockGate({ children }: { children: React.ReactNode }) {
  const [lockState] = useState<"open" | "locked" | "error">(() => getLockState());
  const [pass, setPass] = useState(""); const [error, setError] = useState(""); const [attempts, setAttempts] = useState(0);
  const [confirmErase, setConfirmErase] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  useEffect(()=>{ if (typeof localStorage!=="undefined" && localStorage.getItem("feather_discreet")==="true") document.title = "Notes"; if (new URLSearchParams(window.location.search).get("demo")==="1" && !isDemoModeActive()) { enterDemoMode(); window.location.search=""; } },[]);
  useEffect(()=>{ if (!localStorage.getItem("feather_app_lock_enabled")) return; let timer:any; const reset=()=>{ const mins=parseInt(localStorage.getItem("feather_autolock_minutes")||"5",10)||5; clearTimeout(timer); timer=setTimeout(()=>{ lockNow().catch(()=>{}); }, mins*60*1000); }; const onHide=()=>{ if(localStorage.getItem("feather_autolock_hidden")==="true") lockNow().catch(()=>{}); }; const onVis=()=>{ if(document.hidden) onHide(); }; window.addEventListener("pointerdown",reset); document.addEventListener("visibilitychange",onVis); window.addEventListener("pagehide",onHide); reset(); return ()=>{ clearTimeout(timer); window.removeEventListener("pointerdown",reset); document.removeEventListener("visibilitychange",onVis); window.removeEventListener("pagehide",onHide); }; },[]);
  const doErase = () => { eraseLockAndStartFresh(); window.location.reload(); };
  const doRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const res = importCycleDataJSON(text);
      if (!res.success) { setRestoreMsg(res.error || "Could not import that backup."); return; }
      setRestoreMsg("Backup restored (" + res.count + " records). App Lock is now off; re-enable it in Settings.");
      eraseLockAndStartFresh();
      setTimeout(() => window.location.reload(), 900);
    } catch { setRestoreMsg("Could not read that file."); }
  };
  const lockActions = (<div className="space-y-2 pt-1">
    <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Restore backup file" onChange={(e)=>{ doRestoreFile(e.target.files?.[0] as File | undefined); e.target.value=""; }} />
    <button type="button" className="liquid-glass-button rounded-full px-5 min-h-[44px] w-full" onClick={()=>fileRef.current?.click()}>Restore from backup</button>
    {confirmErase ? (<div className="flex gap-2"><button type="button" className="liquid-glass-button rounded-full px-5 min-h-[44px] flex-1" onClick={doErase}>Confirm erase</button><button type="button" className="liquid-glass-pill rounded-full px-4 min-h-[44px]" onClick={()=>setConfirmErase(false)}>Cancel</button></div>)
    : (<button type="button" className="liquid-glass-pill rounded-full px-5 min-h-[44px] w-full" onClick={()=>setConfirmErase(true)}>Erase lock and start fresh</button>)}
    <p className="text-[11px] text-stone-500">Erasing clears the lock flag and the encrypted vault after confirmation. Restoring a backup turns App Lock off.</p>
    {restoreMsg && <p role="status" className="text-xs text-stone-700">{restoreMsg}</p>}
  </div>);
  if (lockState === "error") return <div className="min-h-screen flex items-center justify-center p-6"><div className="liquid-glass-card rounded-[24px] p-6 max-w-sm w-full space-y-3"><h1 className="font-serif text-xl font-semibold">App Lock error</h1><p className="text-xs text-stone-600">App Lock is on but no vault data was found in this browser. Restore from a backup, or erase the lock and start fresh.</p>{lockActions}</div></div>;
  if (lockState === "open") return <>{children}</>;
  return <div className="min-h-screen flex items-center justify-center p-6"><div className="liquid-glass-card rounded-[24px] p-6 max-w-sm w-full space-y-3"><h1 className="font-serif text-xl font-semibold">{typeof localStorage!=="undefined" && localStorage.getItem("feather_discreet")==="true" ? "Notes" : "Feather is locked"}</h1><p className="text-xs text-stone-600">Enter your passphrase to unlock. This protects against casual access, not a determined attacker with your device.</p><input type="password" aria-label="Passphrase" value={pass} onChange={e=>setPass(e.target.value)} className="w-full border rounded-xl px-3 py-2 min-h-[44px]" /><button type="button" className="liquid-glass-button rounded-full px-5 min-h-[44px] w-full" onClick={async()=>{ try{ await unlockApp(pass); window.location.reload(); }catch{ const n=attempts+1; setAttempts(n); setError(`Wrong passphrase. Please wait ${Math.min(30,n*2)} seconds and try again.`); } }}>Unlock</button>{error && <p role="alert" className="text-xs text-rose-700">{error}</p>}{lockActions}</div></div>;
}
export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <LockGate>
      <CycleProvider>
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
