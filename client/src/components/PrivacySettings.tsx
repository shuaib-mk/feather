import React, { useState } from "react";
import { useCycle } from "../context/CycleContext";
import { enableAppLock, disableAppLock, lockNow } from "../lib/appLock";
import { encryptJSON, decryptJSON, isEncryptedPayload } from "../lib/vaultCrypto";
import { exportCycleDataJSON, importCycleDataJSON } from "../cycleStorage";
import { useDiscreetMode } from "../lib/discreetMode";

export function PrivacySettings() {
  const { exportBackup } = useCycle();
  const { isDiscreet: discreet, setDiscreet, toggleQuickHide } = useDiscreetMode();
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const lockEnabled = typeof localStorage !== "undefined" && localStorage.getItem("feather_app_lock_enabled") === "1";
  const [autoLock, setAutoLock] = useState(() => {
    try {
      return localStorage.getItem("feather_autolock_minutes") || "5";
    } catch {
      return "5";
    }
  });
  const [lockOnHide, setLockOnHide] = useState(() => {
    try {
      return localStorage.getItem("feather_autolock_hidden") === "true";
    } catch {
      return false;
    }
  });
  const weak = pass.length > 0 && !(pass.trim().split(/\s+/).length >= 6 || pass.length >= 12);
  const doEnable = async () => {
    if (pass !== pass2) {
      setMsg("Passphrases do not match.");
      return;
    }
    if (pass.length < 4) {
      setMsg("Use 6+ words or 12+ characters. A numeric PIN is allowed but short PINs are weak against offline guessing.");
      if (!/^\d+$/.test(pass)) return;
    }
    try {
      await enableAppLock(pass);
      setMsg("App Lock on. Your vault is now encrypted on this device. If you forget the passphrase, your data cannot be recovered.");
    } catch (e: any) {
      setMsg(e?.message || "Could not enable App Lock.");
    }
  };
  const doDisable = async () => {
    try {
      await disableAppLock(pass);
      setMsg("App Lock off. Your vault is stored unencrypted on this device again.");
    } catch {
      const n = attempts + 1;
      setAttempts(n);
      setMsg(`Wrong passphrase. Wait ${Math.min(30, n * 2)} seconds before trying again. This protects against casual access, not a determined attacker with your device.`);
    }
  };
  const exportEncrypted = async () => {
    if (!pass) {
      setMsg("Enter a passphrase first to export an encrypted backup.");
      return;
    }
    const payload = await encryptJSON(pass, JSON.parse(exportCycleDataJSON()));
    const blob = new Blob([JSON.stringify({ app: "Feather", encrypted: true, payload }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feather-backup-encrypted.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importAny = async (f: File) => {
    const text = await f.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed.encrypted && isEncryptedPayload(parsed.payload)) {
        if (!pass) {
          setMsg("Enter the backup passphrase, then import again.");
          return;
        }
        const data = await decryptJSON(pass, parsed.payload);
        const res = importCycleDataJSON(JSON.stringify(data));
        setMsg(res.success ? "Encrypted backup imported. Reloading…" : "Import failed.");
        if (res.success) setTimeout(() => window.location.reload(), 500);
        return;
      }
      const res = importCycleDataJSON(text);
      setMsg(res.success ? "Backup imported. Reloading…" : res.error || "Import failed.");
      if (res.success) setTimeout(() => window.location.reload(), 500);
    } catch {
      setMsg("Could not import that backup. Check the passphrase and file.");
    }
  };
  return (
    <div className="liquid-glass-card rounded-[24px] p-6 space-y-4 shadow-sm" id="privacy">
      <h3 className="font-serif text-lg font-semibold text-stone-900">Privacy — App Lock & backups</h3>
      <p className="text-xs text-stone-600 leading-relaxed">
        Cycle data is stored on this device. It is <strong>not encrypted unless App Lock is on</strong>. What leaves this device: audio is sent for transcription, and text is sent to the assistant agent. Cycle dates are not sent unless you ask about them in text.
      </p>
      <p className="text-xs text-amber-950 liquid-glass-card border border-amber-200/80 bg-amber-50/40 rounded-[18px] p-4 font-sans leading-relaxed shadow-xs">
        Forgotten passphrase = your data cannot be recovered. Export a backup first. App Lock protects against casual access, not a determined attacker with your device.
      </p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="liquid-glass-button rounded-full px-4 min-h-[44px] text-xs font-sans font-semibold" onClick={exportBackup}>
          Export backup first (plain JSON)
        </button>
        <button type="button" className="liquid-glass-pill rounded-full px-4 min-h-[44px] text-xs font-sans font-medium" onClick={exportEncrypted}>
          Export encrypted JSON
        </button>
        <label className="liquid-glass-pill rounded-full px-4 min-h-[44px] text-xs inline-flex items-center cursor-pointer font-sans font-medium">
          Import plain or encrypted backup
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importAny(f);
            }}
          />
        </label>
      </div>
      <label className="block text-xs font-sans text-stone-700">
        Passphrase (6+ words or 12+ characters recommended; numeric PIN allowed with the warning above)
        <input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} className="mt-1 w-full liquid-glass-input rounded-xl px-3 py-2 min-h-[44px]" />
      </label>
      <label className="block text-xs font-sans text-stone-700">
        Repeat passphrase
        <input type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} className="mt-1 w-full liquid-glass-input rounded-xl px-3 py-2 min-h-[44px]" />
      </label>
      {weak && <p className="text-xs text-amber-700">That looks weak. Prefer 6+ words or 12+ characters.</p>}
      <div className="flex gap-2 flex-wrap">
        {!lockEnabled ? (
          <button type="button" className="liquid-glass-button rounded-full px-4 min-h-[44px] text-xs font-sans font-semibold" onClick={doEnable}>
            Enable App Lock
          </button>
        ) : (
          <>
            <button type="button" className="liquid-glass-button rounded-full px-4 min-h-[44px] text-xs font-sans font-semibold" onClick={doDisable}>
              Disable App Lock (needs passphrase)
            </button>
            <button type="button" className="liquid-glass-pill rounded-full px-4 min-h-[44px] text-xs font-sans font-medium" onClick={() => lockNow().catch((e: any) => setMsg(e.message))}>
              Lock now
            </button>
          </>
        )}
      </div>
      <label className="block text-xs font-sans text-stone-700">
        Auto-lock after minutes of inactivity{" "}
        <input
          value={autoLock}
          onChange={(e) => {
            setAutoLock(e.target.value);
            try {
              localStorage.setItem("feather_autolock_minutes", e.target.value);
            } catch {}
          }}
          className="liquid-glass-input rounded-xl px-2 py-1 ml-2 w-20 text-center"
          inputMode="numeric"
        />
      </label>
      <label className="flex justify-between text-xs gap-3">
        <span>Lock when tab is hidden</span>
        <input
          type="checkbox"
          className="size-5"
          checked={lockOnHide}
          onChange={(e) => {
            setLockOnHide(e.target.checked);
            try {
              localStorage.setItem("feather_autolock_hidden", e.target.checked ? "true" : "false");
            } catch {}
          }}
        />
      </label>
      <label className="flex justify-between items-center text-xs gap-3">
        <span>Discreet mode (neutral “Notes” title, quick-hide, masked cycle values)</span>
        <input
          type="checkbox"
          className="size-5"
          checked={discreet}
          onChange={(e) => {
            setDiscreet(e.target.checked);
          }}
        />
      </label>
      {discreet && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-stone-600">Discreet mode is active: sensitive values on Dashboard and Chronicle are masked until tapped.</span>
          <button
            type="button"
            onClick={toggleQuickHide}
            className="liquid-glass-pill rounded-full px-3.5 py-1.5 text-xs font-sans font-semibold text-stone-900 shrink-0 cursor-pointer"
          >
            Quick hide now
          </button>
        </div>
      )}
      {msg && (
        <p role="status" className="text-xs text-stone-700">
          {msg}
        </p>
      )}
    </div>
  );
}
