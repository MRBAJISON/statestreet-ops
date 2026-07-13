'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, LoaderCircle, LockKeyhole, Plus, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { ReferenceDataResponse } from '@/lib/contracts/reference-data';
import type { WeeklyReviewRecord } from '@/lib/contracts/documents';
import { ProductCombobox } from '@/components/forms/ProductCombobox';

interface ReviewValues {
  weekEnd: string;
  summary: string;
  risks: string;
  opportunities: string;
  marketingAmplifyCategoryId: string;
  differentThisWeek: string;
  firstThreeActions: string;
  lockVersion?: number;
}

interface CategoryNoteDraft {
  key: number;
  categoryId: string;
  performanceComment: string;
  overstocked: boolean;
  slowMoving: boolean;
  weeksWithoutMovement: string;
  valueAtRisk: string;
  correctiveAction: string;
  managerComment: string;
}

interface ActionDraft {
  key: number;
  categoryId: string;
  productId: string;
  action: string;
  ownerUserId: string;
  ownerName: string;
  targetUnits: string;
  targetRevenue: string;
  dueDate: string;
  status: 'open' | 'in-progress' | 'completed' | 'cancelled';
  managerComment: string;
}

let nextKey = 1;

function recentSunday() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

function emptyValues(weekEnd = recentSunday()): ReviewValues {
  return {
    weekEnd,
    summary: '',
    risks: '',
    opportunities: '',
    marketingAmplifyCategoryId: '',
    differentThisWeek: '',
    firstThreeActions: '',
  };
}

function emptyCategoryNote(): CategoryNoteDraft {
  return {
    key: nextKey++,
    categoryId: '',
    performanceComment: '',
    overstocked: false,
    slowMoving: false,
    weeksWithoutMovement: '',
    valueAtRisk: '',
    correctiveAction: '',
    managerComment: '',
  };
}

function emptyAction(): ActionDraft {
  return {
    key: nextKey++,
    categoryId: '',
    productId: '',
    action: '',
    ownerUserId: '',
    ownerName: '',
    targetUnits: '',
    targetRevenue: '',
    dueDate: '',
    status: 'open',
    managerComment: '',
  };
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? 'The weekly review could not be saved';
}

function valuesFromReview(review: WeeklyReviewRecord): ReviewValues {
  return {
    weekEnd: review.weekEnd,
    summary: review.summary ?? '',
    risks: review.risks ?? '',
    opportunities: review.opportunities ?? '',
    marketingAmplifyCategoryId: review.marketingAmplifyCategoryId ? String(review.marketingAmplifyCategoryId) : '',
    differentThisWeek: review.differentThisWeek ?? '',
    firstThreeActions: review.firstThreeActions ?? '',
    lockVersion: review.lockVersion,
  };
}

