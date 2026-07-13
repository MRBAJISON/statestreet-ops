'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AnalyticsPreset } from '@/lib/contracts/analytics';
import { cn } from '@/lib/utils';

const PRESETS: Array<{ value: Exclude<AnalyticsPreset, 'custom'>; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'mtd', label: 'MTD' },
  { value: 'qtd', label: 'QTD' },
  { value: 'ytd', label: 'YTD' },
];

interface DashboardHeaderProps {
  title: string;
  description: string;
  preset: AnalyticsPreset;
  onPresetChange: (preset: AnalyticsPreset) => void;
  stores: Array<{ id: number; name: string }>;
  storeId: number | null;
  onStoreChange: (storeId: number | null) => void;
  storeLocked?: boolean;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function DashboardHeader({
  title,
  description,
  preset,
  onPresetChange,
  stores,
  storeId,
  onStoreChange,
  storeLocked,
  onRefresh,
  refreshing,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-8">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!storeLocked && stores.length ? (
          <Select value={storeId ? String(storeId) : 'all'} onValueChange={(value) => onStoreChange(value === 'all' ? null : Number(value))}>
            <SelectTrigger className="h-9 w-[168px] bg-card text-xs">
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
        <ToggleGroup
          type="single"
          value={preset === 'custom' ? '30d' : preset}
          onValueChange={(value) => value && onPresetChange(value as AnalyticsPreset)}
          variant="outline"
          size="sm"
          className="rounded-md bg-card p-0.5"
        >
          {PRESETS.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value} className="h-7 min-w-9 rounded-sm px-2 text-[0.7rem]">
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="size-9 bg-card" onClick={onRefresh} aria-label="Refresh dashboard">
              <RefreshCw className={cn(refreshing && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh dashboard</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
