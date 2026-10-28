import React, { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-stone-200/50">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            {title}
          </h1>
          {badge && (
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200/80">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="font-sans text-xs text-stone-600 max-w-xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
