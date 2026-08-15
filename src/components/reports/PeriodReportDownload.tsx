'use client';

import { useState } from 'react';
import { CalendarRange, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadFile } from '@/lib/download-file';
import { resolveStorePeriod, type StorePeriodType } from '@/lib/reporting/store-period';

/**
 * Downloads the weekly (Mon-Sat) or monthly report for the period containing
 * `anchorDate`. The API refuses a period that still has unsubmitted days and says
 * which ones, so that message is surfaced straight to the user.
 */
export function PeriodReportDownload({
  storeId,
  storeCode,
  anchorDate,
  disabled,
}: {
  storeId: number;
  storeCode: string;
  anchorDate: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<StorePeriodType | null>(null);

  async function download(periodType: StorePeriodType) {
    if (busy) return;
    setBusy(periodType);
    try {
      const { range } = resolveStorePeriod(periodType, anchorDate);
      const query = new URLSearchParams({ period: periodType, date: anchorDate });
      await downloadFile(
        `/api/stores/${storeId}/period-report/pdf?${query}`,
        `${periodType}-report-${storeCode}-${range.from}.pdf`
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
        <DropdownMenuItem onSelect={() => void download('week')}>
          Week — {week.label}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void download('month')}>
          Month — {month.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
