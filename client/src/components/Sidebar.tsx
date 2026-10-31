import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

interface NavItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: (active: boolean) => React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Dashboard",
    shortLabel: "Hero",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    path: "/calendar",
    label: "Calendar",
    shortLabel: "Calendar",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    path: "/voice",
    label: "Voice Capture",
    shortLabel: "Voice",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    path: "/stats",
    label: "Your cycles",
    shortLabel: "Cycles",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    path: "/chronicle",
    label: "Chronicle",
    shortLabel: "History",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10" />
        <path d="M6 10h10" />
      </svg>
    ),
  },
  {
    path: "/vault",
    label: "Local Vault",
    shortLabel: "Vault",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    path: "/scanner",
    label: "Diary Scanner",
    shortLabel: "Scanner",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    path: "/settings",
    label: "Settings",
    shortLabel: "Config",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* ========================================================
          DESKTOP LIQUID GLASS DYNAMIC DOCK (Smooth Hover Expansion)
          ======================================================== */}
      <aside
        data-slot="sidebar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group/sidebar fixed z-40 left-3 md:left-5 hidden md:flex flex-col gap-2 select-none"
        style={{
          top: "max(1.25rem, calc(env(safe-area-inset-top, 0px) + 1rem))",
        }}
      >
        <div
          data-slot="sidebar-card"
          className={`liquid-glass-lens flex flex-col p-1.5 transition-all duration-200 ease-out shadow-lg max-h-[calc(100vh-2.5rem)] overflow-y-auto ${
            isHovered ? "w-[216px] rounded-[24px]" : "w-[58px] rounded-[24px]"
          }`}
        >
          {/* Top Brand Bar */}
          <Link
            to="/"
            className={`flex items-center gap-2.5 rounded-[18px] p-2 text-left relative overflow-hidden cursor-pointer transition-colors ${
              isHovered ? "justify-start" : "justify-center"
            }`}
            aria-label="Feather Home"
          >
            <div className="size-5 shrink-0 flex items-center justify-center text-stone-900">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-5 text-stone-900">
                <line x1="3" y1="17" x2="3" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="7" x2="3" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="10" y1="17" x2="10" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="10" y1="5" x2="10" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="17" y1="17" x2="17" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="17" y1="9" x2="17" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="3" cy="9" r="2" fill="currentColor" />
                <circle cx="10" cy="7" r="2" fill="currentColor" />
                <circle cx="17" cy="11" r="2" fill="currentColor" />
              </svg>
            </div>

            {isHovered && (
              <div className="flex flex-col overflow-hidden animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif text-base font-semibold tracking-tight text-stone-900">
                    Feather
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <span className="font-sans text-[11px] text-stone-500 font-medium whitespace-nowrap">
                  Cycle Companion
                </span>
              </div>
            )}
          </Link>

          {/* Quick Action: Voice Record CTA */}
          <div className="my-1 px-0.5">
            <Link
              to="/voice"
              className={`flex items-center gap-2.5 rounded-[16px] transition-all cursor-pointer liquid-glass-nav-cta font-semibold text-stone-900 ${
                isHovered ? "p-2 justify-start w-full" : "size-10 justify-center mx-auto"
              }`}
              aria-label="Record Log"
              title="Record Log"
            >
              <div className="size-5 shrink-0 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              {isHovered && (
                <span className="font-sans text-[13px] font-semibold truncate animate-in fade-in duration-150 whitespace-nowrap">
                  Record Log
                </span>
              )}
            </Link>
          </div>

          {/* Core Routes Navigation */}
          <nav aria-label="Desktop Navigation" className="flex flex-col gap-1 mt-1 border-t border-black/[0.04] pt-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group/item flex items-center gap-2.5 rounded-[16px] transition-all cursor-pointer ${
                    isHovered ? "p-2 justify-start w-full" : "size-10 justify-center mx-auto"
                  } ${
                    active
                      ? "liquid-glass-nav-active font-bold text-stone-950 shadow-xs"
                      : "liquid-glass-nav-item font-medium"
                  }`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <div className={`size-5 shrink-0 flex items-center justify-center transition-transform ${active ? "scale-105 text-stone-950" : "group-hover/item:scale-105 text-stone-800"}`}>
                    {item.icon(active)}
                  </div>
                  {isHovered && (
                    <span className="font-sans text-[13px] truncate animate-in fade-in duration-150 whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Local Vault Badge Pill */}
        <div
          data-slot="sidebar-badge"
          className={`liquid-glass-lens flex items-center transition-all duration-200 ease-out overflow-hidden shadow-sm ${
            isHovered ? "w-[216px] rounded-[20px] p-2.5 justify-start" : "w-[58px] h-11 rounded-[20px] justify-center p-0 mx-auto"
          }`}
          title="100% On-Device Zero Server Vault"
        >
          <div className="size-6 shrink-0 flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          {isHovered && (
            <div className="flex flex-col text-left pl-2 animate-in fade-in duration-150 whitespace-nowrap">
              <span className="font-sans text-[11px] font-semibold text-stone-800">
                100% On-Device
              </span>
              <span className="font-sans text-[10px] text-stone-500 font-medium">
                Zero Server Vault
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================
          MOBILE BRAND CAPSULE (Discreet Floating Liquid Glass Pill)
          ======================================================== */}
      <div
        className="fixed left-3.5 z-40 md:hidden pointer-events-auto"
        style={{
          top: "max(0.65rem, env(safe-area-inset-top, 0.65rem))",
        }}
      >
        <Link
          to="/"
          className="flex items-center gap-2 rounded-full liquid-glass-topbar px-3.5 py-1.5 shadow-xs cursor-pointer text-stone-900 active:scale-95 transition-transform"
          aria-label="Feather Home"
        >
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-stone-900 shrink-0">
            <line x1="3" y1="17" x2="3" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="7" x2="3" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="17" x2="10" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="5" x2="10" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="17" y1="17" x2="17" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="17" y1="9" x2="17" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="3" cy="9" r="2" fill="currentColor" />
            <circle cx="10" cy="7" r="2" fill="currentColor" />
            <circle cx="17" cy="11" r="2" fill="currentColor" />
          </svg>
          <span className="font-serif text-sm font-semibold tracking-tight text-stone-900">
            Feather
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        </Link>
      </div>

      {/* ========================================================
          MOBILE BOTTOM FLOATING DOCK (Safe-Area Aware)
          ======================================================== */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed left-3 right-3 z-40 flex items-center justify-around rounded-[26px] liquid-glass-dock px-2 py-1.5 md:hidden max-w-lg mx-auto"
        style={{
          bottom: "max(0.6rem, env(safe-area-inset-bottom, 0.6rem))",
        }}
      >
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 rounded-full px-3 py-1 text-xs transition-all cursor-pointer ${
                active
                  ? "liquid-glass-nav-active !py-0.5 text-stone-950 font-bold shadow-xs scale-105"
                  : "liquid-glass-nav-item text-stone-700 hover:text-stone-900 font-medium"
              }`}
              aria-label={item.shortLabel}
            >
              <div className={active ? "text-stone-950" : "text-stone-700"}>
                {item.icon(active)}
              </div>
              <span className="font-sans text-[10px] font-medium tracking-normal">
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
