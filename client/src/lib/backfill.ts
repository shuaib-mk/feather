import { prettyDate, diffDays, saveLogEntry, loadCycleData, saveCycleData, addOrUpdatePeriod, type Period } from "../cycleStorage";
import { isValidDateKey } from "./localDate";
import type { StructuredEntry } from "../../../ai/backend/agent";

export interface BackfillRow {
  key: string;
  date: string;
  endDate: string;
  selected: boolean;
}

export function backfillRowsFromEntries(entries: StructuredEntry[]): BackfillRow[] {
  return entries.map((e, i) => ({ key: e.date + "-" + i, date: e.date, endDate: e.endDate || "", selected: true }));
}

export function backfillSelected(rows: BackfillRow[]): BackfillRow[] {
  return rows.filter((r) => r.selected);
}

export function backfillDurationDays(row: BackfillRow): number | null {
  if (!row.endDate) return 1;
  if (!isValidDateKey(row.date) || !isValidDateKey(row.endDate)) return null;
  if (row.endDate < row.date) return null;
  return diffDays(row.date, row.endDate) + 1;
}

// All-or-none pre-check over the selected rows. Returns an error naming the
// row, or null when every selected row can be saved.
export function validateBackfillRows(rows: BackfillRow[], today: string): string | null {
  const sel = backfillSelected(rows);
  if (sel.length === 0) return "Select at least one period to save.";
  const seen: string[] = [];
  for (const r of sel) {
    if (!isValidDateKey(r.date)) return "Row " + r.date + " is not a valid date. Nothing was saved.";
    if (r.date > today) return "Row " + r.date + " is in the future. Nothing was saved.";
    if (r.endDate) {
      if (!isValidDateKey(r.endDate)) return "Row " + r.date + " has an invalid end date. Nothing was saved.";
      if (r.endDate < r.date) return "Row " + r.date + " ends before it starts. Nothing was saved.";
      if (r.endDate > today) return "Row " + r.date + " ends in the future. Nothing was saved.";
    }
    if (seen.includes(r.date)) return "Two rows start on " + r.date + ". Nothing was saved.";
    seen.push(r.date);
  }
  return null;
}

// Warnings only: overlaps, duplicates, short gaps and long durations never
// block saving. Gaps and durations are plain numbers, never interpreted.
export function backfillRowWarnings(row: BackfillRow, sorted: BackfillRow[], index: number, periods: Period[]): string[] {
  const out: string[] = [];
  const sameStart = periods.find((p) => p.startDate === row.date);
  const overlapping = periods.find((p) => {
    if (p.startDate === row.date) return false;
    const end = p.endDate || p.startDate;
    return row.date >= p.startDate && row.date <= end;
  });
  if (sameStart) out.push("Already logged: a period starting " + prettyDate(row.date) + " is in the vault.");
  else if (overlapping) out.push("Overlaps the period starting " + prettyDate(overlapping.startDate) + ".");
  const dupRow = sorted.some((r, i) => i !== index && r.selected && r.date === row.date);
  if (dupRow) out.push("Same start date twice in this list.");
  const gap = backfillGapDays(sorted, index);
  if (gap !== null && gap < 15) out.push("Only " + gap + " days after the previous start.");
  const dur = backfillDurationDays(row);
  if (dur !== null && dur > 10) out.push("Longer than 10 days (" + dur + " days).");
  return out;
}

// Days between this row start and the previous row start (display order).
export function backfillGapDays(sorted: BackfillRow[], index: number): number | null {
  if (index === 0) return null;
  const prev = sorted[index - 1].date;
  const cur = sorted[index].date;
  if (!isValidDateKey(prev) || !isValidDateKey(cur)) return null;
  return diffDays(prev, cur);
}

// Atomic multi-save through the existing period model: every selected row is
// written, or none is. Validation runs before any write; a storage snapshot
// is restored if any row throws mid-batch.
export function saveBackfillRows(rows: BackfillRow[], today: string, confirmLongPeriod: boolean, confirmShortGap = false): number {
  const problem = validateBackfillRows(rows, today);
  if (problem) throw new Error(problem);
  const snapshot = loadCycleData();
  try {
    const ordered = [...backfillSelected(rows)].sort((a, b) => a.date.localeCompare(b.date));
    for (const row of ordered) {
      const saved = saveLogEntry(
        {
          logDate: row.date,
          flow: null,
          symptoms: [],
          mood: null,
          energy: null,
          sleepHours: null,
          notes: null,
          kind: "period_started",
        },
        { kind: "period_started", confirmLongPeriod, confirmShortGap },
      );
      if (!saved || saved.needsConfirmation) {
        throw new Error(saved && saved.confirmationReason ? saved.confirmationReason : "A row needs confirmation.");
      }
      if (row.endDate) {
        const per = loadCycleData().periods.find((p) => p.startDate === row.date);
        if (per) addOrUpdatePeriod({ ...per, endDate: row.endDate });
      }
    }
  } catch (err) {
    saveCycleData(snapshot);
    throw err;
  }
  return backfillSelected(rows).length;
}
