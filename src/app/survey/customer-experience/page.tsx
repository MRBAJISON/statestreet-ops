'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, Layers3, LoaderCircle, MessageSquareText, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const CATEGORIES = [
  { label: 'Store cleanliness', value: 'cleanliness' },
  { label: 'Staff knowledge and service', value: 'staff-knowledge' },
  { label: 'Product availability', value: 'availability' },
  { label: 'Fitting room experience', value: 'fitting-room' },
  { label: 'Checkout speed', value: 'checkout' },
  { label: 'Overall experience', value: 'overall' },
] as const;

interface Bootstrap {
  organization: { name: string; tagline: string; logo: string };
  stores: Array<{ id: number; code: string; name: string }>;
}

interface SurveyForm {
  storeId: string;
  category: string;
  npsScore: string;
  recommendation: string;
  detail: string;
  contactName: string;
  contactValue: string;
  contactConsent: boolean;
  company: string;
}

const EMPTY_FORM: SurveyForm = {
  storeId: '',
  category: '',
  npsScore: '',
  recommendation: '',
  detail: '',
  contactName: '',
  contactValue: '',
  contactConsent: false,
  company: '',
};

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? 'Feedback could not be submitted';
}

export default function CustomerExperienceSurvey() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [form, setForm] = useState<SurveyForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/survey', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        setBootstrap((await response.json()) as Bootstrap);
      })
      .catch((caught) => { if (!controller.signal.aborted) setError((caught as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: Number(form.storeId),
          category: form.category,
          ...(form.npsScore ? { npsScore: Number(form.npsScore) } : {}),
          ...(form.recommendation ? { recommendation: form.recommendation } : {}),
          detail: form.detail.trim() || null,
          contactConsent: form.contactConsent,
          ...(form.contactConsent ? { contactName: form.contactName.trim() || null, contactValue: form.contactValue.trim() || null } : {}),
          company: form.company,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setDone(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSending(false);
    }
  }

  const organization = bootstrap?.organization ?? { name: 'StateStreet', tagline: 'Retail Group', logo: '' };
  const hasFeedback = Boolean(form.npsScore || form.recommendation || form.detail.trim());

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-7 flex items-center justify-between gap-4 border-b pb-5">
          <div className="flex min-w-0 items-center gap-3">
            {organization.logo ? (
              <Image src={organization.logo} alt="" width={42} height={42} className="size-10 rounded-md object-contain" unoptimized />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm"><Layers3 className="size-5" /></span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{organization.name}</p>
              <p className="truncate text-xs text-muted-foreground">{organization.tagline}</p>
            </div>
          </div>
          <span className="flex size-9 items-center justify-center rounded-md bg-chart-5/12 text-chart-5"><MessageSquareText className="size-4" /></span>
        </header>

        {done ? (
          <section className="surface flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/12 text-primary"><CheckCircle2 className="size-7" /></span>
            <h1 className="text-2xl font-semibold">Thank you</h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Your feedback has been received.</p>
            <Button className="mt-6" variant="outline" onClick={() => { setForm(EMPTY_FORM); setDone(false); }}>Submit another response</Button>
          </section>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">How was your visit?</h1>
              <p className="mt-1 text-sm text-muted-foreground">Share your experience with the StateStreet team.</p>
            </div>
            <form onSubmit={submit} className="surface px-5 py-6 sm:px-7">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Store</FieldLabel>
                    <Select value={form.storeId} onValueChange={(storeId) => setForm((current) => ({ ...current, storeId }))} required disabled={loading}>
                      <SelectTrigger className="h-10 w-full"><SelectValue placeholder={loading ? 'Loading stores…' : 'Select store'} /></SelectTrigger>
                      <SelectContent><SelectGroup>{bootstrap?.stores.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Feedback area</FieldLabel>
                    <Select value={form.category} onValueChange={(category) => setForm((current) => ({ ...current, category }))} required>
                      <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select area" /></SelectTrigger>
                      <SelectContent><SelectGroup>{CATEGORIES.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Likelihood to recommend</FieldLabel>
                  <div className="grid grid-cols-11 gap-1" role="group" aria-label="Recommendation score from 0 to 10">
                    {Array.from({ length: 11 }, (_, score) => (
                      <Button
                        key={score}
                        type="button"
                        variant={form.npsScore === String(score) ? 'default' : 'outline'}
                        size="sm"
                        className="h-9 min-w-0 px-0"
                        onClick={() => setForm((current) => ({ ...current, npsScore: String(score) }))}
                        aria-pressed={form.npsScore === String(score)}
                      >
                        {score}
                      </Button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Not likely</span><span>Very likely</span></div>
                </Field>

                <Field>
                  <FieldLabel>Would you shop with us again?</FieldLabel>
                  <ToggleGroup type="single" value={form.recommendation} onValueChange={(recommendation) => setForm((current) => ({ ...current, recommendation }))} variant="outline" spacing={2} className="grid w-full grid-cols-3">
                    <ToggleGroupItem value="yes">Yes</ToggleGroupItem>
                    <ToggleGroupItem value="likely">Maybe</ToggleGroupItem>
                    <ToggleGroupItem value="no">No</ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                <Field>
                  <FieldLabel htmlFor="survey-detail">Comments</FieldLabel>
                  <Textarea id="survey-detail" value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} rows={4} placeholder="What stood out, or what should we improve?" />
                </Field>

                <Field orientation="horizontal" className="rounded-md border bg-muted/35 px-3 py-3">
                  <Checkbox id="contact-consent" checked={form.contactConsent} onCheckedChange={(checked) => setForm((current) => ({ ...current, contactConsent: checked === true, ...(!checked ? { contactName: '', contactValue: '' } : {}) }))} />
                  <FieldLabel htmlFor="contact-consent" className="font-normal">I agree to be contacted about this feedback.</FieldLabel>
                </Field>
                {form.contactConsent ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="contact-name">Name</FieldLabel>
                      <Input id="contact-name" value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} className="h-10" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="contact-value">Phone or email</FieldLabel>
                      <Input id="contact-value" value={form.contactValue} onChange={(event) => setForm((current) => ({ ...current, contactValue: event.target.value }))} className="h-10" required />
                    </Field>
                  </div>
                ) : null}

                <Input name="company" value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                {error ? <FieldError>{error}</FieldError> : null}
                <Button type="submit" size="lg" className="w-full" disabled={sending || loading || !form.storeId || !form.category || !hasFeedback}>
                  {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
                  Submit feedback
                </Button>
              </FieldGroup>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
