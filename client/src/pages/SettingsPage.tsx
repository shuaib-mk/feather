import React, { useState } from "react";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";

export function SettingsPage() {
  const { useBrowserSpeech, setUseBrowserSpeech } = useCycle();

  const [useBaseten, setUseBaseten] = useState<boolean>(() => {
    try {
      return localStorage.getItem("feather_use_baseten") === "true";
    } catch {
      return false;
    }
  });

  const [activeDocTab, setActiveDocTab] = useState<"models" | "guardrail" | "landmarks" | "privacy">("models");

  const handleToggleBaseten = (enabled: boolean) => {
    setUseBaseten(enabled);
    try {
      localStorage.setItem("feather_use_baseten", enabled ? "true" : "false");
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings &amp; Architecture"
        subtitle="Manage speech engines, AI model providers, rate limit quotas, and technical documentation."
        badge="System Config"
      />

      {/* Speech-to-Text Recognition Engine */}
      <div className="liquid-glass-card rounded-[24px] p-6 space-y-4 shadow-sm">
        <div className="border-b border-stone-200/50 pb-3">
          <span className="font-sans text-xs font-semibold text-violet-700 block">
            Speech Recognition Engine
          </span>
          <h3 className="font-serif text-lg font-semibold text-stone-900">
            Transcription Service Configuration
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans">
          <div className="space-y-1 max-w-lg">
            <span className="font-semibold text-stone-900 block">
              Default: Meta Muse Voice Transcribe 1.0 (Cloud API)
            </span>
            <p className="text-stone-600 leading-relaxed text-[11px]">
              Transcribes audio clips over HTTPS in memory with universal multilingual support for all languages. Audio is immediately discarded post-transcription.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0">
            <input
              type="checkbox"
              checked={useBrowserSpeech}
              onChange={(e) => setUseBrowserSpeech(e.target.checked)}
              className="size-4 rounded accent-violet-600 cursor-pointer"
            />
            <span className="font-sans text-xs text-stone-700 font-medium">
              Use Web Speech API (Client-Only)
            </span>
          </label>
        </div>

        {useBrowserSpeech && (
          <div className="p-3 rounded-xl bg-violet-50 text-violet-900 text-[11px] border border-violet-200 font-sans">
            Web Speech API is active. Voice is transcribed entirely on-device by your browser's speech recognition engine without hitting <code>/api/transcribe</code>.
          </div>
        )}
      </div>

      {/* AI Model Provider Configuration */}
      <div className="liquid-glass-card rounded-[24px] p-6 space-y-4 shadow-sm">
        <div className="border-b border-stone-200/50 pb-3">
          <span className="font-sans text-xs font-semibold text-violet-700 block">
            AI Model Routing
          </span>
          <h3 className="font-serif text-lg font-semibold text-stone-900">
            Inference Providers &amp; Open-Weight Bridges
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
          {/* Hosted Meta Model API */}
          <div className={`p-4 rounded-[18px] border transition-all ${
            !useBaseten
              ? "bg-white/90 border-violet-400 ring-2 ring-violet-200/50 shadow-xs"
              : "bg-white/50 border-stone-200/70"
          }`}>
            <div className="flex items-center justify-between pb-1">
              <span className="font-semibold text-stone-900">Meta Model API (Hosted)</span>
              {!useBaseten && <span className="font-sans text-[11px] font-semibold bg-violet-100 text-violet-800 px-2.5 py-0.5 rounded-full">Active</span>}
            </div>
            <p className="text-[11px] text-stone-600 leading-tight">
              Model: <code className="font-mono font-semibold">muse-spark-1.3</code> via <code>https://api.meta.ai/v1</code>. Serverless tool-calling with landmark recall &amp; slip correction.
            </p>
            <button
              type="button"
              onClick={() => handleToggleBaseten(false)}
              className="mt-3 liquid-glass-pill px-3 py-1 font-sans text-xs font-semibold text-stone-800 cursor-pointer shadow-2xs"
            >
              Select Hosted Meta API
            </button>
          </div>

          {/* Baseten Open-Weight Bridge */}
          <div className={`p-4 rounded-[18px] border transition-all ${
            useBaseten
              ? "bg-white/90 border-violet-400 ring-2 ring-violet-200/50 shadow-xs"
              : "bg-white/50 border-stone-200/70"
          }`}>
            <div className="flex items-center justify-between pb-1">
              <span className="font-semibold text-stone-900">Baseten Open-Weight Bridge</span>
              {useBaseten && <span className="font-sans text-[11px] font-semibold bg-violet-100 text-violet-800 px-2.5 py-0.5 rounded-full">Active</span>}
            </div>
            <p className="text-[11px] text-stone-600 leading-tight">
              Model: <code className="font-mono font-semibold">meta-models/muse-spark-open-1026</code>. Alternative self-hosted GPU bridge endpoint.
            </p>
            <button
              type="button"
              onClick={() => handleToggleBaseten(true)}
              className="mt-3 liquid-glass-pill px-3 py-1 font-sans text-xs font-semibold text-stone-800 cursor-pointer shadow-2xs"
            >
              Select Baseten Open-Weight
            </button>
          </div>
        </div>
      </div>

      {/* Credit Quotas & Stateless Rate Limiting Note */}
      <div className="liquid-glass-card rounded-[24px] p-6 space-y-3">
        <div className="border-b border-stone-200/50 pb-2.5">
          <span className="font-sans text-xs font-semibold text-stone-600 block">
            API Protection &amp; Credit Quotas
          </span>
          <h3 className="font-serif text-lg font-semibold text-stone-900">
            Stateless Best-Effort Protection
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1 font-sans">
          <div className="p-3 rounded-xl bg-white/70 border border-stone-200/60">
            <span className="font-sans text-[11px] text-stone-500 font-medium block">Per-IP Minute Rate</span>
            <span className="font-serif text-lg font-semibold text-stone-900">20 req/min</span>
            <span className="text-[11px] text-stone-500 block">Prevents runaway voice loops</span>
          </div>
          <div className="p-3 rounded-xl bg-white/70 border border-stone-200/60">
            <span className="font-sans text-[11px] text-stone-500 font-medium block">Per-IP Daily Quota</span>
            <span className="font-serif text-lg font-semibold text-stone-900">150 req/day</span>
            <span className="text-[11px] text-stone-500 block">Per serverless edge instance</span>
          </div>
          <div className="p-3 rounded-xl bg-white/70 border border-stone-200/60">
            <span className="font-sans text-[11px] text-stone-500 font-medium block">Global Server Cap</span>
            <span className="font-serif text-lg font-semibold text-stone-900">500 req/day</span>
            <span className="text-[11px] text-stone-500 block">DAILY_REQUEST_CAP limit</span>
          </div>
        </div>

        <p className="text-[11px] text-stone-600 leading-relaxed pt-1 font-sans">
          <strong>Authentic Client IP:</strong> Endpoints read client IPs from Vercel's authentic edge proxy headers (<code>x-real-ip</code> and <code>x-vercel-forwarded-for</code>) to prevent client-spoofed rate limit circumvention.
        </p>

        <p className="text-[11px] text-stone-500 leading-relaxed italic border-t border-stone-200/40 pt-2 font-sans">
          "While using free hackathon API credits, content sent to the Meta Model API may be used by Meta for product improvement. Do not enter real personal health data in this demo."
        </p>
      </div>

      {/* Developer Architecture & System Docs (Tabs) */}
      <div className="liquid-glass-card rounded-[24px] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200/50 pb-3 flex-wrap gap-2">
          <div>
            <span className="font-sans text-xs font-semibold text-violet-700 block">
              Technical Documentation
            </span>
            <h3 className="font-serif text-lg font-semibold text-stone-900">
              System Architecture &amp; Guardrails
            </h3>
          </div>

          <div className="inline-flex rounded-full liquid-glass-pill p-1 gap-1">
            {[
              { id: "models", label: "Pipeline" },
              { id: "guardrail", label: "Guardrails" },
              { id: "landmarks", label: "Landmark Engine" },
              { id: "privacy", label: "Privacy" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDocTab(tab.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-sans font-semibold cursor-pointer transition-all ${
                  activeDocTab === tab.id
                    ? "liquid-glass-button text-stone-900 shadow-xs font-bold"
                    : "text-stone-600 hover:text-stone-950"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="text-xs font-sans text-stone-700 space-y-3 pt-1">
          {activeDocTab === "models" && (
            <div className="space-y-2">
              <h4 className="font-bold text-stone-900">Two-Stage AI Pipeline:</h4>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                <li><strong>Voice Acoustic Processing:</strong> Audio captured in browser at 16kHz WAV is sent to <code>/api/transcribe</code> (Meta Muse Voice Transcribe 1.0) with automatic multilingual detection.</li>
                <li><strong>Agentic Landmark Resolution:</strong> Extracted transcript text is sent to <code>/api/agent</code> (Muse Spark 1.3) with tools: <code>milestone_lookup</code>, <code>log_entry</code>, and <code>check_overlap</code>.</li>
                <li><strong>Zero-Cloud Deterministic Fallback:</strong> If API credits expire or user is offline, an on-device rules engine processes landmarks with 0ms latency.</li>
              </ol>
            </div>
          )}

          {activeDocTab === "guardrail" && (
            <div className="space-y-2">
              <h4 className="font-bold text-stone-900">Two-Layer Medical Safety Defense:</h4>
              <p className="text-[11px] leading-relaxed">
                Whenever a user seeks diagnosis, medical advice, medication suitability, or delay causes, Feather intercepts the query before or after model inference with the non-negotiable message:
              </p>
              <blockquote className="border-l-2 border-violet-500 pl-3 py-1 italic bg-stone-50 rounded-r-lg text-stone-800 text-[11px]">
                "I can only help with logging and planning. For health questions, please talk to a doctor."
              </blockquote>
            </div>
          )}

          {activeDocTab === "landmarks" && (
            <div className="space-y-2">
              <h4 className="font-bold text-stone-900">Deterministic Landmark Arithmetic:</h4>
              <p className="text-[11px] leading-relaxed">
                Universal calendar milestones (New Year's, Valentine's Day, International Women's Day, Summer Solstice, Earth Day, Global Marathon Season, Winter Holidays) are resolved with exact date arithmetic across 2025-2027. Supports natural relative offsets ("2 days before New Year's", "the Monday before Summer Solstice", "3 days after vacation").
              </p>
            </div>
          )}

          {activeDocTab === "privacy" && (
            <div className="space-y-2">
              <h4 className="font-bold text-stone-900">Local-First Storage Guarantee:</h4>
              <p className="text-[11px] leading-relaxed">
                All cycle entries live in the browser's <code>localStorage</code> under <code>feather_cycle_vault_v1</code>. No server database, no cookies, no advertising SDKs, no external analytics.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
