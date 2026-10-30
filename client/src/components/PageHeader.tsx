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
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900">
            {title}
          </h1>
          {badge && (
            <span className="liquid-glass-pill font-sans text-[11px] font-medium tracking-normal px-2.5 py-0.5 rounded-full text-stone-700 shrink-0 inline-flex items-center">
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
