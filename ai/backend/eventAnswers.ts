import { fuzzyMatchEvents, loadEvents } from "../../client/src/lib/events";
import type { CalendarEvent } from "../../client/src/lib/events";
import { addDaysToKey, todayLocal } from "../../client/src/lib/localDate";
import { evaluateEventOverlap, type PeriodRecord } from "../../client/src/lib/periodEngine";
import { OVERLAP_DISCLAIMER_TEXT } from "./ownDataAnswer";
import { isOwnEventsQuestion, isOverlapQuestion } from "./intent";
export interface OwnEventsContext {
  events?: Array<{ title: string; date: string; endDate?: string | null }> | null;
  periods?: Array<{ startDate: string; endDate?: string | null }>;
  cycleStats?: { lastPeriodStart?: string | null };
  today?: string;
}

export interface OwnEventsResult {
  kind: "own_data_answer";
  message: string;
  usedLiveModel: false;
}

const EVENT_TOPIC_SRC =
  "exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|shaadi|sangeet";

function cleanKeyword(s: string): string | null {
  const t = s
    .toLowerCase()
    .replace(/[?.!]+$/g, "")
    .replace(/^(an?\s+|the\s+|my\s+)/, "")
    .trim();
  if (!t || /^(anything|something|events?|plans?|coming|up|next\s+week|this\s+week|tomorrow)$/.test(t)) return null;
  return t;
}

