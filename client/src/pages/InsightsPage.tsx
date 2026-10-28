import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";
import { prettyDate } from "../cycleStorage";

export function InsightsPage() {
  const { data, stats, synthesisResult, isSynthesizing, runSynthesis } = useCycle();
  const [foresightFilter, setForesightFilter] = useState<"all" | "travel" | "energy" | "rest">("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const matrix = synthesisResult.milestoneForecastMatrix || [];

  const filteredMatrix = matrix.filter((item) => {
    if (foresightFilter === "travel") {
      const lower = item.milestone.toLowerCase();
      return lower.includes("vacation") || lower.includes("break") || lower.includes("holiday") || lower.includes("getaway");
    }
    if (foresightFilter === "energy") {
      return item.phaseAtMilestone === "Follicular" || item.phaseAtMilestone === "Ovulatory";
    }
    if (foresightFilter === "rest") {
      return item.phaseAtMilestone === "Menstrual" || item.phaseAtMilestone === "Luteal";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Foresight &amp; Chronobiology"
        subtitle="12-month calendar milestone projections mapped against your biological rhythm."
        badge={`${matrix.length} Milestones`}
        actions={
          <button
            type="button"
            onClick={runSynthesis}
            disabled={isSynthesizing}
            className="liquid-glass-button-dark rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {isSynthesizing ? (
              <>
                <span className="size-2 rounded-full bg-violet-400 animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Generate Deep Synthesis</span>
              </>
            )}
          </button>
        }
      />

      {/* Mandatory Medical Disclaimer Banner */}
      <div className="rounded-[18px] bg-stone-100/70 border border-stone-200/80 p-3.5 text-xs text-stone-600 font-sans flex items-start gap-2.5">
        <span className="text-stone-400 shrink-0 text-sm">ℹ️</span>
        <p className="leading-relaxed">
          <strong className="text-stone-800">Non-Clinical Planning Estimate:</strong> Forecasts are calculated from your confirmed historical cycles. Menstrual cycles vary naturally; these projections are never medically certain, not guaranteed, and must never be used for contraception or medical diagnosis.
        </p>
      </div>

      {/* Executive Summary & Rhythm Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="liquid-glass-card rounded-[22px] p-5 md:col-span-2 space-y-2">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-2">
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-violet-700">
              Chronobiology Executive Summary
            </span>
            <span className="font-mono text-[10px] text-stone-500">
              Provider: {synthesisResult.telemetry?.provider || "Local Deterministic Engine"}
            </span>
          </div>
          <p className="font-sans text-xs text-stone-700 leading-relaxed pt-1">
            {synthesisResult.executiveSummary ||
              "Your rhythm shows regular cyclic periodicity. Predicted phases allow forward-looking planning around high-energy milestones and restorative periods."}
          </p>
        </div>

        <div className="liquid-glass-card rounded-[22px] p-5 space-y-1 flex flex-col justify-center text-center">
          <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 block">
            Regularity Index
          </span>
          <div className="font-serif text-3xl sm:text-4xl font-bold text-violet-900">
            {synthesisResult.regularityScore}/100
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">
            {synthesisResult.regularityScore >= 80 ? "High Consistency Pattern" : "Normal Variable Pattern"}
          </span>
        </div>
      </div>

      {/* Biological Phase Legend */}
      <div className="liquid-glass-card rounded-[22px] p-5 space-y-3">
        <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-stone-500 block">
          Biological Phase Correlations
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-[16px] bg-rose-50/70 border border-rose-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-900">1. Menstrual</span>
              <span className="font-mono text-[10px] text-rose-700">Days 1-5</span>
            </div>
            <p className="text-[11px] text-rose-800 leading-tight">
              Restorative focus, iron-rich nutrition, gentle movement.
            </p>
          </div>

          <div className="p-3 rounded-[16px] bg-sky-50/70 border border-sky-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-900">2. Follicular</span>
              <span className="font-mono text-[10px] text-sky-700">Days 6-13</span>
            </div>
            <p className="text-[11px] text-sky-800 leading-tight">
              Rising estrogen, mental clarity, creative projects, endurance.
            </p>
          </div>

          <div className="p-3 rounded-[16px] bg-amber-50/70 border border-amber-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900">3. Ovulatory</span>
              <span className="font-mono text-[10px] text-amber-700">Days 14-16</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-tight">
              Peak biological energy, social presentation, peak athletic power.
            </p>
          </div>

          <div className="p-3 rounded-[16px] bg-purple-50/70 border border-purple-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-900">4. Luteal</span>
              <span className="font-mono text-[10px] text-purple-700">Days 17-28</span>
            </div>
            <p className="text-[11px] text-purple-800 leading-tight">
              Progesterone elevation, detail work, steady stamina, wind-down.
            </p>
          </div>
        </div>
      </div>

      {/* 12-Month Foresight Matrix Filter Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-full liquid-glass-pill p-1 gap-1">
          {[
            { id: "all", label: `All Milestones (${matrix.length})` },
            { id: "travel", label: "Travel & Vacations" },
            { id: "energy", label: "High Energy Windows" },
            { id: "rest", label: "Rest & Reset" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setForesightFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                foresightFilter === tab.id
                  ? "bg-stone-900 text-white shadow-xs font-bold"
                  : "text-stone-600 hover:text-stone-950"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="inline-flex rounded-full liquid-glass-pill p-1 gap-1">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1 rounded-full text-xs font-mono uppercase font-bold cursor-pointer ${
              viewMode === "cards" ? "bg-white text-stone-900 shadow-xs" : "text-stone-500"
            }`}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`px-3 py-1 rounded-full text-xs font-mono uppercase font-bold cursor-pointer ${
              viewMode === "table" ? "bg-white text-stone-900 shadow-xs" : "text-stone-500"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Matrix Display: Cards View */}
      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredMatrix.map((item, idx) => {
            const isLikely = item.overlapRisk.toLowerCase().includes("likely");
            return (
              <div
                key={idx}
                className="liquid-glass-card rounded-[22px] p-4 space-y-2.5 border border-white/90 shadow-xs hover:border-stone-300 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-serif text-base font-bold text-stone-900 leading-tight">
                      {item.milestone}
                    </h4>
                    <span className="font-mono text-[10px] text-stone-500 block pt-0.5">
                      {prettyDate(item.date)}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-bold tracking-wider shrink-0 ${
                    isLikely
                      ? "bg-rose-100 text-rose-800 border border-rose-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}>
                    {isLikely ? "Likely Overlap" : "Unlikely (Est)"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200/50">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-stone-400 uppercase">Phase:</span>
                    <span className="font-semibold text-stone-800">{item.phaseAtMilestone}</span>
                  </div>
                  <span className="font-mono text-[10px] text-violet-700 font-bold">2026-2027</span>
                </div>

                {item.note && (
                  <p className="text-[11px] text-stone-600 leading-snug pt-0.5">
                    {item.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Matrix Display: Compact Table View */
        <div className="liquid-glass-card rounded-[22px] overflow-hidden border border-white/90">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-stone-100/60 font-mono text-[10px] uppercase text-stone-500 border-b border-stone-200/60">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Milestone</th>
                  <th className="py-2.5 px-4 font-bold">Date</th>
                  <th className="py-2.5 px-4 font-bold">Biological Phase</th>
                  <th className="py-2.5 px-4 font-bold">Overlap Forecast</th>
                  <th className="py-2.5 px-4 font-bold">Planning Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/40">
                {filteredMatrix.map((item, idx) => {
                  const isLikely = item.overlapRisk.toLowerCase().includes("likely");
                  return (
                    <tr key={idx} className="hover:bg-white/60 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-stone-900">{item.milestone}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-stone-600">{item.date}</td>
                      <td className="py-2.5 px-4 font-semibold text-stone-800">{item.phaseAtMilestone}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-bold ${
                          isLikely
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {isLikely ? "Likely Overlap" : "Unlikely (Est)"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-stone-600 text-[11px] max-w-xs truncate">{item.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
