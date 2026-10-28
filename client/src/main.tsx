import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Feather ErrorBoundary caught error]:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem("feather_cycle_vault_v1");
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#fcfbfa] text-[#1a1718] flex flex-col items-center justify-center p-6 text-center antialiased">
          <div className="size-16 rounded-3xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-900 mb-4 shadow-sm">
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-stone-900">
              <line x1="3" y1="17" x2="3" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="7" x2="3" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="10" y1="17" x2="10" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="10" y1="5" x2="10" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="17" y1="17" x2="17" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="17" y1="9" x2="17" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="3" cy="9" r="2" fill="currentColor" />
              <circle cx="10" cy="7" r="2" fill="currentColor" />
              <circle cx="17" cy="11" r="2" fill="currentColor" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 mb-2">
            Feather Encountered an Error
          </h1>
          <p className="font-sans text-xs text-stone-600 max-w-sm mb-6 leading-relaxed">
            {this.state.error?.message || "An unexpected error occurred while loading the application."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={this.handleReload}
              className="liquid-glass-button-dark rounded-full py-2.5 px-6 font-mono text-xs uppercase tracking-wider cursor-pointer shadow-md"
            >
              Reload Page
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="liquid-glass-pill rounded-full py-2.5 px-6 font-mono text-xs uppercase tracking-wider text-stone-700 hover:text-stone-950 cursor-pointer shadow-xs border border-stone-200"
            >
              Reset Storage
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const rootEl =
  document.getElementById("root") ||
  document.querySelector<HTMLElement>("[data-feather-root]") ||
  document.body;

createRoot(rootEl).render(
  <StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className="w-full min-h-screen bg-[#fafafa]" data-feather-app>
          <App />
        </div>
      </QueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
