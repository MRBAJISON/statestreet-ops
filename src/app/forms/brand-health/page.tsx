'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import RecentEntries from '@/components/ui/RecentEntries';
import { submitEntry } from '@/lib/api';
import { Spinner } from '@/components/ui/BrandedLoader';
import { useOrg } from '@/components/providers/OrgProvider';

export default function BrandFormsPage() {
  const { org } = useOrg();
  const [activeForm, setActiveForm] = useState('brand-score');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const forms = [
    { id: 'brand-score', label: 'Brand Health Score' },
    { id: 'sentiment', label: 'Brand Sentiment' },
    { id: 'competitor', label: 'Competitor Analysis' },
    { id: 'digital', label: 'Digital Reputation' },
    { id: 'voice', label: 'Customer Voice' },
    { id: 'attention', label: 'CEO Attention Items' },
  ];

  const BRANDS = org.brands;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      await submitEntry('brand', activeForm, form);
      setMessage('Saved to the live database. The dashboard reflects it now.');
      form.reset();
    } catch (err) {
      setMessage('Could not save: ' + (err as Error).message);
    } finally {
      setBusy(false);
    }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Brand Health Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Enter brand metrics to update the Brand Health Command Center dashboard</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {forms.map(f => (
          <button key={f.id} onClick={() => setActiveForm(f.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${activeForm === f.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {submitted && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg mb-4 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl">
        {activeForm === 'brand-score' && (
          <FormSection title="Brand Health Score Update" description="Update brand equity scores">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Assessment Date" name="date" type="date" required />
              <FormField label="Brand" name="brand" type="select" required options={BRANDS} />
              <FormField label="Brand Type" name="type" type="select" required options={[
                { label: 'Retail Brand', value: 'retail' }, { label: 'Merchandise Brand', value: 'merchandise' },
              ]} />
              <FormField label="Awareness Score (0-100)" name="awareness" type="number" required min={0} max={100} />
              <FormField label="Consideration Score (0-100)" name="consideration" type="number" required min={0} max={100} />
              <FormField label="Preference Score (0-100)" name="preference" type="number" required min={0} max={100} />
              <FormField label="Satisfaction Score (0-100)" name="satisfaction" type="number" min={0} max={100} />
              <FormField label="Loyalty Score (0-100)" name="loyalty" type="number" min={0} max={100} />
              <FormField label="Advocacy Score (0-100)" name="advocacy" type="number" min={0} max={100} />
              <FormField label="Momentum Score (0-100)" name="momentum" type="number" min={0} max={100} />
              <FormField label="Overall Health Score" name="overall" type="number" min={0} max={100} />
              <FormField label="Trend" name="trend" type="select" options={[
                { label: 'Improving', value: 'up' }, { label: 'Stable', value: 'stable' }, { label: 'Declining', value: 'down' },
              ]} />
            </div>
          </FormSection>
        )}

        {activeForm === 'sentiment' && (
          <FormSection title="Brand Sentiment Tracking" description="Record customer and social sentiment">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Brand" name="brand" type="select" required options={BRANDS} />
              <FormField label="Source" name="source" type="select" required options={[
                { label: 'Social Media', value: 'social' }, { label: 'In-Store Feedback', value: 'in-store' },
                { label: 'Online Reviews', value: 'reviews' }, { label: 'Survey', value: 'survey' },
                { label: 'Customer Service', value: 'cs' },
              ]} />
              <FormField label="Positive Mentions" name="positive" type="number" required />
              <FormField label="Neutral Mentions" name="neutral" type="number" required />
              <FormField label="Negative Mentions" name="negative" type="number" required />
              <FormField label="Key Positive Theme" name="posTheme" placeholder="What are they praising?" />
              <FormField label="Key Negative Theme" name="negTheme" placeholder="What are they complaining about?" />
              <FormField label="Sample Size" name="sampleSize" type="number" />
            </div>
          </FormSection>
        )}

        {activeForm === 'competitor' && (
          <FormSection title="Competitor Analysis" description="Track competitor activity and share of voice">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Competitor" name="competitor" required placeholder="Type the competitor / local business" />
              <FormField label="Share of Voice %" name="sov" type="number" suffix="%" step={0.1} />
              <FormField label="Activity Type" name="activity" type="select" options={[
                { label: 'New Campaign', value: 'campaign' }, { label: 'Price Change', value: 'price' },
                { label: 'New Store / Location', value: 'store' }, { label: 'Promotion', value: 'promo' },
                { label: 'New Collection', value: 'collection' },
              ]} />
              <FormField label="Description" name="description" type="textarea" required placeholder="What is the competitor doing?" />
              <FormField label="Threat Level" name="threat" type="select" options={[
                { label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' },
              ]} />
              <FormField label="Our Response Needed" name="response" type="textarea" placeholder="Recommended action" />
            </div>
          </FormSection>
        )}

        {activeForm === 'digital' && (
          <FormSection title="Digital Reputation Update" description="Update online reputation metrics">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Google Rating (1-5)" name="googleRating" type="number" step={0.1} min={1} max={5} />
              <FormField label="Google Reviews Count" name="googleReviews" type="number" />
              <FormField label="Instagram Sentiment %" name="instaSentiment" type="number" suffix="%" />
              <FormField label="Instagram Followers" name="instaFollowers" type="number" />
              <FormField label="Response Rate %" name="responseRate" type="number" suffix="%" />
              <FormField label="Average Response Time (hours)" name="responseTime" type="number" step={0.1} />
              <FormField label="NPS Score" name="nps" type="number" min={-100} max={100} />
              <FormField label="Trustpilot Score" name="trustpilot" type="number" step={0.1} min={1} max={5} />
              <FormField label="New Reviews This Week" name="newReviews" type="number" />
              <FormField label="Negative Reviews Requiring Response" name="negReviews" type="number" />
            </div>
          </FormSection>
        )}

        {activeForm === 'voice' && (
          <FormSection title="Customer Voice" description="Log customer feedback. Complaints feed Risks; compliments & requests feed Opportunities on the Brand dashboard.">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Brand" name="brand" type="select" options={BRANDS} />
              <FormField label="Type" name="type" type="select" required options={[
                { label: 'Frustration', value: 'frustration' }, { label: 'Complaint', value: 'complaint' },
                { label: 'Negative Feedback', value: 'negative' }, { label: 'Compliment', value: 'compliment' },
                { label: 'Positive Feedback', value: 'positive' }, { label: 'Feature / Product Request', value: 'request' },
              ]} />
              <FormField label="Source" name="source" type="select" options={[
                { label: 'Social Media', value: 'social' }, { label: 'In-Store', value: 'in-store' },
                { label: 'Online Reviews', value: 'reviews' }, { label: 'Survey', value: 'survey' },
                { label: 'Customer Service', value: 'cs' },
              ]} />
              <FormField label="Frequency" name="frequency" type="select" options={[
                { label: 'One-off', value: 'one-off' }, { label: 'Occasional', value: 'occasional' }, { label: 'Frequent', value: 'frequent' },
              ]} />
              <FormField label="Detail" name="detail" type="textarea" placeholder="What did the customer say?" required />
            </div>
          </FormSection>
        )}

        {activeForm === 'attention' && (
          <FormSection title="CEO Attention Item" description="Flag critical issues for CEO attention">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Priority" name="priority" type="select" required options={[
                { label: 'P1 - Immediate', value: 'P1' }, { label: 'P2 - This Week', value: 'P2' },
                { label: 'P3 - This Month', value: 'P3' },
              ]} />
              <FormField label="Issue" name="issue" required placeholder="Brief description of the issue" />
              <FormField label="Impact" name="impact" type="select" required options={[
                { label: 'High Revenue Risk', value: 'high-revenue' }, { label: 'Cash & Margin Risk', value: 'cash-margin' },
                { label: 'Brand Perception Risk', value: 'brand-perception' }, { label: 'Revenue Risk', value: 'revenue' },
                { label: 'Long Term Brand Risk', value: 'long-term' },
              ]} />
              <FormField label="Owner" name="owner" required />
              <FormField label="Due Date" name="dueDate" type="date" required />
              <FormField label="Status" name="status" type="select" required options={[
                { label: 'Not Started', value: 'not-started' }, { label: 'In Progress', value: 'in-progress' },
                { label: 'Completed', value: 'completed' },
              ]} />
              <FormField label="Recommended Action" name="action" type="textarea" placeholder="What should be done?" />
            </div>
          </FormSection>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={busy} className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">{busy ? <><Spinner /> Saving…</> : 'Submit Entry'}</button>
          <button type="reset" className="bg-[var(--c-hover)] border border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)] px-6 py-2.5 rounded-lg transition-colors text-sm">Clear Form</button>
        </div>
      </form>

      <div className="mt-8 max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Your Submissions</h2>
        <RecentEntries department="brand" />
      </div>
    </div>
  );
}
