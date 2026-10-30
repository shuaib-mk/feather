import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";
import { analyzeDiaryPhoto } from "../../../ai/frontend/aiClient";
import type { ExtractedPeriod } from "../../../ai/backend/vision";
import { todayLocal } from "../lib/localDate";

export function DiaryScannerPage() {
  const { savePeriod } = useCycle();
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [extractedPeriods, setExtractedPeriods] = useState<ExtractedPeriod[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExtractedPeriods([]);
      setError(null);
      setSuccessCount(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setError(null);
    setSuccessCount(null);

    try {
      const res = await analyzeDiaryPhoto(selectedFile);
      setExtractedPeriods(res.periods || []);
      setSummary(res.summary || "");
    } catch (err: any) {
      setError(err.message || "Failed to analyze calendar photo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDateChange = (idx: number, field: "startDate" | "endDate", value: string) => {
    const updated = [...extractedPeriods];
    const item = updated[idx];
    if (!item) return;
    item[field] = value;
    setExtractedPeriods(updated);
  };

  const handleRemovePeriod = (idx: number) => {
    setExtractedPeriods(extractedPeriods.filter((_, i) => i !== idx));
  };

  const handleAddManualRow = () => {
    setExtractedPeriods([
      ...extractedPeriods,
      { startDate: todayLocal(), endDate: undefined, confidence: 1 },
    ]);
  };

  const handleConfirmImport = () => {
    if (extractedPeriods.length === 0) return;
    for (const p of extractedPeriods) {
      savePeriod({
        startDate: p.startDate,
        endDate: p.endDate || null,
        landmarkName: p.notes || "Calendar Photo Import",
      });
    }
    setSuccessCount(extractedPeriods.length);
    setExtractedPeriods([]);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Diary Scanner"
        subtitle="Extract marked cycle dates from calendar photos into your local vault using Muse Spark Vision."
        badge="Vision Model"
      />

      {/* Privacy Notice Card */}
      <div className="rounded-[18px] bg-stone-100/70 border border-stone-200/80 p-3.5 text-xs text-stone-600 font-sans flex items-start gap-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500 shrink-0 mt-0.5">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="leading-relaxed">
          <strong className="text-stone-800">In-Memory Image Processing:</strong> Photos are sent securely to <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded">/api/vision</code> in-memory and discarded immediately after date extraction. No calendar photos are ever saved on servers.
        </p>
      </div>

      {successCount != null && (
        <div className="rounded-[20px] bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-900 font-sans flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="font-semibold">Successfully imported {successCount} cycle periods to your vault!</span>
          </div>
          <Link to="/chronicle" className="font-sans text-xs font-semibold underline text-emerald-800">
            View in Chronicle →
          </Link>
        </div>
      )}

      {/* Upload & Image Dropzone */}
      <div className="liquid-glass-card rounded-[24px] p-6 sm:p-8 space-y-5 text-center">
        {!previewUrl ? (
          <label className="border-2 border-dashed border-stone-300 hover:border-violet-500 rounded-[20px] p-8 flex flex-col items-center justify-center space-y-3 cursor-pointer transition-colors bg-white/40 hover:bg-white/70">
            <div className="size-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div>
              <span className="font-semibold text-stone-900 block text-sm font-sans">
                Choose a calendar photo or drop it here
              </span>
              <span className="text-stone-500 text-xs block pt-0.5 font-sans">
                Supports PNG, JPEG, and WebP (up to 4MB)
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="relative max-h-72 w-full overflow-hidden rounded-[18px] border border-stone-200/80 bg-black/5 flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Calendar preview"
                className="max-h-72 object-contain"
              />
            </div>

            <div className="flex items-center justify-center gap-3">
              <label className="liquid-glass-pill px-4 py-2 font-sans text-xs font-medium text-stone-700 hover:text-stone-900 cursor-pointer shadow-2xs">
                Change Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="liquid-glass-button rounded-full px-5 py-2 font-sans text-xs font-semibold cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isAnalyzing ? "Scanning Image..." : "Analyze with Muse Vision"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200 text-left font-sans">
            {error}
          </div>
        )}
      </div>

      {/* Extracted Dates Review Table */}
      {extractedPeriods.length > 0 && (
        <div className="liquid-glass-card rounded-[24px] p-6 space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/50 pb-3">
            <div>
              <span className="font-sans text-xs font-semibold text-emerald-700 block">
                Extracted Dates (Confirmation Required)
              </span>
              <h3 className="font-serif text-xl font-semibold text-stone-900">
                Review Extracted Period Dates
              </h3>
            </div>
            <button
              type="button"
              onClick={handleAddManualRow}
              className="liquid-glass-pill px-3 py-1 font-sans text-xs font-medium text-stone-700 self-start sm:self-auto cursor-pointer"
            >
              + Add Row
            </button>
          </div>

          {summary && (
            <p className="text-xs text-stone-600 bg-white/80 p-3 rounded-xl border border-stone-200/60 leading-relaxed font-sans">
              <strong>Scanner Summary:</strong> {summary}
            </p>
          )}

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[500px] text-left text-xs font-sans">
              <thead className="bg-stone-100/60 font-sans text-[11px] font-semibold text-stone-600 border-b border-stone-200/60">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Start Date</th>
                  <th className="py-2.5 px-3 font-semibold">End Date (Optional)</th>
                  <th className="py-2.5 px-3 font-semibold">Confidence / Source</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/40">
                {extractedPeriods.map((period, idx) => (
                  <tr key={idx} className="hover:bg-white/60">
                    <td className="py-2.5 px-3">
                      <input
                        type="date"
                        value={period.startDate}
                        onChange={(e) => handleDateChange(idx, "startDate", e.target.value)}
                        className="liquid-glass-input rounded-lg p-1.5 text-xs font-sans"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="date"
                        value={period.endDate || ""}
                        onChange={(e) => handleDateChange(idx, "endDate", e.target.value)}
                        placeholder="Optional"
                        className="liquid-glass-input rounded-lg p-1.5 text-xs font-sans"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[11px] text-stone-600">
                      {period.confidence != null ? `${Math.round(period.confidence * 100)}% match` : "Manual"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemovePeriod(idx)}
                        className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer inline-flex items-center justify-center"
                        aria-label="Remove period row"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-stone-200/50">
            <button
              type="button"
              onClick={() => setExtractedPeriods([])}
              className="liquid-glass-pill px-4 py-2.5 sm:py-2 font-sans text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer text-center justify-center flex items-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              className="liquid-glass-button rounded-full px-6 py-2.5 font-sans text-xs font-semibold cursor-pointer shadow-sm text-center justify-center flex items-center"
            >
              Import {extractedPeriods.length} Periods to Vault
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
