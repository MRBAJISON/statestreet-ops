import React from 'react';

// 12-column "bento" grid + panel shell for the command-center layout.
// Pages compose dashboards as <Bento><Panel span={8}>…</Panel><Panel span={4}>…</Panel></Bento>.
// Collapses to a single column below `lg`. Panels use the shared `.panel-surface`
// treatment (gradient + elevation) defined in globals.css.

type Span = 3 | 4 | 5 | 6 | 7 | 8 | 12;

// Literal class strings so Tailwind's scanner keeps them in the build.
const spanClass: Record<Span, string> = {
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
};

export function Bento({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch ${className}`}>{children}</div>;
}

interface PanelProps {
  span?: Span;
  title?: string;
  subtitle?: string;
  meta?: string;
  number?: number;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Panel({ span = 12, title, subtitle, meta, number, actions, className = '', children }: PanelProps) {
  return (
    <div className={`panel-surface bg-[var(--c-card)] border border-[var(--c-border)] rounded-xl p-4 flex flex-col min-w-0 ${spanClass[span]} ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              {number !== undefined && (
                <span className="inline-grid place-items-center w-[18px] h-[18px] rounded-[5px] bg-gradient-to-br from-[#e8c75a] to-[#a08535] text-black text-[11px] font-extrabold">
                  {number}
                </span>
              )}
              {title}
              {subtitle && <span className="text-xs font-normal text-gray-500">· {subtitle}</span>}
            </h3>
            {meta && <div className="text-[0.7rem] text-gray-500 mt-0.5">{meta}</div>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