export default function WeeklyReview() {
  const [references, setReferences] = useState<ReferenceDataResponse | null>(null);
  const [values, setValues] = useState<ReviewValues>(() => emptyValues());
  const [review, setReview] = useState<WeeklyReviewRecord | null>(null);
  const [categoryNotes, setCategoryNotes] = useState<CategoryNoteDraft[]>([]);
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'draft' | 'submitted' | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const controller = new AbortController();
    const weekEnd = values.weekEnd;
    setLoading(true);
    fetch(`/api/weekly-reviews?${new URLSearchParams({ weekEnd })}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<{ review: WeeklyReviewRecord | null }>;
      })
      .then(({ review: current }) => {
        setReview(current);
        if (current) {
          setValues(valuesFromReview(current));
          setCategoryNotes(current.categoryNotes.map((note) => ({
            key: nextKey++,
            categoryId: String(note.categoryId),
            performanceComment: note.performanceComment ?? '',
            overstocked: note.overstocked,
            slowMoving: note.slowMoving,
            weeksWithoutMovement: note.weeksWithoutMovement === null ? '' : String(note.weeksWithoutMovement),
            valueAtRisk: note.valueAtRisk ?? '',
            correctiveAction: note.correctiveAction ?? '',
            managerComment: note.managerComment ?? '',
          })));
          setActions(current.actions.map((action) => ({
            key: nextKey++,
            categoryId: action.categoryId ? String(action.categoryId) : '',
            productId: action.productId ? String(action.productId) : '',
            action: action.action,
            ownerUserId: action.ownerUserId ? String(action.ownerUserId) : '',
            ownerName: action.ownerName ?? '',
            targetUnits: action.targetUnits === null ? '' : String(action.targetUnits),
            targetRevenue: action.targetRevenue ?? '',
            dueDate: action.dueDate ?? '',
            status: action.status as ActionDraft['status'],
            managerComment: action.managerComment ?? '',
          })));
        } else {
          setValues(emptyValues(weekEnd));
          setCategoryNotes([]);
          setActions([]);
        }
        setError(null);
      })
      .catch((loadError: Error) => {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [values.weekEnd]);

  function updateCategoryNote(key: number, field: keyof CategoryNoteDraft, value: string | boolean) {
    setCategoryNotes((current) => current.map((note) => note.key === key ? { ...note, [field]: value } : note));
  }

  function updateAction(key: number, field: keyof ActionDraft, value: string) {
    setActions((current) => current.map((action) => action.key === key ? { ...action, [field]: value } : action));
  }

  function validate() {
    if (!values.weekEnd) return 'Week ending is required';
    if (categoryNotes.some((note) => !note.categoryId)) return 'Choose a category for every category note';
    if (new Set(categoryNotes.map((note) => note.categoryId)).size !== categoryNotes.length) return 'Each category can appear only once';
    if (actions.some((action) => !action.action.trim() || (!action.ownerUserId && !action.ownerName.trim()))) {
      return 'Every action needs an action description and owner';
    }
    return null;
  }

  async function save(status: 'draft' | 'submitted') {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(status);
    setError(null);
    try {
      const response = await fetch('/api/weekly-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekEnd: values.weekEnd,
          status,
          summary: values.summary || undefined,
          risks: values.risks || undefined,
          opportunities: values.opportunities || undefined,
          marketingAmplifyCategoryId: values.marketingAmplifyCategoryId ? Number(values.marketingAmplifyCategoryId) : undefined,
          differentThisWeek: values.differentThisWeek || undefined,
          firstThreeActions: values.firstThreeActions || undefined,
          lockVersion: values.lockVersion,
          categoryNotes: categoryNotes.map((note) => ({
            categoryId: Number(note.categoryId),
            performanceComment: note.performanceComment || undefined,
            overstocked: note.overstocked,
            slowMoving: note.slowMoving,
            weeksWithoutMovement: note.weeksWithoutMovement ? Number(note.weeksWithoutMovement) : undefined,
            valueAtRisk: note.valueAtRisk || undefined,
            correctiveAction: note.correctiveAction || undefined,
            managerComment: note.managerComment || undefined,
          })),
          actions: actions.map((action) => ({
            categoryId: action.categoryId ? Number(action.categoryId) : undefined,
            productId: action.productId ? Number(action.productId) : undefined,
            action: action.action,
            ownerUserId: action.ownerUserId ? Number(action.ownerUserId) : undefined,
            ownerName: action.ownerName || undefined,
            targetUnits: action.targetUnits ? Number(action.targetUnits) : undefined,
            targetRevenue: action.targetRevenue || undefined,
            dueDate: action.dueDate || undefined,
            status: action.status,
            managerComment: action.managerComment || undefined,
          })),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as { record: { id: number; status: string; lockVersion: number } };
      setValues((current) => ({ ...current, lockVersion: payload.record.lockVersion }));
      setReview((current) => current ? { ...current, status: payload.record.status as WeeklyReviewRecord['status'], lockVersion: payload.record.lockVersion } : current);
      toast.success(status === 'submitted' ? 'Weekly review submitted' : 'Weekly review draft saved');
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (!references) {
    return (
      <div className="page-shell flex flex-col gap-5"><Skeleton className="h-9 w-56" /><Skeleton className="h-[520px] w-full" /></div>
    );
  }

  const locked = review?.status === 'approved';
  const disabled = Boolean(loading || saving || locked);

  return (
    <div className="page-shell flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" asChild aria-label="Back to store workflows"><Link href="/forms/store-manager"><ArrowLeft /></Link></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold leading-8">Weekly review</h1>
              <Badge variant="outline" className="capitalize">{review?.status ?? 'new'}</Badge>
              {locked ? <LockKeyhole className="text-muted-foreground" /> : null}
            </div>
            <p className="text-sm text-muted-foreground">{references.assignedStore?.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="Week ending"
            className="w-40"
            value={values.weekEnd}
            disabled={Boolean(saving)}
            onChange={(event) => setValues(emptyValues(event.target.value))}
          />
          <Button variant="outline" disabled={disabled} onClick={() => void save('draft')}>
            {saving === 'draft' ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}Save draft
          </Button>
          <Button disabled={disabled} onClick={() => void save('submitted')}>
            {saving === 'submitted' ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}Submit
          </Button>
        </div>
      </header>

      {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Check this review</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {locked ? <Alert><LockKeyhole /><AlertTitle>Review approved</AlertTitle><AlertDescription>Commercial must reopen this review before it can be changed.</AlertDescription></Alert> : null}

      <Tabs defaultValue="review" className="gap-5">
        <TabsList>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="categories">Category notes {categoryNotes.length ? `(${categoryNotes.length})` : ''}</TabsTrigger>
          <TabsTrigger value="actions">Actions {actions.length ? `(${actions.length})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          <section className="border-y bg-card px-4 py-5 sm:px-5">
            <FieldGroup className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field className="md:col-span-2"><FieldLabel htmlFor="review-summary">Week summary</FieldLabel><Textarea id="review-summary" value={values.summary} disabled={disabled} onChange={(event) => setValues((current) => ({ ...current, summary: event.target.value }))} /></Field>
              <Field><FieldLabel htmlFor="review-risks">Risks</FieldLabel><Textarea id="review-risks" value={values.risks} disabled={disabled} onChange={(event) => setValues((current) => ({ ...current, risks: event.target.value }))} /></Field>
              <Field><FieldLabel htmlFor="review-opportunities">Opportunities</FieldLabel><Textarea id="review-opportunities" value={values.opportunities} disabled={disabled} onChange={(event) => setValues((current) => ({ ...current, opportunities: event.target.value }))} /></Field>
              <Field>
                <FieldLabel htmlFor="amplify-category">Marketing focus</FieldLabel>
                <Select value={values.marketingAmplifyCategoryId} onValueChange={(value) => setValues((current) => ({ ...current, marketingAmplifyCategoryId: value }))} disabled={disabled}>
                  <SelectTrigger id="amplify-category" className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent><SelectGroup>{references.categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field><FieldLabel htmlFor="different-this-week">What will you do differently?</FieldLabel><Textarea id="different-this-week" value={values.differentThisWeek} disabled={disabled} onChange={(event) => setValues((current) => ({ ...current, differentThisWeek: event.target.value }))} /></Field>
              <Field className="md:col-span-2"><FieldLabel htmlFor="first-actions">First three actions</FieldLabel><Textarea id="first-actions" value={values.firstThreeActions} disabled={disabled} onChange={(event) => setValues((current) => ({ ...current, firstThreeActions: event.target.value }))} /></Field>
            </FieldGroup>
          </section>
        </TabsContent>

        <TabsContent value="categories" className="flex flex-col gap-4">
          <div className="flex justify-end"><Button variant="outline" size="sm" disabled={disabled} onClick={() => setCategoryNotes((current) => [...current, emptyCategoryNote()])}><Plus data-icon="inline-start" />Add category note</Button></div>
          {categoryNotes.map((note, index) => (
            <section key={note.key} className="surface p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold">Category note {index + 1}</h2>
                <Button variant="ghost" size="icon" aria-label="Remove category note" disabled={disabled} onClick={() => setCategoryNotes((current) => current.filter((item) => item.key !== note.key))}><Trash2 /></Button>
              </div>
              <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <Select value={note.categoryId} onValueChange={(value) => updateCategoryNote(note.key, 'categoryId', value)} disabled={disabled}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent><SelectGroup>{references.categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field><FieldLabel>Weeks without movement</FieldLabel><Input type="number" min={0} step={1} value={note.weeksWithoutMovement} disabled={disabled} onChange={(event) => updateCategoryNote(note.key, 'weeksWithoutMovement', event.target.value)} /></Field>
                <Field><FieldLabel>Value at risk</FieldLabel><Input type="number" min={0} step={0.01} value={note.valueAtRisk} disabled={disabled} onChange={(event) => updateCategoryNote(note.key, 'valueAtRisk', event.target.value)} /></Field>
                <FieldGroup className="gap-3">
                  <Field orientation="horizontal"><FieldLabel>Overstocked</FieldLabel><Switch checked={note.overstocked} disabled={disabled} onCheckedChange={(value) => updateCategoryNote(note.key, 'overstocked', value)} /></Field>
                  <Field orientation="horizontal"><FieldLabel>Slow moving</FieldLabel><Switch checked={note.slowMoving} disabled={disabled} onCheckedChange={(value) => updateCategoryNote(note.key, 'slowMoving', value)} /></Field>
                </FieldGroup>
                <Field className="sm:col-span-2"><FieldLabel>Performance comment</FieldLabel><Textarea value={note.performanceComment} disabled={disabled} onChange={(event) => updateCategoryNote(note.key, 'performanceComment', event.target.value)} /></Field>
                <Field className="sm:col-span-2"><FieldLabel>Corrective action</FieldLabel><Textarea value={note.correctiveAction} disabled={disabled} onChange={(event) => updateCategoryNote(note.key, 'correctiveAction', event.target.value)} /></Field>
                <Field className="sm:col-span-2 lg:col-span-4"><FieldLabel>Manager comment</FieldLabel><Textarea value={note.managerComment} disabled={disabled} onChange={(event) => updateCategoryNote(note.key, 'managerComment', event.target.value)} /></Field>
              </FieldGroup>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="actions" className="flex flex-col gap-4">
          <div className="flex justify-end"><Button variant="outline" size="sm" disabled={disabled} onClick={() => setActions((current) => [...current, emptyAction()])}><Plus data-icon="inline-start" />Add action</Button></div>
          {actions.map((action, index) => (
            <section key={action.key} className="surface p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold">Action {index + 1}</h2>
                <Button variant="ghost" size="icon" aria-label="Remove action" disabled={disabled} onClick={() => setActions((current) => current.filter((item) => item.key !== action.key))}><Trash2 /></Button>
              </div>
              <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field className="sm:col-span-2 lg:col-span-4"><FieldLabel>Action</FieldLabel><Input value={action.action} disabled={disabled} onChange={(event) => updateAction(action.key, 'action', event.target.value)} /></Field>
                <Field>
                  <FieldLabel>Owner</FieldLabel>
                  <Select value={action.ownerUserId} onValueChange={(value) => updateAction(action.key, 'ownerUserId', value)} disabled={disabled}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent><SelectGroup>{references.users.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field><FieldLabel>External owner</FieldLabel><Input value={action.ownerName} disabled={disabled} onChange={(event) => updateAction(action.key, 'ownerName', event.target.value)} /></Field>
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <Select value={action.categoryId} onValueChange={(value) => updateAction(action.key, 'categoryId', value)} disabled={disabled}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent><SelectGroup>{references.categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field><FieldLabel>Product</FieldLabel><ProductCombobox value={action.productId} onChange={(value) => updateAction(action.key, 'productId', value)} disabled={disabled} /></Field>
                <Field><FieldLabel>Target units</FieldLabel><Input type="number" min={0} step={1} value={action.targetUnits} disabled={disabled} onChange={(event) => updateAction(action.key, 'targetUnits', event.target.value)} /></Field>
                <Field><FieldLabel>Target revenue</FieldLabel><Input type="number" min={0} step={0.01} value={action.targetRevenue} disabled={disabled} onChange={(event) => updateAction(action.key, 'targetRevenue', event.target.value)} /></Field>
                <Field><FieldLabel>Due date</FieldLabel><Input type="date" value={action.dueDate} disabled={disabled} onChange={(event) => updateAction(action.key, 'dueDate', event.target.value)} /></Field>
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Select value={action.status} onValueChange={(value) => updateAction(action.key, 'status', value)} disabled={disabled}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="open">Open</SelectItem><SelectItem value="in-progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field className="sm:col-span-2 lg:col-span-4"><FieldLabel>Manager comment</FieldLabel><Textarea value={action.managerComment} disabled={disabled} onChange={(event) => updateAction(action.key, 'managerComment', event.target.value)} /></Field>
              </FieldGroup>
            </section>
          ))}
        </TabsContent>
      </Tabs>

      <p className="sr-only">{review ? `Editing weekly review ${review.id}, version ${review.lockVersion}.` : 'Creating a new weekly review.'}</p>
    </div>
  );
}
