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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
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
          DESKTOP LIQUID GLASS FLOATING DOCK (120Hz Hardware Composited)
          ======================================================== */}
      <aside
        data-slot="sidebar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group/sidebar fixed z-40 top-6 left-4 md:left-6 hidden md:flex flex-col gap-2.5 select-none"
        style={{ willChange: "transform", transform: "translateZ(0)" }}
      >
        <div
          data-slot="sidebar-card"
          className={`liquid-glass-lens flex flex-col p-1.5 transition-[width,border-radius,box-shadow] duration-200 ease-out ${
            isHovered ? "w-[216px] rounded-[24px]" : "w-13 rounded-[24px]"
          }`}
        >
          {/* Top Brand Bar */}
          <Link
            to="/"
            className="flex w-full items-center gap-2.5 rounded-[18px] p-2 text-left relative overflow-hidden cursor-pointer"
          >
            <div className="size-5 shrink-0 flex items-center justify-center">
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

            <div className={`flex flex-col overflow-hidden transition-opacity duration-200 ${isHovered ? "opacity-100 block" : "opacity-0 hidden"}`}>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-base font-semibold tracking-tight text-stone-900">
                  Feather
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="font-sans text-[11px] text-stone-500 font-medium">
                Cycle Companion
              </span>
            </div>
          </Link>

          {/* Quick Action: Voice Record CTA */}
          <div className="my-1 px-0.5">
            <Link
              to="/voice"
              className={`flex w-full items-center gap-2.5 rounded-[16px] p-2 transition-all cursor-pointer ${
                isHovered
                  ? "liquid-glass-button justify-start font-semibold text-stone-900"
                  : "justify-center text-stone-800 hover:bg-black/[0.04]"
              }`}
            >
              <div className="size-5 shrink-0 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <span className={`font-sans text-[13px] font-medium truncate transition-opacity duration-200 ${isHovered ? "opacity-100 block" : "opacity-0 hidden"}`}>
                Record Log
              </span>
            </Link>
          </div>

          {/* Core Routes Navigation */}
          <nav aria-label="Desktop Navigation" className="flex flex-col gap-0.5 mt-1 border-t border-black/[0.04] pt-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group/item flex w-full items-center gap-2.5 rounded-[16px] p-2 transition-all cursor-pointer ${
                    active
                      ? "liquid-glass-pill bg-white text-stone-950 font-semibold shadow-2xs"
                      : "text-stone-700 hover:bg-black/[0.04] hover:text-stone-950"
                  }`}
                  aria-label={item.label}
                >
                  <div className="size-5 shrink-0 flex items-center justify-center text-stone-800">
                    {item.icon(active)}
                  </div>
                  <span className={`font-sans text-[13px] truncate transition-opacity duration-200 ${isHovered ? "opacity-100 block" : "opacity-0 hidden"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Local Vault Badge Pill */}
        <div
          data-slot="sidebar-badge"
          className={`liquid-glass-lens flex items-center transition-[width,border-radius] duration-200 ease-out overflow-hidden ${
            isHovered ? "w-[216px] rounded-[20px] px-3 py-2" : "w-13 h-10 rounded-full justify-center p-0"
          }`}
        >
          <div className="size-6 shrink-0 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className={`flex flex-col text-left pl-2.5 transition-opacity duration-200 ${isHovered ? "opacity-100 block" : "opacity-0 hidden"}`}>
            <span className="font-sans text-[11px] font-semibold text-stone-800">
              100% On-Device
            </span>
            <span className="font-sans text-[10px] text-stone-500 font-medium">
              Zero Server Vault
            </span>
          </div>
        </div>
      </aside>

      {/* ========================================================
          MOBILE TOP BAR (Safe-Area Aware)
          ======================================================== */}
      <header
        className="fixed left-3 right-3 z-40 flex items-center justify-between rounded-[22px] liquid-glass-topbar px-4 py-2.5 md:hidden max-w-lg mx-auto"
        style={{
          top: "max(0.6rem, env(safe-area-inset-top, 0.6rem))",
        }}
      >
        <Link to="/" className="flex items-center gap-2 cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-stone-900">
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
          <span className="font-serif text-base font-semibold tracking-tight text-stone-900">
            Feather
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            to="/voice"
            className="liquid-glass-pill px-3 py-1.5 font-sans text-xs font-semibold text-stone-900 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            aria-label="Voice Capture"
          >
            <span className="size-1.5 rounded-full bg-rose-500" />
            <span>Voice</span>
          </Link>
          <Link
            to="/settings"
            className="liquid-glass-pill p-2 text-stone-700 hover:text-stone-950 cursor-pointer"
            aria-label="Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </header>

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
              className={`flex flex-col items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all cursor-pointer ${
                active
                  ? "text-stone-950 font-bold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
              aria-label={item.shortLabel}
            >
              <div className={active ? "text-stone-950" : "text-stone-500"}>
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