function extractKeyword(text: string): string | null {
  let m =
    text.match(/\bis\s+there\s+any\s+(.+?)\s+coming\b/i) ||
    text.match(/\bare\s+there\s+any\s+(.+?)\s+coming\b/i);
  if (m) return cleanKeyword(m[1]);
  m = text.match(
    /\bdo\s+i\s+have\s+(?:an?\s+|any\s+)?(.+?)\s+(?:coming\s+up|coming|this\s+week|tomorrow|next\s+(?:week|month)|on\s+my\s+calendar)\b/i,
  );
  if (m) return cleanKeyword(m[1]);
  m = text.match(/\bwhen's?(?:\s+is)?\s+my\s+(.+?)[?.!]*$/i) || text.match(/\bwhen\s+is\s+my\s+(.+?)[?.!]*$/i);
  if (m) return cleanKeyword(m[1]);
  m = text.match(/([a-z]+)\s+kab\s+hai\b/i);
  if (m) return m[1].toLowerCase();
  m = text.match(new RegExp("\\b(" + EVENT_TOPIC_SRC + ")s?\\b", "i"));
  if (m && (isOverlapQuestion(text) || /\bexam\b/i.test(text))) return m[1].toLowerCase();
  return null;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function label(key: string): string {
  return SHORT_MONTHS[parseInt(key.slice(5, 7), 10) - 1] + " " + parseInt(key.slice(8, 10), 10);
}

function fmt(ev: { title: string; date: string; endDate?: string | null }): string {
  const base = ev.title + " on " + label(ev.date);
  return ev.endDate && ev.endDate !== ev.date ? base + " to " + label(ev.endDate) : base;
}

function upcomingFirst<T extends { date: string; endDate?: string | null }>(list: T[], today: string): T[] {
  const up = (e: T): boolean => (e.endDate || e.date) >= today;
  return [...list].sort((a, b) => Number(up(b)) - Number(up(a)) || a.date.localeCompare(b.date));
}

function recordsFor(ctx: OwnEventsContext): PeriodRecord[] {
  const starts = [...(ctx.periods || []).map((p) => p.startDate).filter(Boolean)];
  if (ctx.cycleStats && ctx.cycleStats.lastPeriodStart) starts.push(ctx.cycleStats.lastPeriodStart);
  return [...new Set(starts)].map((s, i) => ({
    id: "ctx-" + i,
    startDate: s,
    endDate: undefined,
    confirmed: true,
    source: "manual" as const,
    createdAt: "",
    updatedAt: "",
  }));
}

const OVERLAP_RANK: Record<string, number> = {
  past: 0,
  unlikely: 1,
  unknown: 2,
  possible: 3,
  likely: 4,
  "period-day": 5,
  logged: 5,
};

function overlapNoteFor(
  ev: { title: string; date: string; endDate?: string | null },
  records: PeriodRecord[],
  today: string,
): string {
  let best = evaluateEventOverlap(ev.date, records, today);
  if (ev.endDate && ev.endDate > ev.date) {
    let d = addDaysToKey(ev.date, 1);
    let guard = 0;
    while (d <= ev.endDate && guard < 366) {
      const r = evaluateEventOverlap(d, records, today);
      if ((OVERLAP_RANK[r.status] ?? 0) > (OVERLAP_RANK[best.status] ?? 0)) best = r;
      d = addDaysToKey(d, 1);
      guard++;
    }
  }
  return best.note;
}

function rangeFor(text: string, today: string): { start: string; end: string; label: string } | null {
  if (/\btomorrow\b/i.test(text)) {
    const d = addDaysToKey(today, 1);
    return { start: d, end: d, label: "tomorrow" };
  }
  if (/\bthis\s+week\b/i.test(text)) return { start: today, end: addDaysToKey(today, 7), label: "this week" };
  if (/\bnext\s+week\b/i.test(text)) {
    return { start: addDaysToKey(today, 7), end: addDaysToKey(today, 14), label: "next week" };
  }
  if (/\bnext\s+month\b/i.test(text)) {
    let y = parseInt(today.slice(0, 4), 10);
    let m = parseInt(today.slice(5, 7), 10) + 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
    const first = y + "-" + String(m).padStart(2, "0") + "-01";
    let nm = m + 1;
    let ny = y;
    if (nm === 13) {
      nm = 1;
      ny += 1;
    }
    const last = addDaysToKey(ny + "-" + String(nm).padStart(2, "0") + "-01", -1);
    return { start: first, end: last, label: "next month" };
  }
  return null;
}

function countSuffix(n: number): string {
  return n > 0 ? " You have " + n + " upcoming event" + (n === 1 ? "" : "s") + "." : "";
}

function noMatchMessage(kw: string, upcomingCount: number): string {
  return (
    "I don't see an event matching '" +
    kw +
    "' in your calendar. Add one by saying '" +
    kw +
    " on Nov 20'." +
    countSuffix(upcomingCount)
  );
}

export function buildOwnEventsAnswer(text: string, ctx: OwnEventsContext): OwnEventsResult | null {
  if (!isOwnEventsQuestion(text)) return null;
  const today = ctx.today || todayLocal();
  let pool: CalendarEvent[];
  try {
    const src = ctx.events ? ctx.events : loadEvents();
    pool = (src || []).map((e: any) => ({
      id: e.id || e.title + "@" + e.date,
      title: String(e.title),
      date: e.date,
      endDate: e.endDate,
      source: e.source || "manual",
    }));
  } catch {
    pool = [];
  }
  const upcoming = pool
    .filter((e) => (e.endDate || e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = pool
    .filter((e) => (e.endDate || e.date) < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const kwRaw = extractKeyword(text);
  const nextOnly = kwRaw === "next event";

  if (isOverlapQuestion(text)) {
    const topic = kwRaw;
    const matches = topic ? upcomingFirst(fuzzyMatchEvents(topic, pool), today) : [];
    if (!matches.length) {
      const shown = topic || "that";
      return { kind: "own_data_answer", message: noMatchMessage(shown, upcoming.length), usedLiveModel: false };
    }
    const ev = matches[0];
    const note = overlapNoteFor(ev, recordsFor(ctx), today);
    return {
      kind: "own_data_answer",
      message: fmt(ev) + ": " + note + " " + OVERLAP_DISCLAIMER_TEXT,
      usedLiveModel: false,
    };
  }

  const kw = nextOnly ? null : kwRaw;
  if (kw) {
    const matches = upcomingFirst(fuzzyMatchEvents(kw, pool), today);
    if (!matches.length) {
      return { kind: "own_data_answer", message: noMatchMessage(kw, upcoming.length), usedLiveModel: false };
    }
    return {
      kind: "own_data_answer",
      message: matches.map(fmt).join("; "),
      usedLiveModel: false,
    };
  }

  if (nextOnly) {
    if (!upcoming.length) {
      let msg = "Nothing coming up in your calendar.";
      if (past.length) msg += " You have " + past.length + " past event" + (past.length === 1 ? "" : "s") + ".";
      return { kind: "own_data_answer", message: msg, usedLiveModel: false };
    }
    return {
      kind: "own_data_answer",
      message: "Your next event is " + fmt(upcoming[0]) + ".",
      usedLiveModel: false,
    };
  }

  const range = rangeFor(text, today);
  if (range) {
    const inRange = upcoming.filter((e) => e.date <= range.end && (e.endDate || e.date) >= range.start);
    if (!inRange.length) {
      return {
        kind: "own_data_answer",
        message: "Nothing " + range.label + " in your calendar." + countSuffix(upcoming.length),
        usedLiveModel: false,
      };
    }
    const cap = range.label.charAt(0).toUpperCase() + range.label.slice(1);
    return {
      kind: "own_data_answer",
      message: cap + ": " + inRange.map(fmt).join("; "),
      usedLiveModel: false,
    };
  }

  if (!upcoming.length) {
    let msg = "Nothing coming up in your calendar.";
    if (past.length) msg += " You have " + past.length + " past event" + (past.length === 1 ? "" : "s") + ".";
    return { kind: "own_data_answer", message: msg, usedLiveModel: false };
  }
  if (/\bhow\s+many\b/i.test(text)) {
    return {
      kind: "own_data_answer",
      message:
        "You have " +
        upcoming.length +
        " upcoming event" +
        (upcoming.length === 1 ? "" : "s") +
        ": " +
        upcoming.map(fmt).join("; ") +
        ".",
      usedLiveModel: false,
    };
  }
  return {
    kind: "own_data_answer",
    message: upcoming.map(fmt).join("; "),
    usedLiveModel: false,
  };
}
