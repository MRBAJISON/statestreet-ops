import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPercent } from './format';

export interface MetricItem {
  label: string;
  value: string;
  previous?: number | null;
  detail?: string;
  icon?: LucideIcon;
  tone?: 'blue' | 'green' | 'amber' | 'coral' | 'teal';
}

const DOT_TONES: Record<NonNullable<MetricItem['tone']>, string> = {
  blue: 'bg-chart-1',
  green: 'bg-primary',
  amber: 'bg-chart-2',
  coral: 'bg-chart-3',
  teal: 'bg-chart-4',
};

const TILE_TONES: Record<NonNullable<MetricItem['tone']>, string> = {
  blue: 'border-chart-1/16 bg-chart-1/6',
  green: 'border-primary/16 bg-primary/6',
  amber: 'border-chart-2/22 bg-chart-2/9',
  coral: 'border-chart-3/16 bg-chart-3/6',
  teal: 'border-chart-4/18 bg-chart-4/7',
};

const ICON_TONES: Record<NonNullable<MetricItem['tone']>, string> = {
  blue: 'bg-chart-1/12 text-chart-1',
  green: 'bg-primary/12 text-primary',
  amber: 'bg-chart-2/18 text-amber-800',
  coral: 'bg-chart-3/12 text-destructive',
  teal: 'bg-chart-4/12 text-chart-4',
};

export function MetricRail({ items, className }: { items: MetricItem[]; className?: string }) {
  return (
    <section className={cn('grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6', className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const positive = item.previous !== undefined && item.previous !== null && item.previous >= 0;
        return (
          <div
            key={item.label}
            className={cn(
              'min-h-28 min-w-0 rounded-md border px-4 py-4 shadow-[var(--shadow-surface)]',
              TILE_TONES[item.tone ?? 'blue']
            )}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {Icon ? (
                <span className={cn('flex size-7 items-center justify-center rounded-md', ICON_TONES[item.tone ?? 'blue'])}>
                  <Icon />
                </span>
              ) : <span className={cn('size-2 rounded-full', DOT_TONES[item.tone ?? 'blue'])} />}
              <span className="truncate">{item.label}</span>
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-0.5">
              <span className="whitespace-nowrap text-[0.95rem] font-semibold leading-6 text-foreground sm:text-[1.35rem] sm:leading-7">{item.value}</span>
              {item.previous !== undefined && item.previous !== null ? (
                <span className={cn('mb-0.5 flex items-center text-[0.68rem] font-semibold', positive ? 'text-primary' : 'text-destructive')}>
                  {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {Math.abs(item.previous).toFixed(1)}%
                </span>
              ) : null}
            </div>
            {item.detail ? <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p> : null}
          </div>
        );
      })}
    </section>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[0.94rem] font-semibold leading-5">{title}</h2>
        {description ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Attainment({ value, label = 'Target attainment' }: { value: number; label?: string }) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{formatPercent(safeValue)}</span>
      </div>
      <Progress value={Math.min(safeValue, 100)} className="h-2 bg-secondary" />
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'border-primary/20 bg-primary/10 text-primary',
  completed: 'border-primary/20 bg-primary/10 text-primary',
  received: 'border-primary/20 bg-primary/10 text-primary',
  submitted: 'border-chart-1/20 bg-chart-1/10 text-chart-1',
  'in-progress': 'border-chart-1/20 bg-chart-1/10 text-chart-1',
  active: 'border-chart-1/20 bg-chart-1/10 text-chart-1',
  blocked: 'border-chart-3/20 bg-chart-3/10 text-destructive',
  critical: 'border-chart-3/20 bg-chart-3/10 text-destructive',
  high: 'border-chart-3/20 bg-chart-3/10 text-destructive',
  draft: 'border-border bg-muted text-muted-foreground',
  requested: 'border-chart-2/25 bg-chart-2/12 text-amber-800',
  medium: 'border-chart-2/25 bg-chart-2/12 text-amber-800',
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={cn('rounded-md px-1.5 py-0 text-[0.68rem] font-semibold capitalize', STATUS_STYLES[value] ?? 'bg-muted text-muted-foreground')}>
      {value.replaceAll('-', ' ')}
    </Badge>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="page-shell flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72 max-w-[70vw]" />
        </div>
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-28 w-full rounded-md" />
      <div className="grid gap-5 xl:grid-cols-12">
        <Skeleton className="h-[390px] xl:col-span-8" />
        <Skeleton className="h-[390px] xl:col-span-4" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
