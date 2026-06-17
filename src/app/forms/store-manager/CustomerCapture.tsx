'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import { postEntry, deleteEntry, type EntryRow } from '@/lib/api';
import { Spinner } from '@/components/ui/BrandedLoader';

// Customer database / walk-in capture (saved as commercial/customer-capture).
// One entry per walk-in. Especially important for Carbon Shoes.
const LEAD_BUYER = [
  { label: 'Lead', value: 'lead' },
  { label: 'Buyer', value: 'buyer' },
];

const SOURCES = [
  { label: 'Social Media', value: 'social-media' },
  { label: 'Billboard', value: 'billboard' },
  { label: 'SMS', value: 'sms' },
  { label: 'Calls', value: 'calls' },
  { label: 'Referral', value: 'referral' },
  { label: 'Walk / Drive by', value: 'walk-drive' },
  { label: 'Other', value: 'other' },
];
const SOURCE_LABELS: Record<string, string> = Object.fromEntries(SOURCES.map((s) => [s.value, s.label]));

// Sources that warrant a free-text detail, with a tailored prompt.
const DETAIL_LABEL: Record<string, string> = {
  'social-media': 'Which platform? (e.g. WhatsApp, Instagram)',
  referral: 'Who referred them?',
  other: 'Please specify',
};

export default function CustomerCapture({ assignedStore, managerName, recent, onSaved }: { assignedStore: string; managerName: string; recent: EntryRow[]; onSaved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [source, setSource] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => { payload[k] = typeof v === 'string' ? v : ''; });
    payload.store = assignedStore;
    setSubmitting(true);
    try {
      await postEntry('commercial', 'customer-capture', payload);
      setMsg({ ok: true, text: 'Customer captured.' });
      form.reset();
      setSource('');
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: 'Could not save: ' + (err as Error).message });
    }
    setSubmitting(false);
    setTimeout(() => setMsg(null), 4000);
  }

  async function remove(id: number) {
    try { await deleteEntry(id); onSaved(); } catch { /* ignore */ }
  }

  const recentSorted = [...recent].sort((a, b) => (String(a.payload.date) < String(b.payload.date) ? 1 : -1)).slice(0, 8);

  return (
    <FormSection title="Customer Capture" description="Record every walk-in customer — especially important for Carbon Shoes. One entry per customer.">
      {msg && (
        <div className={`mb-3 text-sm p-3 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{msg.text}</div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-1">
          <FormField label="Date" name="date" type="date" required />
          <FormField label="Customer Name" name="name" required placeholder="Full name" />
          <FormField label="Lead / Buyer" name="leadBuyer" type="select" required options={LEAD_BUYER} />
          <FormField label="Phone Number" name="number" required placeholder="e.g. 024 000 0000" />
          <FormField label="Occupation" name="occupation" placeholder="Optional" />
          <FormField label="Size" name="size" placeholder="e.g. 42 / UK 9" />
          <FormField label="Item of Interest" name="item" placeholder="e.g. Carbon sneakers" />
          <FormField label="Source" name="source" type="select" required value={source} onChange={(e) => setSource(e.target.value)} options={SOURCES} />
          {DETAIL_LABEL[source] && (
            <FormField label={DETAIL_LABEL[source]} name="sourceDetail" placeholder="Specify" />
          )}
          <FormField label="Captured By (Staff)" name="staff" required defaultValue={managerName} />
        </div>
        <button type="submit" disabled={submitting}
          className="mt-3 bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
          {submitting ? <><Spinner /> Saving…</> : 'Save Customer'}
        </button>
      </form>

      {recentSorted.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-2">Recent captures (this store)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">Date</th>
                  <th className="text-left py-2 pr-3 font-medium">Name</th>
                  <th className="text-left py-2 pr-3 font-medium">Type</th>
                  <th className="text-left py-2 pr-3 font-medium">Phone</th>
                  <th className="text-left py-2 pr-3 font-medium">Source</th>
                  <th className="text-right py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentSorted.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--c-hover)]">
                    <td className="py-2 pr-3 whitespace-nowrap">{String(e.payload.date || '—')}</td>
                    <td className="py-2 pr-3">{String(e.payload.name || '—')}</td>
                    <td className="py-2 pr-3 capitalize">{String(e.payload.leadBuyer || '—')}</td>
                    <td className="py-2 pr-3">{String(e.payload.number || '—')}</td>
                    <td className="py-2 pr-3">{SOURCE_LABELS[String(e.payload.source)] ?? String(e.payload.source || '—')}{e.payload.sourceDetail ? ` · ${e.payload.sourceDetail}` : ''}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => remove(e.id)} className="text-gray-400 hover:text-red-400">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FormSection>
  );
}
