// Paper diary / calendar vision import modal using Muse Spark Vision.
// Extracts circled/marked period dates from a photo into an editable preview table.

import React, { useState } from "react";
import { analyzeDiaryPhoto } from "./aiClient";
import type { ExtractedPeriod } from "../backend/vision";

interface PaperDiaryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportPeriods: (periods: Array<{ startDate: string; endDate?: string | null; notes?: string }>) => Promise<void> | void;
}

export const PaperDiaryImportModal: React.FC<PaperDiaryImportModalProps> = ({
  isOpen,
  onClose,
  onImportPeriods,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [extractedPeriods, setExtractedPeriods] = useState<ExtractedPeriod[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExtractedPeriods([]);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setError(null);

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

  const handleConfirmImport = async () => {
    if (extractedPeriods.length === 0) return;
    setIsImporting(true);
    try {
      await onImportPeriods(
        extractedPeriods.map((p) => ({
          startDate: p.startDate,
          endDate: p.endDate || null,
          notes: p.notes,
        })),
      );
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to import periods.");
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paper-diary-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[32px] liquid-glass-island p-6 sm:p-8 text-stone-900 shadow-2xl border border-white/80">
        <div className="liquid-glass-border" />
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div>
            <h3 id="paper-diary-title" className="text-base font-bold text-stone-900">
              Paper Diary &amp; Calendar Import
            </h3>
            <p className="text-xs text-stone-500">
              Scan circled dates with Muse Spark Vision
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close diary import"
            className="rounded-full p-2 text-stone-400 hover:bg-black/5 hover:text-stone-900 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Upload Zone */}
        <div className="mt-4">
          <label className="flex flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-stone-200/90 bg-white/60 p-6 text-center hover:border-stone-400 transition-colors cursor-pointer">
            <svg className="h-8 w-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="mt-2 text-xs font-semibold text-stone-900">
              {selectedFile ? selectedFile.name : "Select or snap calendar / diary photo"}
            </span>
            <span className="text-[11px] text-stone-500 mt-0.5">
              PNG, JPG, or WEBP with circled period dates
            </span>
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>

          {previewUrl && (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={previewUrl} alt="Preview" className="h-14 w-14 rounded-xl object-cover border border-stone-200" />
                <span className="text-xs text-stone-600">Photo loaded</span>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="liquid-glass-button-dark rounded-full px-4 py-2 text-xs font-mono uppercase tracking-wider disabled:opacity-50"
              >
                {isAnalyzing ? "Extracting..." : "Analyze with Muse Spark"}
              </button>
            </div>
          )}
        </div>

        {/* Extracted Preview Table */}
        {extractedPeriods.length > 0 && (
          <div className="mt-5 rounded-[24px] liquid-glass-card p-4">
            <h4 className="text-xs font-bold text-stone-900">
              Preview Extracted Periods ({extractedPeriods.length})
            </h4>
            {summary && <p className="mt-1 text-[11px] text-stone-600">{summary}</p>}

            <div className="mt-3 space-y-2">
              {extractedPeriods.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-2xl liquid-glass-pill p-2.5 text-xs">
                  <div className="flex-1">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider">Start:</span>
                    <input
                      type="date"
                      value={p.startDate}
                      onChange={(e) => handleDateChange(idx, "startDate", e.target.value)}
                      className="mt-0.5 w-full rounded-lg bg-white/90 border border-stone-200 px-2 py-1 text-xs text-stone-900 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider">End:</span>
                    <input
                      type="date"
                      value={p.endDate || ""}
                      onChange={(e) => handleDateChange(idx, "endDate", e.target.value)}
                      className="mt-0.5 w-full rounded-lg bg-white/90 border border-stone-200 px-2 py-1 text-xs text-stone-900 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePeriod(idx)}
                    aria-label={`Remove period ${idx + 1}`}
                    className="mt-3 rounded-full p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isImporting}
              className="mt-4 w-full liquid-glass-button-dark rounded-full py-2.5 text-xs font-mono uppercase tracking-wider disabled:opacity-50"
            >
              {isImporting ? "Importing..." : "Confirm & Import to Cycles"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
