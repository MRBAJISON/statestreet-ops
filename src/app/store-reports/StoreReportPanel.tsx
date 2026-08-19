'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, Download, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { downloadFile } from '@/lib/download-file';
import { resolveStorePeriod } from '@/lib/reporting/store-period';

interface StoreOption {
  id: number;
  code: string;
  name: string;
}

interface GroupOption {
  id: number;
  code: string;
  name: string;
  storeIds: number[];
}

type Period = 'day' | 'week' | 'month';

const GROUP_WIDE = 'group-wide';

/**
 * Store, cluster and whole-business reports.
 *
 * The endpoints refuse a period that still has unsubmitted days and say exactly
 * which ones, so that message is surfaced rather than reduced to "failed" — it is
 * the difference between knowing what to chase and guessing.
 */
export function StoreReportPanel() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [canReadGroupWide, setCanReadGroupWide] = useState(false);
  const [selection, setSelection] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState<Period | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch('/api/stores', { cache: 'no-store' });
      if (!response.ok || cancelled) return;
      const payload = (await response.json()) as {
        stores: StoreOption[];
        groups: GroupOption[];
        canReadGroupWide: boolean;
      };
      if (cancelled) return;
      setStores(payload.stores);
      setGroups(payload.groups);
      setCanReadGroupWide(payload.canReadGroupWide);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const week = resolveStorePeriod('week', date).range;
  const month = resolveStorePeriod('month', date).range;

  async function download(period: Period) {
    if (!selection || busy) return;
    setBusy(period);
    setError('');
    try {
      const range = period === 'week' ? week : period === 'month' ? month : null;
      const anchor = range?.from ?? date;

      let url: string;
      let filename: string;
      if (selection === GROUP_WIDE) {
        url = `/api/reports/group/pdf?period=${period}&date=${date}`;
        filename = `group-${period}-report-${anchor}.pdf`;
      } else if (selection.startsWith('group:')) {
        const group = groups.find((item) => String(item.id) === selection.slice(6));
        if (!group) return;
        url =
          period === 'day'
            ? `/api/store-groups/${group.id}/daily-report/pdf?date=${date}`
            : `/api/store-groups/${group.id}/period-report/pdf?period=${period}&date=${date}`;
        filename =
          period === 'day'
            ? `daily-cluster-report-${group.code}-${date}.pdf`
            : `${period}-cluster-report-${group.code}-${anchor}.pdf`;
      } else {
        const store = stores.find((item) => String(item.id) === selection);
        if (!store) return;
        if (period === 'day') {
          // The single-store daily PDF is keyed by report id, so it is reached
          // through the store's own day rather than a store-and-date pair.
          const lookup = await fetch(`/api/daily-reports?storeId=${store.id}&from=${date}&to=${date}`, {
            cache: 'no-store',
          });
          const payload = (await lookup.json()) as { reports?: { id: number; status: string }[]; error?: string };
          if (!lookup.ok) throw new Error(payload.error ?? 'That day could not be loaded');
          const report = payload.reports?.[0];
          if (!report) throw new Error(`${store.name} has not filed a report for ${date}`);
          url = `/api/daily-reports/${report.id}/pdf`;
          filename = `daily-report-${store.code}-${date}.pdf`;
        } else {
          url = `/api/stores/${store.id}/period-report/pdf?period=${period}&date=${date}`;
          filename = `${period}-report-${store.code}-${anchor}.pdf`;
        }
      }

      await downloadFile(url, filename);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The report could not be prepared';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 sm:p-5">
      <section className="surface p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Store reports</h2>
        <p className="text-sm text-muted-foreground">
          The formatted daily, weekly and monthly PDFs a store files. Grouped stores and the whole business are
          combined into one document with a per-store split.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field className="min-w-64">
          <FieldLabel>Store</FieldLabel>
          <Select value={selection} onValueChange={setSelection}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choose a store" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {canReadGroupWide ? <SelectItem value={GROUP_WIDE}>All stores combined</SelectItem> : null}
                {groups.map((group) => (
                  <SelectItem key={`group-${group.id}`} value={`group:${group.id}`}>
                    {group.name} (combined)
                  </SelectItem>
                ))}
                {stores.map((store) => (
                  <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field className="w-44">
          <FieldLabel htmlFor="report-date">Date</FieldLabel>
          <Input id="report-date" type="date" className="h-10" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={!selection || Boolean(busy)} onClick={() => void download('day')}>
            {busy === 'day' ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Download data-icon="inline-start" />}
            Daily
          </Button>
          <Button type="button" variant="outline" disabled={!selection || Boolean(busy)} onClick={() => void download('week')}>
            {busy === 'week' ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <CalendarRange data-icon="inline-start" />}
            Weekly
          </Button>
          <Button type="button" variant="outline" disabled={!selection || Boolean(busy)} onClick={() => void download('month')}>
            {busy === 'month' ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <CalendarRange data-icon="inline-start" />}
            Monthly
          </Button>
        </div>
      </div>

      {/* The resolved ranges, so nobody downloads the wrong week from a date in it. */}
      <p className="mt-3 text-xs text-muted-foreground">
        Weekly covers {week.label} (Monday to Saturday). Monthly covers {month.label}.
      </p>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </section>
    </div>
  );
}
