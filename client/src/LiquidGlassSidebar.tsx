import React, { useState } from "react";

interface LiquidGlassSidebarProps {
  activeSection: string;
  onSelectSection: (section: string) => void;
  onOpenDocs: () => void;
  onOpenCredits: () => void;
  onNewChat: () => void;
  onOpenDiary?: () => void;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
}

export function LiquidGlassSidebar({
  activeSection,
  onSelectSection,
  onOpenDocs,
  onOpenCredits,
  onNewChat,
  onOpenDiary,
  isRecording = false,
  onStartRecording,
  onStopRecording,
}: LiquidGlassSidebarProps) {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Expanded on desktop if hovered or if menu is open
  const isExpanded = isHovered || userMenuOpen;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleMobileNav = (sectionId: string) => {
    onSelectSection(sectionId);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-full border border-stone-200/90 liquid-glass-pill px-4 py-2 font-sans text-xs font-medium text-stone-900 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================
          DESKTOP 2-ISLAND LIQUID GLASS FLOATING DOCK (120Hz Optimized)
          ======================================================== */}
      <aside
        data-slot="sidebar"
        data-expanded={isExpanded}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setUserMenuOpen(false);
        }}
        className="group/sidebar fixed z-40 top-8 left-4 md:left-8 hidden md:flex flex-col gap-2.5 select-none"
        style={{ willChange: "transform", transform: "translateZ(0)" }}
      >
        {/* ========================================================
            ISLAND 1: BRAND HEADER & NAVIGATION ITEMS
            ======================================================== */}
        <div
          data-slot="sidebar-card"
          className={`liquid-glass-lens flex flex-col p-1.5 transition-[width,border-radius,box-shadow] duration-200 ease-out ${
            isExpanded ? "w-[210px] rounded-[24px]" : "w-12 rounded-[24px]"
          }`}
        >
          {/* Top Brand Bar: Sliders Icon + Feather Text */}
          <button
            type="button"
            onClick={() => onSelectSection("dashboard")}
            className="flex w-full items-center gap-2.5 rounded-[18px] p-2 text-left relative overflow-hidden group/item cursor-pointer"
          >
            {/* Tuning Sliders Icon */}
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

            <div className={`flex flex-col overflow-hidden transition-opacity duration-200 ${isExpanded ? "opacity-100 block" : "opacity-0 hidden"}`}>
              <div className="flex items-center gap-1.5">
                <span className="font-sans text-sm font-semibold tracking-tight text-stone-900">
                  Feather
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">
                Meta Model AI
              </span>
            </div>
          </button>

          {/* Quick Action: New Audio / Voice Log Button */}
          <div className="my-1 px-0.5">
            <button
              type="button"
              onClick={() => {
                onSelectSection("process-console");
                onNewChat();
              }}
              className={`flex w-full items-center gap-2.5 rounded-[16px] p-2 transition-all cursor-pointer ${
                isExpanded
                  ? "liquid-glass-button-dark justify-start"
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
              <span className={`font-sans text-[13px] font-medium truncate transition-opacity duration-200 ${isExpanded ? "opacity-100 block" : "opacity-0 hidden"}`}>
                Voice Capture
              </span>
            </button>
          </div>

          {/* Core Navigation Items */}
          <nav className="flex flex-col gap-0.5 mt-1 border-t border-black/[0.04] pt-1">
            {/* Overview / Dashboard */}
            <button
              type="button"
              onClick={() => onSelectSection("dashboard")}
              className={`group/item flex w-full items-center gap-2.5 rounded-[16px] p-2 transition-all cursor-pointer ${
                activeSection === "dashboard"
                  ? "liquid-glass-pill bg-white text-stone-950 font-medium shadow-xs"
                  : "text-stone-700 hover:bg-black/[0.04] hover:text-stone-950"
              }`}
            >
              <div className="size-5 shrink-0 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="7" height="9" x="3" y="3" rx="1" />
                  <rect width="7" height="5" x="14" y="3" rx="1" />
                  <rect width="7" height="9" x="14" y="12" rx="1" />
                  <rect width="7" height="5" x="3" y="16" rx="1" />
                </svg>
              </div>
              <span className={`font-sans text-[13px] truncate transition-opacity duration-200 ${isExpanded ? "opacity-100 block" : "opacity-0 hidden"}`}>
                Dashboard
              </span>
            </button>

            {/* Voice Console */}
            <button
              type="button"
              onClick={() => onSelectSection("process-console")}
              className={`group/item flex w-full items-center gap-2.5 rounded-[16px] p-2 transition-all cursor-pointer ${
                activeSection === "process-console"
                  ? "liquid-glass-pill bg-white text-stone-950 font-medium shadow-xs"
                  : "text-stone-700 hover:bg-black/[0.04] hover:text-stone-950"
              }`}
            >
              <div className="size-5 shrink-0 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className={`font-sans text-[13px] truncate transition-opacity duration-200 ${isExpanded ? "opacity-100 block" : "opacity-0 hidden"}`}>
                Voice Console
              </span>
            </button>

            {/* Foresight Matrix (Chronobiology) */}
            <button
              type="button"
              onClick={() => onSelectSection("plate-02")}
              className={`group/item flex w-full items-center gap-2.5 rounded-[16px] p-2 transition-all cursor-pointer ${
                activeSection === "plate-02"
                  ? "liquid-glass-pill bg-white text-stone-950 font-medium shadow-xs"
                  : "text-stone-700 hover:bg-black/[0.04] hover:text-stone-950"
              }`}
            >
              <div className="size-5 shrink-0 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <span className={`font-sans text-[13px] truncate transition-opacity duration-200 ${isExpanded ? "opacity-100 block" : "opacity-0 hidden"}`}>
                Foresight Matrix
              </span>
            </button>

            {/* Chronicle / Historical Logs */}
            <button
              type="button"
              onClick={() => onSelectSection("chronicle")}
              className={`group/item flex w-full items-center gap-2.5 rounded-[16px] p-2 transition-all cursor-pointer ${
                activeSection === "chronicle"
                  ? "liquid-glass-pill bg-white text-stone-950 font-medium shadow-xs"
                  : "text-stone-700 hover:bg-black/[0.04] hover:text-stone-950"
              }`}
            >
              <div className="size-5 shrink-0 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                  <path d="M6 6h10" />
                  <path d="M6 10h10" />
                </svg>
              </div>
              <span className={`font-sans text-[13px] truncate transition-opacity duration-200 ${isExpanded ? "opacity-100 block" : "opacity-0 hidden"}`}>
                Chronicle
              </span>
            </button>

            {/* Physical Diary Scan (Vision) */}
            {onOpenDiary && (
              <button
                type="button"
                onClick={onOpenDiary}
                className="group/item flex w-full items-center gap-2.5 rounded-[16px] p-2 text-stone-700 hover:bg-black/[0.04] hover:text-stone-950 transition-all cursor-pointer"
              >
                <div className="size-5 shrink-0 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <span className={`font-sans text-[13px] truncate transition-opacity duration-200 ${isExpanded ? "opacity-100 block" : "opacity-0 hidden"}`}>
                  Diary Scanner
                </span>
              </button>
            )}

            {/* Developer Docs & AI Models */}
            <button
              type="button"
              onClick={onOpenDocs}
              className="group/item flex w-full items-center gap-2.5 rounded-[16px] p-2 text-stone-700 hover:bg-black/[0.04] hover:text-stone-950 transition-all cursor-pointer"
            >
              <div className="size-5 shrink-0 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="m10 13-2 2 2 2" />
                  <path d="m14 17 2-2-2-2" />
                </svg>
              </div>
              <span className={`font-sans text-[13px] truncate transition-opacity duration-200 ${isExpanded ? "opacity-100 block" : "opacity-0 hidden"}`}>
                Architecture
              </span>
            </button>
          </nav>
        </div>

        {/* ========================================================
            ISLAND 2: USER PROFILE & SETTINGS MENU
            ======================================================== */}
        <div
          data-slot="sidebar-card"
          className={`liquid-glass-lens flex flex-col transition-[width,border-radius,box-shadow] duration-200 ease-out overflow-hidden ${
            isExpanded ? "w-[210px] rounded-[24px] p-2" : "w-12 h-12 rounded-full p-0 items-center justify-center"
          }`}
        >
          {/* Avatar Profile Trigger */}
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`flex items-center rounded-[16px] transition-colors cursor-pointer ${
              isExpanded
                ? "w-full gap-2.5 p-1.5 text-stone-800 hover:text-stone-950"
                : "w-full h-full justify-center"
            }`}
          >
            {/* User Avatar Silhouette */}
            <div className="size-7 shrink-0 flex items-center justify-center rounded-full bg-stone-900 text-white shadow-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>

            <div className={`flex flex-col text-left transition-opacity duration-200 ${isExpanded ? "opacity-100 block" : "opacity-0 hidden"}`}>
              <span className="font-sans text-[13px] font-medium text-stone-800 truncate">
                Personal Vault
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-600">
                Local Only
              </span>
            </div>
          </button>

          {/* User Menu Dropdown (Settings, Help, Lock) */}
          {isExpanded && userMenuOpen && (
            <div className="flex flex-col gap-1 mt-1 pt-1.5 border-t border-black/[0.04] animate-in fade-in duration-150">
              {/* Cycle Settings Item */}
              <button
                type="button"
                onClick={onOpenCredits}
                className="flex w-full items-center gap-2.5 rounded-[14px] liquid-glass-pill p-2 text-left font-sans text-[13px] font-medium text-stone-900 transition-colors cursor-pointer shadow-xs"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>Cycle Settings</span>
              </button>

              {/* Architecture & AI Models */}
              <button
                type="button"
                onClick={onOpenDocs}
                className="flex w-full items-center gap-2.5 rounded-[14px] p-2 text-left font-sans text-[13px] text-stone-700 hover:bg-black/[0.04] hover:text-stone-950 transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>AI Documentation</span>
              </button>

              {/* Lock Vault */}
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  showToast("Personal vault secured");
                }}
                className="flex w-full items-center gap-2.5 rounded-[14px] p-2 text-left font-sans text-[13px] text-stone-600 hover:bg-black/[0.04] transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Lock Vault</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================
          MOBILE FLOATING LIQUID GLASS TOP BAR (Safe-Area Aware)
          ======================================================== */}
      <header
        className="fixed left-3 right-3 z-50 flex items-center justify-between rounded-[24px] liquid-glass-lens px-4 py-2.5 md:hidden shadow-lg border border-white/80 max-w-md mx-auto"
        style={{
          position: "fixed",
          top: "max(0.75rem, env(safe-area-inset-top, 0.75rem))",
          left: "0.75rem",
          right: "0.75rem",
          zIndex: 50,
        }}
      >
        {/* Brand Trigger */}
        <button
          type="button"
          onClick={() => handleMobileNav("dashboard")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-stone-900">
            <line x1="3" y1="17" x2="3" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="7" x2="3" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="17" x2="10" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="5" x2="10" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="17" y1="17" x2="17" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="3" cy="9" r="2" fill="currentColor" />
            <circle cx="10" cy="7" r="2" fill="currentColor" />
            <circle cx="17" cy="11" r="2" fill="currentColor" />
          </svg>
          <span className="font-sans text-sm font-semibold tracking-tight text-stone-900">
            Feather
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onOpenDiary && (
            <button
              type="button"
              onClick={onOpenDiary}
              className="liquid-glass-pill p-2 text-stone-800 cursor-pointer"
              aria-label="Scan Diary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCredits}
            className="liquid-glass-pill p-2 text-stone-800 cursor-pointer"
            aria-label="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ========================================================
          MOBILE FLOATING LIQUID GLASS BOTTOM DOCK (Safe-Area Aware)
          ======================================================== */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed left-3 right-3 z-50 flex items-center justify-around rounded-[28px] liquid-glass-lens px-2 py-1.5 md:hidden shadow-2xl backdrop-blur-2xl border border-white/90 max-w-md mx-auto"
        style={{
          position: "fixed",
          bottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
          left: "0.75rem",
          right: "0.75rem",
          zIndex: 50,
        }}
      >
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => handleMobileNav("dashboard")}
          className={`flex flex-col items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all cursor-pointer ${
            activeSection === "dashboard"
              ? "text-stone-950 font-bold"
              : "text-stone-500 hover:text-stone-800"
          }`}
          aria-label="Hero Log"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activeSection === "dashboard" ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
          <span className="font-mono text-[9px] uppercase tracking-wider">Hero Log</span>
        </button>

        {/* Foresight Matrix */}
        <button
          type="button"
          onClick={() => handleMobileNav("plate-02")}
          className={`flex flex-col items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all cursor-pointer ${
            activeSection === "plate-02"
              ? "text-stone-950 font-bold"
              : "text-stone-500 hover:text-stone-800"
          }`}
          aria-label="Foresight"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activeSection === "plate-02" ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
            <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
          </svg>
          <span className="font-mono text-[9px] uppercase tracking-wider">Foresight</span>
        </button>

        {/* Center Mic Action Button (Direct Voice Capture Toggle) */}
        <button
          type="button"
          onClick={() => {
            if (isRecording && onStopRecording) {
              onStopRecording();
            } else if (onStartRecording) {
              onSelectSection("process-console");
              onStartRecording();
            } else {
              onSelectSection("process-console");
              onNewChat();
            }
          }}
          className={`h-12 w-12 -mt-4 rounded-full flex items-center justify-center shadow-xl border border-white active:scale-95 transition-all cursor-pointer shrink-0 ${
            isRecording
              ? "bg-rose-500 text-white animate-pulse shadow-[0_0_24px_rgba(244,63,94,0.7)] scale-105"
              : "liquid-glass-lens text-stone-900 hover:scale-105"
          }`}
          aria-label={isRecording ? "Stop Recording" : "Voice Capture"}
        >
          {isRecording ? (
            <span className="h-3.5 w-3.5 rounded-xs bg-white" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-stone-900">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </button>

        {/* Chronicle */}
        <button
          type="button"
          onClick={() => handleMobileNav("chronicle")}
          className={`flex flex-col items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all cursor-pointer ${
            activeSection === "chronicle"
              ? "text-stone-950 font-bold"
              : "text-stone-500 hover:text-stone-800"
          }`}
          aria-label="Chronicle"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activeSection === "chronicle" ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M8 7h8" />
            <path d="M8 11h6" />
          </svg>
          <span className="font-mono text-[9px] uppercase tracking-wider">Chronicle</span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenCredits}
          className="flex flex-col items-center gap-1 rounded-full px-2.5 py-1 text-xs text-stone-500 hover:text-stone-800 transition-all cursor-pointer"
          aria-label="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="font-mono text-[9px] uppercase tracking-wider">Settings</span>
        </button>
      </nav>
    </>
  );
}
