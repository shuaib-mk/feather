import { useState, useEffect, useCallback } from "react";

export const DISCREET_STORAGE_KEY = "feather_discreet";
export const QUICK_HIDE_STORAGE_KEY = "feather_quick_hidden";
export const DEFAULT_APP_TITLE = "Feather — Voice-First Menstrual Cycle Companion";
export const DISCREET_APP_TITLE = "Notes";

export function isDiscreetModeEnabled(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(DISCREET_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setDiscreetModeEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DISCREET_STORAGE_KEY, enabled ? "true" : "false");
    }
    if (!enabled && typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(QUICK_HIDE_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
  if (typeof document !== "undefined") {
    document.title = enabled ? DISCREET_APP_TITLE : DEFAULT_APP_TITLE;
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event("feather_discreet_changed"));
  }
}

export function isQuickHideActive(): boolean {
  try {
    return (
      isDiscreetModeEnabled() &&
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(QUICK_HIDE_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function setQuickHideActive(hidden: boolean): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      if (hidden) sessionStorage.setItem(QUICK_HIDE_STORAGE_KEY, "1");
      else sessionStorage.removeItem(QUICK_HIDE_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event("feather_discreet_changed"));
  }
}

export function useDiscreetMode() {
  const [isDiscreet, setIsDiscreetState] = useState<boolean>(() => isDiscreetModeEnabled());
  const [isQuickHidden, setIsQuickHiddenState] = useState<boolean>(() => isQuickHideActive());

  useEffect(() => {
    const sync = () => {
      const d = isDiscreetModeEnabled();
      setIsDiscreetState(d);
      setIsQuickHiddenState(isQuickHideActive());
      if (typeof document !== "undefined") {
        document.title = d ? DISCREET_APP_TITLE : DEFAULT_APP_TITLE;
      }
    };
    sync();
    window.addEventListener("feather_discreet_changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("feather_discreet_changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setDiscreet = useCallback((enabled: boolean) => {
    setDiscreetModeEnabled(enabled);
    setIsDiscreetState(enabled);
    if (!enabled) setIsQuickHiddenState(false);
  }, []);

  const toggleQuickHide = useCallback(() => {
    const next = !isQuickHideActive();
    setQuickHideActive(next);
    setIsQuickHiddenState(next);
  }, []);

  return {
    isDiscreet,
    isQuickHidden,
    setDiscreet,
    toggleQuickHide,
  };
}
