'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, LoaderCircle, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ReferenceDataResponse } from '@/lib/contracts/reference-data';
import { cn } from '@/lib/utils';
import type {
  ReferenceSource,
  WorkflowDefinition,
  WorkflowFieldDefinition,
  WorkflowOption,
  WorkflowShortcut,
} from './workflow-config';
import { WorkflowLifecycle } from './WorkflowLifecycle';
import { ProductCombobox } from './ProductCombobox';
import { customerContactRetentionWindow } from '@/lib/customer-contact-retention';

type FormValue = string | boolean;
type FormValues = Record<string, FormValue>;

const TONE_STYLES: Record<WorkflowDefinition['tone'], string> = {
  blue: 'bg-chart-1/12 text-chart-1',
  green: 'bg-primary/12 text-primary',
  amber: 'bg-chart-2/18 text-amber-800',
  coral: 'bg-chart-3/12 text-destructive',
  teal: 'bg-chart-4/12 text-chart-4',
  orchid: 'bg-chart-5/12 text-chart-5',
};

function datePart(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultFieldValue(field: WorkflowFieldDefinition, references: ReferenceDataResponse): FormValue {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.name === 'storeId' && references.assignedStore) return String(references.assignedStore.id);
  const now = new Date();
  switch (field.defaultPreset) {
    case 'today':
      return datePart(now);
    case 'now': {
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
      return local.toISOString().slice(0, 16);
    }
    case 'year':
      return String(now.getFullYear());
    case 'month-start':
      return datePart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    case 'month-end':
      return datePart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
    case 'retention-end':
      return customerContactRetentionWindow(now).to;
    default:
      return field.type === 'switch' ? false : '';
  }
}

function initialValues(definition: WorkflowDefinition, references: ReferenceDataResponse): FormValues {
  return Object.fromEntries(definition.fields.map((field) => [field.name, defaultFieldValue(field, references)]));
}

function referenceOptions(source: ReferenceSource, references: ReferenceDataResponse): WorkflowOption[] {
  switch (source) {
    case 'stores':
      return references.stores
        .filter((store) => store.type === 'store')
        .map((store) => ({ value: String(store.id), label: store.name }));
    case 'brands':
      return references.brands.map((item) => ({ value: String(item.id), label: item.name }));
    case 'categories':
      return references.categories.map((item) => ({ value: String(item.id), label: item.name }));
    case 'paymentMethods':
      return references.paymentMethods.map((item) => ({ value: String(item.id), label: item.name }));
    case 'expenseCategories':
      return references.expenseCategories.map((item) => ({ value: String(item.id), label: item.name }));
    case 'suppliers':
      return references.suppliers.map((item) => ({ value: String(item.id), label: item.name }));
    case 'cashAccounts':
      return references.cashAccounts.map((item) => ({ value: String(item.id), label: item.name }));
    case 'users':
      return references.users.map((item) => ({
        value: String(item.id),
        label: `${item.name} · ${item.role.replace('-', ' ')}`,
      }));
  }
}

function fieldIsVisible(field: WorkflowFieldDefinition, values: FormValues) {
  if (!field.showWhen) return true;
  const current = values[field.showWhen.field];
  if (field.showWhen.equals !== undefined) return current === field.showWhen.equals;
  if (field.showWhen.truthy) return Boolean(current);
  return true;
}

function buildPayload(definition: WorkflowDefinition, values: FormValues) {
  const payload: Record<string, unknown> = {};
  for (const field of definition.fields) {
    if (!fieldIsVisible(field, values)) continue;
    const value = values[field.name];
    if (field.type === 'switch') {
      payload[field.name] = Boolean(value);
      continue;
    }
    if (value === '' || value === undefined) continue;
    if (['number', 'money', 'score', 'product'].includes(field.type) || field.reference) {
      payload[field.name] = Number(value);
      continue;
    }
    if (field.type === 'datetime') {
      payload[field.name] = new Date(String(value)).toISOString();
      continue;
    }
    payload[field.name] = value;
  }
  return payload;
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? 'The record could not be saved';
}

