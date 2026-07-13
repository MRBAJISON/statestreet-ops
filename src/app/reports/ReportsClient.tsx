'use client';

import { useState } from 'react';
import {
  CalendarRange,
  Database,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ExportScope } from '@/lib/export';

type DatePreset = 'month' | 'last-7' | 'last-30' | 'all' | 'custom';

interface ReportsClientProps {
  scope: ExportScope;
  label: string;
  description: string;
  includeCustomerContacts: boolean;
}

const pad = (value: number) => String(value).padStart(2, '0');
const toIsoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function today(): string {
  return toIsoDate(new Date());
}

function monthStart(): string {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

function inclusiveDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return toIsoDate(date);
}

function filenameFromDisposition(disposition: string | null): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? 'statestreet-export.xlsx';
}

export default function ReportsClient({
  scope,
  label,
  description,
  includeCustomerContacts,
}: ReportsClientProps) {
  const [preset, setPreset] = useState<DatePreset>('month');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const invalidRange = Boolean(from && to && from > to);
  const rangeLabel = !from && !to ? 'All time' : `${from || 'Start'} to ${to || 'Today'}`;

  function applyPreset(value: string) {
    if (!value) return;
    const next = value as Exclude<DatePreset, 'custom'>;
    setPreset(next);
    setDownloadError('');
    if (next === 'month') {
      setFrom(monthStart());
      setTo(today());
    } else if (next === 'last-7') {
      setFrom(inclusiveDaysAgo(7));
      setTo(today());
    } else if (next === 'last-30') {
      setFrom(inclusiveDaysAgo(30));
      setTo(today());
    } else {
      setFrom('');
      setTo('');
    }
  }

  async function download() {
    if (invalidRange || downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const params = new URLSearchParams({ scope });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await fetch(`/api/export?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'The export could not be prepared');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filenameFromDisposition(response.headers.get('Content-Disposition'));
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'The export could not be prepared');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Data export</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          <Database data-icon="inline-start" aria-hidden="true" />
          Typed PostgreSQL
        </Badge>
      </header>

      {downloadError ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Export failed</AlertTitle>
          <AlertDescription>{downloadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader>
            <CardTitle>Date range</CardTitle>
            <CardDescription>{rangeLabel}</CardDescription>
            <CardAction>
              <CalendarRange aria-hidden="true" className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ToggleGroup
              type="single"
              value={preset === 'custom' ? '' : preset}
              onValueChange={applyPreset}
              variant="outline"
              spacing={0}
              className="grid w-full grid-cols-2 sm:grid-cols-4"
              aria-label="Date preset"
            >
              <ToggleGroupItem value="month" className="min-w-0">This month</ToggleGroupItem>
              <ToggleGroupItem value="last-7" className="min-w-0">Last 7 days</ToggleGroupItem>
              <ToggleGroupItem value="last-30" className="min-w-0">Last 30 days</ToggleGroupItem>
              <ToggleGroupItem value="all" className="min-w-0">All time</ToggleGroupItem>
            </ToggleGroup>

            <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field data-invalid={invalidRange || undefined}>
                <FieldLabel htmlFor="export-from">From</FieldLabel>
                <Input
                  id="export-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  aria-invalid={invalidRange}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPreset('custom');
                    setDownloadError('');
                  }}
                />
              </Field>
              <Field data-invalid={invalidRange || undefined}>
                <FieldLabel htmlFor="export-to">To</FieldLabel>
                <Input
                  id="export-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  aria-invalid={invalidRange}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPreset('custom');
                    setDownloadError('');
                  }}
                />
              </Field>
            </FieldGroup>
            {invalidRange ? <FieldDescription className="text-destructive">From cannot be after To.</FieldDescription> : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" size="lg" disabled={downloading || invalidRange} onClick={download}>
              {downloading ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" />
              ) : (
                <Download data-icon="inline-start" aria-hidden="true" />
              )}
              {downloading ? 'Preparing workbook' : 'Download Excel workbook'}
            </Button>
          </CardFooter>
        </Card>

        <Card size="sm" className="h-fit">
          <CardHeader>
            <CardTitle>Export scope</CardTitle>
            <CardDescription>Server-enforced access</CardDescription>
            <CardAction>
              <FileSpreadsheet aria-hidden="true" className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Scope</span>
              <span className="text-base font-semibold">{label}</span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Date basis</span>
              <span className="text-sm">{rangeLabel}</span>
            </div>
            <Separator />
            <div className="flex gap-2">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Customer contacts</span>
                <span className="text-sm">
                  {includeCustomerContacts ? 'Included for this operational scope' : 'Excluded from this workbook'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
