'use client';

import { useState } from 'react';
import { CalendarRange, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadFile } from '@/lib/download-file';
import { resolveStorePeriod, type StorePeriodType } from '@/lib/reporting/store-period';

/**
 * Downloads the weekly (Mon-Sat) or monthly report for the period containing
 * `anchorDate`. The API refuses a period that still has unsubmitted days and says
 * which ones, so that message is surfaced straight to the user.
 */
export interface DownloadableStoreGroup {
  id: number;
  code: string;
  name: string;
}

export function PeriodReportDownload({
  storeId,
  storeCode,
  anchorDate,
  disabled,
  group,
}: {
  storeId: number;
  storeCode: string;
  anchorDate: string;
  disabled?: boolean;
  /** Offered only when the reader can open every store in the group. */
  group?: DownloadableStoreGroup | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function download(periodType: StorePeriodType, scope: 'store' | 'group' = 'store') {
    if (busy) return;
    setBusy(`${scope}-${periodType}`);
    try {
      const { range } = resolveStorePeriod(periodType, anchorDate);
      const query = new URLSearchParams({ period: periodType, date: anchorDate });
      const url =
        scope === 'group' && group
          ? `/api/store-groups/${group.id}/period-report/pdf?${query}`
          : `/api/stores/${storeId}/period-report/pdf?${query}`;
      const name =
        scope === 'group' && group
          ? `${periodType}-cluster-report-${group.code}-${range.from}.pdf`
          : `${periodType}-report-${storeCode}-${range.from}.pdf`;
      await downloadFile(url, name);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** The combined day for both stores, alongside the store's own daily PDF. */
  async function downloadGroupDay() {
    if (busy || !group) return;
    setBusy('group-day');
    try {
      const query = new URLSearchParams({ date: anchorDate });
      await downloadFile(
        `/api/store-groups/${group.id}/daily-report/pdf?${query}`,
        `daily-cluster-report-${group.code}-${anchorDate}.pdf`
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const week = resolveStorePeriod('week', anchorDate).range;
  const month = resolveStorePeriod('month', anchorDate).range;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || Boolean(busy)}>
          {busy ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <CalendarRange data-icon="inline-start" />
          )}
          Period report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>This store</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void download('week')}>
          Week — {week.label}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void download('month')}>
          Month — {month.label}
        </DropdownMenuItem>
        {group ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{group.name} combined</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void downloadGroupDay()}>
              Day — {anchorDate}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void download('week', 'group')}>
              Week — {week.label}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void download('month', 'group')}>
              Month — {month.label}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
