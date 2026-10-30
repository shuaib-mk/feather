import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { NextThirtyDaysStrip } from "./CalendarPage";
import { PlanAroundIt } from "../components/PlanAroundIt";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { diffDays, prettyDate, todayStr } from "../cycleStorage";

export function DashboardPage() {
  const { data, stats, loadDemo } = useCycle();
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
            
            <Link
              to="/voice"
              className="liquid-glass-button rounded-full px-4 py-2 font-sans text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
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

      {!isDemoActive && (
        <div className="liquid-glass-card rounded-[24px] p-5 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold">New here?</h2>
            <p className="text-xs text-stone-600">Try fictional demo data, or start with your own empty vault.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={loadDemo} className="liquid-glass-button rounded-full px-5 min-h-[44px] text-xs font-semibold">Try Demo</button>
            <Link to="/voice" className="liquid-glass-pill rounded-full px-5 min-h-[44px] text-xs inline-flex items-center">Start fresh</Link>
          </div>
        </div>
      )}
      {/* Primary Action Hero Card: Compact & Inviting */}
      <div className="liquid-glass-card rounded-[24px] p-5 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-lg">
            <span className="font-sans text-[11px] font-semibold tracking-wide text-violet-700 uppercase block">
              Voice &amp; Landmark Accession
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-stone-900 leading-snug">
              "Period started 2 days before New Year's..."
            </h2>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Understands dates like 'two days before New Year's'.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <Link
              to="/voice"
              className="liquid-glass-button rounded-full px-5 py-2.5 font-sans text-xs font-semibold text-center flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Start Recording</span>
            </Link>
            <Link
              to="/voice"
              className="liquid-glass-pill px-4 py-2.5 font-sans text-xs font-medium text-stone-700 hover:text-stone-950 text-center cursor-pointer shadow-2xs"
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
                className="liquid-glass-button rounded-full px-5 py-2 font-sans text-xs font-semibold cursor-pointer shadow-sm"
              >
                Record First Entry
              </Link>

            </div>
          }
        />
      ) : (
        <>
          {/* Key Cycle Statistics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="liquid-glass-card rounded-[20px] p-4 space-y-1 min-w-0">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="font-sans text-xs font-medium text-stone-500 shrink-0">
                  Next Estimate
                </span>
                {stats.predictionStatus === "overdue" && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-sans font-medium bg-amber-100 text-amber-800 shrink-0">
                    Past Expected
                  </span>
                )}
                {stats.predictionStatus === "provisional" && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-sans font-medium bg-stone-100 text-stone-600 shrink-0">
                    Provisional
                  </span>
                )}
              </div>
              <div className="font-serif text-2xl font-semibold text-stone-900 truncate">
                {stats.nextPeriodDate ? prettyDate(stats.nextPeriodDate).split(",")[0] : "Estimating"}
              </div>
              <span className="font-sans text-[11px] text-violet-700 font-medium block truncate" title={stats.earliestNextDate && stats.latestNextDate ? `${prettyDate(stats.earliestNextDate).split(",")[0]} – ${prettyDate(stats.latestNextDate).split(",")[0]}` : undefined}>
                {stats.earliestNextDate && stats.latestNextDate
                  ? `Window: ${prettyDate(stats.earliestNextDate).split(",")[0]} – ${prettyDate(stats.latestNextDate).split(",")[0]}`
                  : daysUntilNext != null
                  ? daysUntilNext > 0
                    ? `In ~${daysUntilNext} days`
                    : daysUntilNext === 0
                    ? "Predicted today"
                    : `${Math.abs(daysUntilNext)}d past est.`
                  : "Based on logs"}
              </span>
            </div>

            <div className="liquid-glass-card rounded-[20px] p-4 space-y-1 min-w-0">
              <span className="font-sans text-xs font-medium text-stone-500 block truncate">
                Cycle Length
              </span>
              <div className="font-serif text-2xl font-semibold text-stone-900 truncate">
                {stats.isDefaultCycle ? "Not enough data yet" : `${stats.medianCycleLength || stats.avgCycleLength}d`}
              </div>
              <span className="font-sans text-[11px] text-stone-500 block truncate">
                {stats.isDefaultCycle ? "Log a completed cycle to learn this" : "Observed median"}
              </span>
            </div>

            <div className="liquid-glass-card rounded-[20px] p-4 space-y-1 min-w-0">
              <span className="font-sans text-xs font-medium text-stone-500 block truncate">
                Flow Duration
              </span>
              <div className="font-serif text-2xl font-semibold text-stone-900 truncate">
                {stats.isDefaultPeriod ? "Not enough data yet" : `${stats.avgPeriodLength}d`}
              </div>
              <span className="font-sans text-[11px] text-stone-500 block truncate">
                {stats.isDefaultPeriod ? "Log a completed period to learn this" : "Observed average"}
              </span>
            </div>

            <div className="liquid-glass-card rounded-[20px] p-4 space-y-1 min-w-0">
              <span className="font-sans text-xs font-medium text-stone-500 block truncate">
                Vault Status
              </span>
              <div className="font-serif text-2xl font-semibold text-emerald-700 flex items-center gap-1.5 truncate">
                <span>Local</span>
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              </div>
              <span className="font-sans text-[11px] text-stone-500 block truncate">
                100% on-device
              </span>
            </div>
          </div>

          {/* Dual Panel: Latest Cycle Summary & Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Latest Period Summary */}
            <div className="liquid-glass-card rounded-[22px] p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200/50 pb-2.5">
                <span className="font-sans text-xs font-semibold text-stone-700">
                  Latest Period Entry
                </span>
                <Link
                  to="/chronicle"
                  className="font-sans text-xs font-medium text-violet-700 hover:text-violet-900"
                >
                  View All History →
                </Link>
              </div>

              {latestPeriod ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-serif text-lg font-semibold text-stone-900">
                        {prettyDate(latestPeriod.startDate)}
                      </div>
                      <span className="text-xs text-stone-500">
                        {latestPeriod.endDate
                          ? `To ${prettyDate(latestPeriod.endDate)} (${diffDays(latestPeriod.startDate, latestPeriod.endDate) + 1} days)`
                          : "Start date logged"}
                      </span>
                    </div>

                    {latestPeriod.landmarkName && (
                      <span className="liquid-glass-pill px-2.5 py-1 text-[11px] font-sans font-medium text-stone-700 flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600">
                          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                          <path d="M7 7h.01" />
                        </svg>
                        <span>{latestPeriod.landmarkName}</span>
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
                <span className="font-sans text-xs font-semibold text-stone-700">
                  Recent Symptom Logs
                </span>
                <Link
                  to="/chronicle"
                  className="font-sans text-xs font-medium text-violet-700 hover:text-violet-900"
                >
                  Log History →
                </Link>
              </div>

              {recentLogs.length > 0 ? (
                <div className="space-y-2">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id || log.logDate}
                      className="p-2.5 rounded-[14px] liquid-glass-tile flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-stone-900 block font-sans">
                          {prettyDate(log.logDate)}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {log.flow ? (
                            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-rose-50/90 text-rose-700 font-medium border border-rose-200/80">
                              {log.flow === "spotting" ? "spotting" : `${log.flow} flow`}
                            </span>
                          ) : log.kind === "period_started" ? (
                            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium border border-stone-200">
                              flow not noted
                            </span>
                          ) : null}
                          {log.symptoms && log.symptoms.slice(0, 2).map((s) => (
                            <span key={s} className="text-[11px] text-stone-600">
                              · {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      {log.energy != null && (
                        <span className="text-[11px] font-sans text-stone-500 shrink-0">
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

        </>
      )}
    <NextThirtyDaysStrip />
      <PlanAroundIt />
    </div>
  );
}
