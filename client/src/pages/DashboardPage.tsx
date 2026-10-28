import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { diffDays, prettyDate, todayStr } from "../cycleStorage";

export function DashboardPage() {
  const { data, stats, isDemoActive, loadDemo } = useCycle();
  const navigate = useNavigate();

  const periods = data.periods;
  const logs = data.logs;
  const hasHistory = periods.length > 0;

  // Latest cycle start
  const latestPeriod = hasHistory
    ? [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    : null;

  // Days until next predicted period
  const daysUntilNext = stats.nextPeriodDate
    ? diffDays(todayStr(), stats.nextPeriodDate)
    : null;

  // Recent 3 activity logs
  const recentLogs = [...logs]
    .sort((a, b) => b.logDate.localeCompare(a.logDate))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cycle Overview"
        subtitle="Your private, voice-first companion for cycle logging and calendar landmark recall."
        badge={hasHistory ? "Active Vault" : "New Setup"}
        actions={
          <div className="flex items-center gap-2">
            {!hasHistory && !isDemoActive && (
              <button
                type="button"
                onClick={loadDemo}
                className="liquid-glass-pill px-3 py-1.5 font-mono text-[10px] uppercase font-bold text-violet-700 hover:text-violet-900 border border-violet-200 cursor-pointer shadow-xs"
              >
                ✨ Load Demo Data
              </button>
            )}
            <Link
              to="/voice"
              className="liquid-glass-button-dark rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              <span>Record Voice</span>
            </Link>
          </div>
        }
      />

      {/* Primary Action Hero Card: Compact & Inviting */}
      <div className="liquid-glass-card rounded-[24px] p-5 sm:p-6 border border-white/90 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-lg">
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-violet-700 block">
              Voice &amp; Landmark Accession
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 leading-snug">
              "Period started 2 days before Diwali..."
            </h2>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Feather accurately maps calendar landmarks like Diwali, Onam, New Year's, and flights to precise dates in English, Malayalam, and Hindi.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <Link
              to="/voice"
              className="liquid-glass-button-dark rounded-full px-5 py-2.5 font-mono text-xs uppercase tracking-wider font-bold text-center flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Start Recording</span>
            </Link>
            <Link
              to="/voice"
              className="liquid-glass-pill px-4 py-2.5 font-mono text-xs uppercase font-medium text-stone-700 hover:text-stone-950 text-center cursor-pointer shadow-xs"
            >
              Type via Text →
            </Link>
          </div>
        </div>
      </div>

      {!hasHistory ? (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
          title="No cycle entries in your vault yet"
          description="Record your first period using natural voice or text. Your data is stored strictly on this device in localStorage."
          action={
            <div className="flex items-center gap-2.5 flex-wrap justify-center">
              <Link
                to="/voice"
                className="liquid-glass-button-dark rounded-full px-5 py-2 font-mono text-xs uppercase tracking-wider font-bold cursor-pointer shadow-sm"
              >
                Record First Entry
              </Link>
              <button
                type="button"
                onClick={loadDemo}
                className="liquid-glass-pill px-4 py-2 font-mono text-xs uppercase font-medium text-stone-700 hover:text-stone-900 cursor-pointer shadow-xs"
              >
                Load Judge Demo Data
              </button>
            </div>
          }
        />
      ) : (
        <>
          {/* Key Cycle Statistics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="liquid-glass-card rounded-[20px] p-4 space-y-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 block">
                Next Estimate
              </span>
              <div className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                {stats.nextPeriodDate ? prettyDate(stats.nextPeriodDate).split(",")[0] : "Estimating"}
              </div>
              <span className="font-sans text-[11px] text-violet-700 font-medium block">
                {daysUntilNext != null
                  ? daysUntilNext > 0
                    ? `In ~${daysUntilNext} days`
                    : daysUntilNext === 0
                    ? "Predicted today"
                    : `${Math.abs(daysUntilNext)}d past est.`
                  : "Based on logs"}
              </span>
            </div>

            <div className="liquid-glass-card rounded-[20px] p-4 space-y-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 block">
                Cycle Length
              </span>
              <div className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                {stats.avgCycleLength}d
              </div>
              <span className="font-sans text-[11px] text-stone-500 block">
                {stats.isDefaultCycle ? "Default estimate" : "Calculated average"}
              </span>
            </div>

            <div className="liquid-glass-card rounded-[20px] p-4 space-y-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 block">
                Flow Duration
              </span>
              <div className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                {stats.avgPeriodLength}d
              </div>
              <span className="font-sans text-[11px] text-stone-500 block">
                {stats.isDefaultPeriod ? "Default estimate" : "Historical average"}
              </span>
            </div>

            <div className="liquid-glass-card rounded-[20px] p-4 space-y-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 block">
                Vault Status
              </span>
              <div className="font-serif text-xl sm:text-2xl font-bold text-emerald-700 flex items-center gap-1.5">
                <span>Local</span>
                <span className="size-2 rounded-full bg-emerald-500" />
              </div>
              <span className="font-sans text-[11px] text-stone-500 block">
                100% on-device vault
              </span>
            </div>
          </div>

          {/* Dual Panel: Latest Cycle Summary & Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Latest Period Summary */}
            <div className="liquid-glass-card rounded-[22px] p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200/50 pb-2.5">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-stone-600">
                  Latest Period Entry
                </span>
                <Link
                  to="/chronicle"
                  className="font-mono text-[10px] uppercase font-bold text-violet-700 hover:text-violet-900 underline"
                >
                  View All History →
                </Link>
              </div>

              {latestPeriod ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-serif text-lg font-bold text-stone-900">
                        {prettyDate(latestPeriod.startDate)}
                      </div>
                      <span className="text-xs text-stone-500">
                        {latestPeriod.endDate
                          ? `To ${prettyDate(latestPeriod.endDate)} (${diffDays(latestPeriod.startDate, latestPeriod.endDate) + 1} days)`
                          : "Start date logged"}
                      </span>
                    </div>

                    {latestPeriod.landmarkName && (
                      <span className="liquid-glass-pill px-2.5 py-1 text-[10px] font-mono font-medium text-stone-700 bg-stone-100">
                        🏷️ {latestPeriod.landmarkName}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed pt-1">
                    Logged with zero cloud database. All cycle intervals and statistics update dynamically.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-stone-500">No period records yet.</p>
              )}
            </div>

            {/* Recent Daily Logs */}
            <div className="liquid-glass-card rounded-[22px] p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200/50 pb-2.5">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-stone-600">
                  Recent Symptom Logs
                </span>
                <Link
                  to="/chronicle"
                  className="font-mono text-[10px] uppercase font-bold text-violet-700 hover:text-violet-900 underline"
                >
                  Log History →
                </Link>
              </div>

              {recentLogs.length > 0 ? (
                <div className="space-y-2">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id || log.logDate}
                      className="p-2.5 rounded-[14px] bg-white/70 border border-stone-200/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-stone-900 block">
                          {prettyDate(log.logDate)}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {log.flow && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                              {log.flow} flow
                            </span>
                          )}
                          {log.symptoms && log.symptoms.slice(0, 2).map((s) => (
                            <span key={s} className="text-[10px] text-stone-600">
                              · {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      {log.energy != null && (
                        <span className="text-[10px] font-mono text-stone-500 shrink-0">
                          Energy: {log.energy}/5
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 py-3">No daily symptom notes logged yet.</p>
              )}
            </div>
          </div>

          {/* Quick Foresight Banner */}
          <div className="liquid-glass-card rounded-[22px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-violet-700 block">
                12-Month Foresight Matrix
              </span>
              <span className="font-serif text-base font-bold text-stone-900 block">
                Plan trips, marathons, and exams around your biological rhythm
              </span>
              <span className="text-stone-500 text-[11px] block">
                Deterministic biological phase projections across 2026-2027 calendar landmarks.
              </span>
            </div>

            <Link
              to="/insights"
              className="liquid-glass-pill px-4 py-2 font-mono text-xs uppercase font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition-all shrink-0 text-center cursor-pointer shadow-xs"
            >
              Open Foresight Matrix →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
