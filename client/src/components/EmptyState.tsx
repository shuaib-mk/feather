import React, { type ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="liquid-glass-card rounded-[22px] p-8 text-center flex flex-col items-center justify-center space-y-3 max-w-md mx-auto my-6 border border-white/80">
      {icon && (
        <div className="size-12 rounded-2xl bg-stone-100/80 border border-stone-200/60 flex items-center justify-center text-stone-700 shadow-xs mb-1">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-lg font-bold text-stone-900">
        {title}
      </h3>
      <p className="font-sans text-xs text-stone-600 leading-relaxed max-w-sm">
        {description}
      </p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
