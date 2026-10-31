import React from "react";
import { Link } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";
import { toStatsView, barHeight } from "../lib/statsView";

export function StatsPage() {
  const { stats } = useCycle();
  const view = toStatsView(stats.statistics);
  const maxLen = view.last12Lengths.length ? Math.max(...view.last12Lengths) : 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Your cycles" subtitle="Summary of the cycles you have logged on this device." badge="Logged data" />
      {!view.hasEnoughData ? (
        <div className="liquid-glass-card rounded-[24px] p-6 space-y-3">
          <h2 className="font-serif text-xl font-semibold text-stone-900">Not enough data yet</h2>
          <p className="font-sans text-xs text-stone-600">Log a completed cycle to see your cycle lengths here. Estimates are not shown as if they were learned from your data.</p>
          <Link to="/voice" className="liquid-glass-button rounded-full px-4 py-2 font-sans text-xs font-semibold inline-block">Log by voice</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="liquid-glass-card rounded-[20px] p-4"><span className="font-sans text-xs text-stone-500 block">Completed cycles</span><span className="font-serif text-2xl font-semibold text-stone-900">{view.completedCycles}</span></div>
            <div className="liquid-glass-card rounded-[20px] p-4"><span className="font-sans text-xs text-stone-500 block">Median cycle length</span><span className="font-serif text-2xl font-semibold text-stone-900">{view.median !== null ? `${view.median} days` : "Not enough data yet"}</span></div>
            <div className="liquid-glass-card rounded-[20px] p-4"><span className="font-sans text-xs text-stone-500 block">Shortest – longest</span><span className="font-serif text-2xl font-semibold text-stone-900">{view.min !== null && view.max !== null ? `${view.min}–${view.max} days` : "—"}</span></div>
            <div className="liquid-glass-card rounded-[20px] p-4"><span className="font-sans text-xs text-stone-500 block">Average bleeding days</span><span className="font-serif text-2xl font-semibold text-stone-900">{view.averageBleedingDays !== null ? `${view.averageBleedingDays} days` : "Not enough data yet"}</span></div>
          </div>
          {view.shortCycleDays !== null && (<p role="note" className="font-sans text-xs text-amber-900 liquid-glass-card border border-amber-200/80 bg-amber-50/40 rounded-[18px] p-4">One cycle looks unusually short ({view.shortCycleDays} days) — this can happen if two period starts were logged close together. Check Chronicle if that's not right.</p>)}
          <div className="liquid-glass-card rounded-[24px] p-6 space-y-3">
            <h2 className="font-serif text-lg font-semibold text-stone-900">Last {view.last12Lengths.length} cycle lengths</h2>
            <svg viewBox="0 0 360 120" className="w-full" role="img" aria-label="Bar chart of recent cycle lengths in days">
              {view.last12Lengths.map((len, i) => { const h = barHeight(len, maxLen); const x = 8 + i * 29; return (<g key={i}><rect x={x} y={110 - h} width="18" height={h} rx="3" fill="#8b5cf6" opacity="0.75"><title>{`Cycle ${i + 1}: ${len} days`}</title></rect><text x={x + 9} y={119} textAnchor="middle" fontSize="7" fill="#57534e">{len}</text></g>); })}
            </svg>
            {view.variabilityDays !== null && <p className="font-sans text-xs text-stone-600">Variability: {view.variabilityDays} days between your shortest and longest completed cycles.</p>}
          </div>
        </>
      )}
      <p className="font-sans text-xs text-stone-500">Based on {view.completedCycles} completed cycles. Not medical advice.</p>
    </div>
  );
}
