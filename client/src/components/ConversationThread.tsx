import React from "react";
import { prettyDate } from "../cycleStorage";

/** Show "Fri, Sep 4" instead of "2026-09-04" in Feather's replies (display only;
 *  the stored data and the agent's text are unchanged). Each date is a <time>
 *  element whose dateTime keeps the exact ISO day for assistive tech. The year is
 *  shown when it is not the current one, so older entries stay unambiguous. */
export function humanizeDates(text: string | null | undefined): React.ReactNode {
  if (!text) return text || "";
  const thisYear = String(new Date().getFullYear());
  const re = /\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const iso = m[0];
    const pretty = prettyDate(iso);
    if (pretty === "\u2014" || /Invalid/.test(pretty)) continue;
    out.push(text.slice(last, m.index));
    out.push(<time key={m.index} dateTime={iso}>{m[1] === thisYear ? pretty : pretty + ", " + m[1]}</time>);
    last = m.index + iso.length;
  }
  if (out.length === 0) return text;
  out.push(text.slice(last));
  return out;
}

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
    <div className="flex justify-start">
      <div className="min-w-0 max-w-full sm:max-w-2xl liquid-glass-card rounded-[22px] p-4 sm:p-5 shadow-xs">
        <span className="font-sans text-[11px] font-semibold text-stone-500 block">Feather</span>
        <p className="font-sans text-sm text-stone-800 leading-relaxed break-words">{humanizeDates(text)}</p>
      </div>
    </div>
  );
}

export function FeatherTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="min-w-0 flex-1 max-w-full sm:max-w-2xl space-y-3">
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
