import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { prettyDate, diffDays } from "../cycleStorage";

export function ChroniclePage() {
  const { data, removePeriod, removeLog } = useCycle();
  const [filterType, setFilterType] = useState<"all" | "periods" | "logs">("all");
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "period" | "log";
    id?: number;
    date: string;
  } | null>(null);

  const periods = data.periods;
  const logs = data.logs;

  // Build unified chronological timeline
  interface TimelineItem {
    id: string;
    date: string;
    isPeriod: boolean;
    periodItem?: (typeof periods)[0];
    isLog: boolean;
    logItem?: (typeof logs)[0];
  }

  const dateMap = new Map<string, TimelineItem>();

  periods.forEach((p) => {
    const existing = dateMap.get(p.startDate) || {
      id: `p-${p.id || p.startDate}`,
      date: p.startDate,
      isPeriod: true,
      periodItem: p,
      isLog: false,
    };
    existing.isPeriod = true;
    existing.periodItem = p;
    dateMap.set(p.startDate, existing);
  });

  logs.forEach((l) => {
    const existing = dateMap.get(l.logDate) || {
      id: `l-${l.id || l.logDate}`,
      date: l.logDate,
      isPeriod: false,
      isLog: true,
      logItem: l,
    };
    existing.isLog = true;
    existing.logItem = l;
    dateMap.set(l.logDate, existing);
  });

  const allItems = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  const filteredItems = allItems.filter((item) => {
    if (filterType === "periods") return item.isPeriod;
    if (filterType === "logs") return item.isLog;
    return true;
  });

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "period" && deleteTarget.id != null) {
      removePeriod(deleteTarget.id);
    } else if (deleteTarget.type === "log") {
      removeLog(deleteTarget.date);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chronicle"
        subtitle="Chronological historical timeline of confirmed cycle periods and daily symptom observations."
        badge={`${allItems.length} Entries`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/voice"
              className="liquid-glass-button-dark rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider font-bold cursor-pointer shadow-sm"
            >
              + Log New Entry
            </Link>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-full liquid-glass-pill p-1 gap-1">
          {[
            { id: "all", label: `All Entries (${allItems.length})` },
            { id: "periods", label: `Periods (${periods.length})` },
            { id: "logs", label: `Daily Notes (${logs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                filterType === tab.id
                  ? "bg-stone-900 text-white shadow-xs font-bold"
                  : "text-stone-600 hover:text-stone-950"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="font-mono text-[10px] uppercase text-stone-500">
          Saved in localStorage
        </span>
      </div>

      {/* Entries List */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
            </svg>
          }
          title="No records found in this view"
          description="You haven't logged any cycle records yet. Use voice or natural text to record your first entry."
          action={
            <Link
              to="/voice"
              className="liquid-glass-button-dark rounded-full px-5 py-2 font-mono text-xs uppercase tracking-wider font-bold cursor-pointer"
            >
              Log Entry Now
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const p = item.periodItem;
            const l = item.logItem;
            const duration = p && p.endDate ? diffDays(p.startDate, p.endDate) + 1 : null;

            return (
              <div
                key={item.id}
                className="liquid-glass-card rounded-[22px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/90 shadow-xs hover:border-stone-300 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-lg font-bold text-stone-900">
                      {prettyDate(item.date)}
                    </span>

                    {item.isPeriod && (
                      <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Period Start {duration ? `(${duration}d)` : ""}
                      </span>
                    )}

                    {l?.flow && l.flow !== "none" && (
                      <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                        {l.flow} flow
                      </span>
                    )}

                    {p?.landmarkName && (
                      <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] bg-stone-100 text-stone-700 border border-stone-200">
                        🏷️ {p.landmarkName}
                      </span>
                    )}
                  </div>

                  {/* Symptoms & Notes Row */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-stone-600">
                    {l?.symptoms && l.symptoms.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {l.symptoms.map((sym) => (
                          <span
                            key={sym}
                            className="liquid-glass-pill px-2 py-0.5 text-[10px] text-stone-600"
                          >
                            {sym}
                          </span>
                        ))}
                      </div>
                    )}

                    {l?.notes && (
                      <span className="text-[11px] text-stone-600 italic">
                        "{l.notes}"
                      </span>
                    )}

                    {l?.energy != null && (
                      <span className="font-mono text-[10px] text-stone-500">
                        Energy: {l.energy}/5
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete Entry Control */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {item.isPeriod && p?.id != null && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          type: "period",
                          id: p.id,
                          date: item.date,
                        })
                      }
                      className="liquid-glass-pill p-2 text-stone-400 hover:text-rose-600 cursor-pointer transition-colors"
                      aria-label={`Delete period for ${prettyDate(item.date)}`}
                      title="Delete period record"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}

                  {!item.isPeriod && item.isLog && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          type: "log",
                          date: item.date,
                        })
                      }
                      className="liquid-glass-pill p-2 text-stone-400 hover:text-rose-600 cursor-pointer transition-colors"
                      aria-label={`Delete log for ${prettyDate(item.date)}`}
                      title="Delete daily log"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete History Record?"
        message={`Are you sure you want to remove the record for ${
          deleteTarget ? prettyDate(deleteTarget.date) : ""
        }? This cannot be undone.`}
        confirmLabel="Delete Record"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