function WorkflowField({
  field,
  value,
  values,
  references,
  disabled,
  error,
  onChange,
}: {
  field: WorkflowFieldDefinition;
  value: FormValue;
  values: FormValues;
  references: ReferenceDataResponse;
  disabled: boolean;
  error?: string;
  onChange: (value: FormValue) => void;
}) {
  if (!fieldIsVisible(field, values) || field.hidden) return null;
  const id = `workflow-${field.name}`;
  const invalid = Boolean(error);

  if (field.type === 'switch') {
    return (
      <Field orientation="horizontal" data-invalid={invalid} className={cn(field.fullWidth && 'sm:col-span-2')}>
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
        <Switch id={id} checked={Boolean(value)} disabled={disabled} onCheckedChange={onChange} aria-invalid={invalid} />
        {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
        <FieldError>{error}</FieldError>
      </Field>
    );
  }

  return (
    <Field data-invalid={invalid} className={cn(field.fullWidth && 'sm:col-span-2')}>
      <FieldLabel htmlFor={id}>{field.label}{field.required ? <span aria-hidden="true">*</span> : null}</FieldLabel>
      {field.type === 'textarea' ? (
        <Textarea
          id={id}
          value={String(value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === 'select' ? (
        <Select value={String(value)} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
            <SelectValue placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(field.reference ? referenceOptions(field.reference, references) : field.options ?? []).map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : field.type === 'product' ? (
        <ProductCombobox value={String(value)} onChange={onChange} disabled={disabled} />
      ) : field.type === 'score' ? (
        <div className="flex items-center gap-4 rounded-md border border-input px-3 py-3">
          <Slider
            id={id}
            value={[value === '' ? 0 : Number(value)]}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            disabled={disabled}
            aria-invalid={invalid}
            onValueChange={(next) => onChange(String(next[0] ?? 0))}
          />
          <span className="w-10 text-right text-sm font-semibold tabular-nums">{value === '' ? '—' : value}</span>
        </div>
      ) : (
        <Input
          id={id}
          type={field.type === 'money' || field.type === 'number' ? 'number' : field.type === 'datetime' ? 'datetime-local' : field.type}
          inputMode={field.type === 'money' ? 'decimal' : field.type === 'number' ? 'numeric' : undefined}
          value={String(value)}
          placeholder={field.placeholder}
          min={field.minDatePreset === 'today' ? customerContactRetentionWindow().from : field.min}
          max={field.maxDatePreset === 'retention-end' ? customerContactRetentionWindow().to : field.max}
          step={field.step ?? (field.type === 'money' ? 0.01 : undefined)}
          maxLength={field.maxLength}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function WorkflowSheet({
  definition,
  references,
  open,
  onOpenChange,
  onSaved,
}: {
  definition: WorkflowDefinition | null;
  references: ReferenceDataResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (definition && open) {
      setValues(initialValues(definition, references));
      setErrors({});
      setRequestError(null);
    }
  }, [definition, open, references]);

  if (!definition) return null;
  const Icon = definition.icon;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const field of definition!.fields) {
      if (field.required && fieldIsVisible(field, values) && values[field.name] === '') {
        nextErrors[field.name] = `${field.label} is required`;
      }
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setRequestError(null);
    try {
      const endpoint = definition!.endpoint ?? `/api/workflows/${definition!.id}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(definition!, values)),
      });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success(definition!.successMessage ?? `${definition!.title} saved`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      setRequestError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-5 pr-12 text-left">
          <div className="flex items-center gap-3">
            <span className={cn('flex size-10 items-center justify-center rounded-md', TONE_STYLES[definition.tone])}>
              <Icon />
            </span>
            <div className="min-w-0">
              <SheetTitle>{definition.title}</SheetTitle>
              <SheetDescription>{definition.group}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
            {requestError ? (
              <Alert variant="destructive" className="mb-5">
                <AlertCircle />
                <AlertTitle>Could not save</AlertTitle>
                <AlertDescription>{requestError}</AlertDescription>
              </Alert>
            ) : null}
            <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {definition.fields.map((field) => (
                <WorkflowField
                  key={field.name}
                  field={field}
                  value={values[field.name] ?? ''}
                  values={values}
                  references={references}
                  disabled={saving}
                  error={errors[field.name]}
                  onChange={(value) => {
                    setValues((current) => ({ ...current, [field.name]: value }));
                    setErrors((current) => {
                      if (!current[field.name]) return current;
                      const next = { ...current };
                      delete next[field.name];
                      return next;
                    });
                  }}
                />
              ))}
            </FieldGroup>
          </div>
          <SheetFooter className="border-t bg-background px-5 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
              {definition.submitLabel ?? 'Save'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function WorkflowWorkspace({
  title,
  definitions,
  shortcuts = [],
}: {
  title: string;
  definitions: WorkflowDefinition[];
  shortcuts?: WorkflowShortcut[];
}) {
  const [references, setReferences] = useState<ReferenceDataResponse | null>(null);
  const [selected, setSelected] = useState<WorkflowDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lifecycleRefreshKey, setLifecycleRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reference-data', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<ReferenceDataResponse>;
      })
      .then(setReferences)
      .catch((loadError: Error) => {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      });
    return () => controller.abort();
  }, []);

  const groups = useMemo(() => {
    const ordered = new Map<string, Array<WorkflowDefinition | WorkflowShortcut>>();
    for (const item of [...shortcuts, ...definitions]) {
      ordered.set(item.group, [...(ordered.get(item.group) ?? []), item]);
    }
    return [...ordered.entries()];
  }, [definitions, shortcuts]);

  if (error) {
    return (
      <div className="page-shell">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Workflows unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!references) {
    return (
      <div className="page-shell flex flex-col gap-5">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="page-shell flex flex-col gap-7">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold leading-8">{title}</h1>
          {references.assignedStore ? (
            <p className="mt-1 text-sm text-muted-foreground">{references.assignedStore.name}</p>
          ) : null}
        </div>
      </header>

      {definitions.length || shortcuts.length ? (
        <div className="grid gap-x-14 gap-y-8 xl:grid-cols-2">
          {groups.map(([group, items]) => (
            <section key={group} className="min-w-0">
              <h2 className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{group}</h2>
              <div className="divide-y divide-border/55">
                {items.map((item) => {
                  const Icon = item.icon;
                  const row = (
                    <>
                      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', TONE_STYLES[item.tone])}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/55 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <Plus className="size-4" />
                      </span>
                    </>
                  );
                  const className = 'group flex min-h-16 w-full items-center gap-3 rounded-md px-2.5 py-3 text-left transition-[background-color,box-shadow] duration-200 hover:bg-card/80 hover:shadow-[0_1px_2px_oklch(0.25_0.025_235/0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
                  return 'href' in item ? (
                    <Link key={item.href} href={item.href} className={className}>{row}</Link>
                  ) : (
                    <button key={item.id} type="button" className={className} onClick={() => setSelected(item)}>{row}</button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle>No workflows assigned</EmptyTitle>
            <EmptyDescription>This account does not have data-entry access.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <WorkflowLifecycle
        definitions={definitions}
        references={references}
        refreshKey={lifecycleRefreshKey}
      />

      <WorkflowSheet
        definition={selected}
        references={references}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onSaved={() => setLifecycleRefreshKey((current) => current + 1)}
      />
    </div>
  );
}
