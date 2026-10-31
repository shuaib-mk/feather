import type { CycleStatistics } from "./periodEngine";

export interface CycleStatsView {
  completedCycles: number;
  median: number | null;
  min: number | null;
  max: number | null;
  variabilityDays: number | null;
  averageBleedingDays: number | null;
  last12Lengths: number[];
  hasEnoughData: boolean;
  shortCycleDays: number | null;
}

export function toStatsView(stats: CycleStatistics | undefined | null): CycleStatsView {
  const lengths = stats?.allCycleLengths ?? [];
  const completed = stats?.completedCycleCount ?? 0;
  const sorted = [...lengths].sort((a, b) => a - b);
  const min = sorted.length ? sorted[0] : null;
  const max = sorted.length ? sorted[sorted.length - 1] : null;
  return {
    completedCycles: completed,
    median: stats?.medianCycleLength ?? null,
    min,
    max,
    variabilityDays: min !== null && max !== null ? max - min : null,
    averageBleedingDays: stats?.averageBleedingDuration ?? null,
    last12Lengths: lengths.slice(-12),
    shortCycleDays: sorted.length && sorted[0] < 10 ? sorted[0] : null,
    hasEnoughData: completed >= 1 && lengths.length > 0,
  };
}

export function barHeight(length: number, maxLength: number): number {
  if (maxLength <= 0) return 0;
  return Math.max(4, Math.round((length / maxLength) * 100));
}
