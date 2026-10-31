import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { loadEvents, upcomingEvents, upsertEvent, type CalendarEvent } from "../lib/events";
import { toEngineRecords } from "../lib/calendarView";
import { evaluateEventOverlap } from "../lib/periodEngine";
import { todayLocal } from "../lib/localDate";
import { OVERLAP_DISCLAIMER, prettyDate } from "../cycleStorage";
import { gradeWindowTrust, formatWindowTrustLine, suggestClearDates, formatClearDatesLine, flowPattern, formatEventPositionLine, symptomEcho, formatSymptomEchoLine, shouldShowClearDates } from "../lib/planInsights";
import { useDiscreetMode } from "../lib/discreetMode";

const LABELS: Record<string, string> = {
  logged: "Logged period",
  likely: "Likely overlap",
  possible: "Possible overlap",
  unlikely: "Unlikely to overlap (estimate)",
  past: "Past",
  unknown: "Unknown — log more cycles",
};

export function PlanAroundIt({ events: eventsProp }: { events?: CalendarEvent[] } = {}) {
  const { data, stats, isDemoActive } = useCycle();
  const [internalEvents, setInternalEvents] = useState(() => loadEvents());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const today = todayLocal();

  useEffect(() => {
    const handler = () => setInternalEvents(loadEvents());
    window.addEventListener("feather_events_changed", handler);
    return () => window.removeEventListener("feather_events_changed", handler);
  }, []);

  useEffect(() => {
    setInternalEvents(loadEvents());
    setSavedNotice(null);
    setSavedIds(new Set());
  }, [isDemoActive]);

  const events = eventsProp !== undefined ? eventsProp : internalEvents;
  const trustLine = formatWindowTrustLine(gradeWindowTrust(stats?.statistics?.allCycleLengths ?? []));
  const pastPattern = useMemo(() => flowPattern(data.periods, data.logs), [data.periods, data.logs]);
  const pastEcho = useMemo(() => symptomEcho(data.periods, data.logs), [data.periods, data.logs]);
  const { isDiscreet } = useDiscreetMode();
  const rows = useMemo(
    () =>
      upcomingEvents(events, today, 120).map((e) => {
        const r = evaluateEventOverlap(e.date, toEngineRecords(data.periods), today);
        return { e, r };
      }),
    [events, data.periods, today],
  );

  const handleSaveToCalendar = (e: CalendarEvent) => {
    const saved = upsertEvent({
      id: e.id,
      title: e.title,
      date: e.date,
      endDate: e.endDate,
      source: e.source || "manual",
    });
    setInternalEvents(loadEvents());
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.add(saved.id);
      return next;
    });
    setSavedNotice(`Event "${saved.title}" on ${prettyDate(saved.date)} (${saved.date}) saved to calendar.`);
  };

  if (!rows.length)
    return (
      <div className="liquid-glass-card rounded-[24px] p-5 text-xs text-stone-600">
        No upcoming events in the next 120 days. Add an event from the calendar to check overlap.{" "}
        <p data-testid="window-trust" className="mt-2">{trustLine}</p>
        <p className="mt-2">{OVERLAP_DISCLAIMER}</p>
      </div>
    );

  return (
    <div className="liquid-glass-card rounded-[24px] p-5 space-y-3">
      <h3 className="font-serif text-lg font-semibold">Plan Around It</h3>
      <p data-testid="window-trust" className="text-[11px] text-stone-500">{trustLine}</p>
      {savedNotice && (
        <div
          role="status"
          className="rounded-[16px] liquid-glass-card border border-emerald-200/80 bg-emerald-50/40 px-3.5 py-2.5 text-xs text-emerald-950 font-sans flex items-center justify-between gap-2"
        >
          <span className="font-semibold">{savedNotice}</span>
          <Link to="/calendar" className="underline font-semibold text-emerald-900 shrink-0">
            View in Calendar →
          </Link>
        </div>
      )}
      {rows.map(({ e, r }) => {
        const clearLine = shouldShowClearDates(r.status) ? formatClearDatesLine(suggestClearDates(e.date, toEngineRecords(data.periods), today, stats?.statistics?.allCycleLengths ?? [])) : "";
        const positionLine = formatEventPositionLine(e.date, r.window, pastPattern);
        const echoLine = isDiscreet ? "" : formatSymptomEchoLine(e.date, r.window, pastEcho);
        const cleanNote = (r.note || "").replace(
          /^(Likely overlap|Possible overlap|Unlikely to overlap \(estimate\)):\s*/i,
          "",
        );
        const isConfirmed = savedIds.has(e.id);
        return (
          <div
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/50 pb-2 text-xs"
          >
            <div>
              <span className="font-semibold">{e.title}</span>{" "}
              <span className="text-stone-500">{e.date}</span>
              <span className="block text-stone-600">
                {LABELS[r.status] || r.status}
                {cleanNote ? ` · ${cleanNote}` : r.window ? ` · window ${r.window.start} to ${r.window.end}` : ""}
              </span>
              {clearLine && <span className="block text-stone-600">{clearLine}</span>}
              {positionLine && <span className="block text-stone-600">{positionLine}</span>}
              {echoLine && <span className="block text-stone-600">{echoLine}</span>}
            </div>
            <button
              type="button"
              className="liquid-glass-button rounded-full px-3 py-1.5 min-h-[44px]"
              onClick={() => handleSaveToCalendar(e)}
            >
              {isConfirmed ? "Saved to calendar ✓" : "Add to calendar"}
            </button>
          </div>
        );
      })}
      <p className="text-[11px] text-stone-500">{OVERLAP_DISCLAIMER}</p>
    </div>
  );
}
