import React from "react";

/** Compact chat bubbles for the unified Voice conversation.
 *  One shared glassmorphism language: user right/violet, Feather left/white
 *  glass with avatar + label, system centered. Frontend-only styling. */

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-[75%] liquid-glass-user rounded-[20px] rounded-br-md px-4 py-2.5 shadow-xs">
        <p className="font-sans text-sm text-stone-900 leading-relaxed break-words">{text}</p>
      </div>
    </div>
  );
}

export function FeatherBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start gap-2">
      <span aria-hidden="true" className="mt-1 size-6 shrink-0 rounded-full bg-violet-300/70 border border-white/70 shadow-xs" />
      <div className="min-w-0 max-w-full sm:max-w-2xl liquid-glass-card rounded-[22px] p-4 sm:p-5 shadow-xs">
        <span className="font-sans text-[11px] font-semibold text-stone-500 block">Feather</span>
        <p className="font-sans text-sm text-stone-800 leading-relaxed break-words">{text}</p>
      </div>
    </div>
  );
}

export function FeatherTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start gap-2">
      <span aria-hidden="true" className="mt-1 size-6 shrink-0 rounded-full bg-violet-300/70 border border-white/70 shadow-xs" />
      <div className="min-w-0 flex-1 max-w-full sm:max-w-2xl space-y-3">
        <span className="font-sans text-[11px] font-semibold text-stone-500 block">Feather</span>
        {children}
      </div>
    </div>
  );
}

export function SystemBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <div className="max-w-full rounded-full px-4 py-2 text-center">{children}</div>
    </div>
  );
}
