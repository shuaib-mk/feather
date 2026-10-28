import React, { useState } from "react";

interface DeveloperDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeveloperDocsModal({ isOpen, onClose }: DeveloperDocsModalProps) {
  const [activeTab, setActiveTab] = useState<"architecture" | "privacy" | "models" | "guardrail">("architecture");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Liquid Glass Modal Card */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] liquid-glass-island p-6 sm:p-8 text-stone-900 shadow-2xl border border-white/80">
        <div className="liquid-glass-border" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-black/[0.06] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-xs">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="m10 13-2 2 2 2" />
                <path d="m14 17 2-2-2-2" />
              </svg>
            </div>
            <div>
              <h3 className="font-sans text-xl font-semibold tracking-tight text-stone-900">
                Feather AI Architecture &amp; Privacy
              </h3>
              <p className="font-sans text-xs text-stone-500">
                Meta Global AI Developer Hackathon · Indie Developer Track ("Build for Your World")
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-black/[0.05] hover:text-stone-900 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 flex flex-wrap gap-2 border-b border-black/[0.05] pb-3 text-xs font-mono">
          {[
            { id: "architecture", label: "01. Architecture" },
            { id: "privacy", label: "02. Privacy & Disclosure" },
            { id: "models", label: "03. Official Meta Models" },
            { id: "guardrail", label: "04. Medical Guardrail" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-xl px-3 py-1.5 transition-all ${
                activeTab === tab.id
                  ? "liquid-glass-pill bg-white text-stone-900 font-bold shadow-xs"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="mt-5 max-h-[55vh] overflow-y-auto space-y-4 pr-1 text-sm font-sans text-stone-700">
          {activeTab === "architecture" && (
            <div className="space-y-4">
              <div className="rounded-[20px] liquid-glass-card p-4">
                <h4 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">
                  Voice-First Hero Flow
                </h4>
                <p className="text-xs leading-relaxed text-stone-600">
                  Feather transforms natural spoken memories into structured cycle entries. Users describe their cycle relative to personal or universal calendar landmarks (e.g. <em>"two days before New Year's, heavy flow"</em>). Feather transcribes the audio, resolves the landmark date, presents an Accession Slip preview card for user confirmation, and instantly evaluates overlap with upcoming planned events.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-[18px] liquid-glass-card p-3.5">
                  <span className="font-mono text-[10px] text-stone-500 uppercase">Input Layer</span>
                  <div className="font-sans font-semibold text-stone-900 mt-1">16kHz Mono RIFF WAV</div>
                  <p className="text-[11px] text-stone-500 mt-1">Audio recorded on-device and encoded to standard 16-bit PCM RIFF WAV for Meta ASR compatibility.</p>
                </div>
                <div className="rounded-[18px] liquid-glass-card p-3.5">
                  <span className="font-mono text-[10px] text-stone-500 uppercase">Speech-to-Text Layer</span>
                  <div className="font-sans font-semibold text-stone-900 mt-1">Meta Muse Voice Transcribe</div>
                  <p className="text-[11px] text-stone-500 mt-1">Fast multilingual acoustic transcription across English, Spanish, and vernacular code-switching.</p>
                </div>
                <div className="rounded-[18px] liquid-glass-card p-3.5">
                  <span className="font-mono text-[10px] text-stone-500 uppercase">Reasoning Agent</span>
                  <div className="font-sans font-semibold text-stone-900 mt-1">Meta Muse Spark</div>
                  <p className="text-[11px] text-stone-500 mt-1">Tool-calling agent invoking <code>log_entry</code>, <code>milestone_lookup</code>, and <code>check_overlap</code>.</p>
                </div>
                <div className="rounded-[18px] liquid-glass-card p-3.5">
                  <span className="font-mono text-[10px] text-stone-500 uppercase">Local Vault</span>
                  <div className="font-sans font-semibold text-stone-900 mt-1">Browser LocalStorage</div>
                  <p className="text-[11px] text-stone-500 mt-1">All confirmed entries remain strictly on the user's device with JSON export &amp; import.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="space-y-3">
              <div className="rounded-[20px] liquid-glass-card p-4 space-y-2">
                <h4 className="font-mono text-xs uppercase tracking-wider text-stone-900 font-bold">
                  Core Privacy Architecture
                </h4>
                <p className="text-xs text-stone-700 leading-relaxed font-medium">
                  We never store your audio or your cycle data on our servers. Voice is sent to a speech-to-text service for transcription only, and cycle entries are saved only on your device.
                </p>
              </div>

              <div className="rounded-[20px] liquid-glass-card p-4 space-y-2">
                <h4 className="font-mono text-xs uppercase tracking-wider text-stone-900 font-bold">
                  How Data Flows
                </h4>
                <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
                  <li><strong>Voice Audio:</strong> Dispatched in-memory to Meta Muse Voice Transcribe for transcription, then discarded. Zero persistent audio storage.</li>
                  <li><strong>Transcript Text:</strong> Dispatched to Meta Muse Spark for tool-based structuring, then discarded.</li>
                  <li><strong>Cycle History:</strong> Saved exclusively in your local browser vault. No server database exists.</li>
                </ul>
              </div>

              <div className="rounded-[20px] border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-1.5">
                <strong className="font-mono uppercase text-[10px] tracking-wider block">Meta Model API Hackathon Disclosure</strong>
                <p className="leading-relaxed">
                  While using free hackathon API credits, content sent to the Meta Model API may be used by Meta for product improvement. Do not enter real personal health data in this demo.
                </p>
              </div>
            </div>
          )}

          {activeTab === "models" && (
            <div className="space-y-3">
              <div className="rounded-[20px] liquid-glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-sans font-bold text-stone-900">Meta Muse Voice Transcribe</span>
                  <span className="font-mono text-[10px] liquid-glass-pill px-2.5 py-0.5 text-stone-700">muse-voice-transcribe-1.0</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Official speech-to-text model on the Meta Model API. Receives 16kHz mono PCM WAV multipart payloads and returns verbatim transcripts.
                </p>
              </div>

              <div className="rounded-[20px] liquid-glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-sans font-bold text-stone-900">Meta Muse Spark</span>
                  <span className="font-mono text-[10px] liquid-glass-pill px-2.5 py-0.5 text-stone-700">muse-spark-1.3</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Official instruction-following reasoning model on the Meta Model API. Executes tool calls (<code>log_entry</code>, <code>milestone_lookup</code>, <code>check_overlap</code>) and generates annual milestone synthesis.
                </p>
              </div>
            </div>
          )}

          {activeTab === "guardrail" && (
            <div className="space-y-3">
              <div className="rounded-[20px] liquid-glass-card p-4 space-y-2">
                <h4 className="font-mono text-xs uppercase tracking-wider text-stone-900 font-bold">
                  Two-Layer Safety Guardrail
                </h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Feather is strictly a logging and planning companion. It refuses to provide medical advice, symptom diagnosis, treatment recommendations, or fertility/contraception guarantees.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-[18px] liquid-glass-card p-3.5">
                  <span className="font-mono text-[10px] text-stone-500 uppercase">Layer 1: Deterministic Engine</span>
                  <div className="font-sans font-semibold text-stone-900 mt-1">Pre-execution Regex Filter</div>
                  <p className="text-[11px] text-stone-500 mt-1">Intercepts diagnostic and medication questions in English, Spanish, Malayalam, and Hindi before LLM invocation.</p>
                </div>

                <div className="rounded-[18px] liquid-glass-card p-3.5">
                  <span className="font-mono text-[10px] text-stone-500 uppercase">Layer 2: Model System Prompt</span>
                  <div className="font-sans font-semibold text-stone-900 mt-1">Strict Refusal Directives</div>
                  <p className="text-[11px] text-stone-500 mt-1">Mandates the fixed response: <em>"I can only help with logging and planning. For health questions, please talk to a doctor."</em></p>
                </div>
              </div>

              <div className="rounded-[18px] liquid-glass-pill p-3 text-xs text-stone-700 text-center font-mono">
                "Feather helps with logging and planning only, not medical advice."
              </div>
            </div>
          )}
        </div>

        {/* Done Button */}
        <div className="mt-5 flex justify-end border-t border-black/[0.05] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="liquid-glass-button-dark rounded-full px-6 py-2 font-mono text-xs uppercase tracking-wider shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
