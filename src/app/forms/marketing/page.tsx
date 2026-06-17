'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import RecentEntries from '@/components/ui/RecentEntries';
import { submitEntry } from '@/lib/api';
import { Spinner } from '@/components/ui/BrandedLoader';
import { useOrg } from '@/components/providers/OrgProvider';

export default function MarketingFormsPage() {
  const { org } = useOrg();
  const [activeForm, setActiveForm] = useState('campaign');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Public survey link (resolved from the current origin at runtime).
  const surveyUrl = typeof window !== 'undefined' ? `${window.location.origin}/survey/customer-experience` : '/survey/customer-experience';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(surveyUrl)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(surveyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const forms = [
    { id: 'campaign', label: 'Campaign Performance' },
    { id: 'leads', label: 'Lead Entry' },
    { id: 'social', label: 'Social Media Metrics' },
    { id: 'clienteling', label: 'Clienteling Activity' },
    { id: 'customer-experience', label: 'Customer Experience' },
    { id: 'priorities', label: 'Action Tracker' },
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      await submitEntry('marketing', activeForm, form);
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
        <h1 className="text-xl font-bold">Marketing Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Enter marketing data to update the Marketing Command Center dashboard</p>
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
        {activeForm === 'campaign' && (
          <FormSection title="Campaign Performance" description="Record campaign metrics">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Campaign Name" name="name" required />
              <FormField label="Brand" name="brand" type="select" required options={[
                { label: 'Boulevard Men', value: 'boulevard-men' }, { label: 'Boulevard Women', value: 'boulevard-women' },
                { label: "D'Angelo", value: 'dangelo' }, { label: 'Woodpeckers', value: 'woodpeckers' },
                { label: 'Carbon Shoes', value: 'carbon-shoes' }, { label: 'Arbiter', value: 'arbiter' },
              ]} />
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Total Reach" name="reach" type="number" required />
              <FormField label="Engagement" name="engagement" type="number" required />
              <FormField label="Leads Generated" name="leads" type="number" />
              <FormField label="Store Visits Attributed" name="storeVisits" type="number" />
              <FormField label="Revenue Influenced" name="revenue" type="number" prefix="GHS" step={0.01} />
              <FormField label="Campaign Spend" name="spend" type="number" prefix="GHS" step={0.01} />
              <FormField label="Platform" name="platform" type="select" options={[
                { label: 'Instagram', value: 'instagram' }, { label: 'WhatsApp', value: 'whatsapp' },
                { label: 'Facebook', value: 'facebook' }, { label: 'TikTok', value: 'tiktok' },
                { label: 'Google', value: 'google' }, { label: 'Email', value: 'email' },
                { label: 'In-Store', value: 'in-store' },
              ]} />
              <FormField label="Status" name="status" type="select" options={[
                { label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' },
                { label: 'Completed', value: 'completed' }, { label: 'Planned', value: 'planned' },
              ]} />
            </div>
          </FormSection>
        )}

        {activeForm === 'leads' && (
          <FormSection title="Lead Entry" description="Record new customer leads">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Channel" name="channel" type="select" required options={[
                { label: 'WhatsApp', value: 'whatsapp' }, { label: 'Instagram', value: 'instagram' },
                { label: 'Website', value: 'website' }, { label: 'Walk-In', value: 'walkin' },
                { label: 'Corporate', value: 'corporate' }, { label: 'Referral', value: 'referral' },
              ]} />
              <FormField label="Number of Leads" name="count" type="number" required />
              <FormField label="Qualified Leads" name="qualified" type="number" />
              <FormField label="Converted to Customer" name="converted" type="number" />
              <FormField label="Average Lead Value" name="avgValue" type="number" prefix="GHS" step={0.01} />
              <FormField label="Campaign Source" name="campaignSource" placeholder="Which campaign drove these?" />
              <FormField label="Notes" name="notes" type="textarea" placeholder="Lead quality notes" />
            </div>
          </FormSection>
        )}

        {activeForm === 'social' && (
          <FormSection title="Social Media Metrics" description="Daily social media performance">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Platform" name="platform" type="select" required options={[
                { label: 'Instagram', value: 'instagram' }, { label: 'Facebook', value: 'facebook' },
                { label: 'TikTok', value: 'tiktok' }, { label: 'Twitter/X', value: 'twitter' },
                { label: 'YouTube', value: 'youtube' },
              ]} />
              <FormField label="Followers / Subscribers" name="followers" type="number" />
              <FormField label="Posts Published" name="posts" type="number" />
              <FormField label="Reach" name="reach" type="number" />
              <FormField label="Impressions" name="impressions" type="number" />
              <FormField label="Engagement (Likes + Comments + Shares)" name="engagement" type="number" />
              <FormField label="Link Clicks" name="clicks" type="number" />
              <FormField label="Website Visits from Social" name="webVisits" type="number" />
              <FormField label="Reels / Videos Created" name="reels" type="number" />
              <FormField label="Stories Published" name="stories" type="number" />
            </div>
          </FormSection>
        )}

        {activeForm === 'clienteling' && (
          <FormSection title="Clienteling Activity" description="VIP engagement and client outreach">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Activity Type" name="type" type="select" required options={[
                { label: 'VIP Event', value: 'vip-event' }, { label: 'Lookbook Sent', value: 'lookbook' },
                { label: 'WhatsApp Broadcast', value: 'broadcast' }, { label: 'Personal Invitation', value: 'invitation' },
                { label: 'Appointment Booking', value: 'appointment' }, { label: 'Follow-Up Call', value: 'followup' },
              ]} />
              <FormField label="Number of Clients Contacted" name="contacted" type="number" required />
              <FormField label="Responses / RSVPs" name="responses" type="number" />
              <FormField label="Appointments Booked" name="appointments" type="number" />
              <FormField label="Estimated Revenue from Activity" name="estRevenue" type="number" prefix="GHS" step={0.01} />
              <FormField label="Store" name="store" type="select" options={[
                { label: 'Dzorwulu Men', value: 'dzorwulu-men' }, { label: 'East Legon Men', value: 'east-legon-men' },
                { label: 'Labone Men', value: 'labone-men' }, { label: "D'Angelo Palace", value: 'dangelo' },
              ]} />
              <FormField label="Notes" name="notes" type="textarea" placeholder="Key takeaways" />
            </div>
          </FormSection>
        )}

        {activeForm === 'customer-experience' && (
          <>
          {/* Public survey share panel */}
          <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <img src={qrUrl} alt="Customer survey QR code" width={110} height={110} className="rounded bg-white p-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold mb-1">Customer Survey Link</div>
                <p className="text-xs text-gray-500 mb-2">Share this public link (or QR) with customers. Their responses appear here and on the Marketing dashboard — no login needed.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input readOnly value={surveyUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 bg-[var(--c-hover)] border border-[var(--c-border)] rounded px-3 py-2 text-xs text-[var(--c-fg)]" />
                  <div className="flex gap-2">
                    <button type="button" onClick={copyLink} className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold rounded px-3 py-2 text-xs whitespace-nowrap">
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                    <a href={surveyUrl} target="_blank" rel="noopener noreferrer" className="border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)] rounded px-3 py-2 text-xs whitespace-nowrap">Open</a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <FormSection title="Customer Experience" description="Log feedback manually here, or let customers self-serve via the survey link above">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Source" name="source" type="select" options={[
                { label: 'In-Store', value: 'in-store' }, { label: 'Survey Link', value: 'survey' },
                { label: 'Social Media', value: 'social' }, { label: 'Online Review', value: 'reviews' },
                { label: 'Customer Service', value: 'cs' },
              ]} />
              <FormField label="Type" name="type" type="select" required options={[
                { label: 'Customer Objection', value: 'objection' }, { label: 'Competitor Mention', value: 'competitor' },
                { label: 'Product Request', value: 'request' }, { label: 'Compliment', value: 'compliment' },
                { label: 'Complaint', value: 'complaint' }, { label: 'General Feedback', value: 'feedback' },
              ]} />
              <FormField label="Feedback Category" name="category" type="select" options={[
                { label: 'Store Cleanliness', value: 'cleanliness' }, { label: 'Staff Knowledge', value: 'staff-knowledge' },
                { label: 'Product Availability', value: 'availability' }, { label: 'Fitting Room', value: 'fitting-room' },
                { label: 'Checkout Speed', value: 'checkout' }, { label: 'Overall Experience', value: 'overall' },
              ]} />
              <FormField label="NPS Score (-100 to 100)" name="nps" type="number" min={-100} max={100} />
              <FormField label="Would Recommend" name="recommend" type="select" options={[
                { label: 'Yes - Promoter', value: 'promoter' }, { label: 'Maybe - Passive', value: 'passive' },
                { label: 'No - Detractor', value: 'detractor' },
              ]} />
              <FormField label="Store" name="store" type="select" options={[...org.stores, { label: 'All Stores', value: 'all' }]} />
              <FormField label="Frequency (How often heard)" name="frequency" type="select" options={[
                { label: 'Very Frequent', value: 'very-frequent' }, { label: 'Frequent', value: 'frequent' },
                { label: 'Occasional', value: 'occasional' }, { label: 'Rare', value: 'rare' },
              ]} />
              <FormField label="Detail / Comments" name="detail" required placeholder="What did the customer say?" />
              <FormField label="Action Needed" name="action" type="textarea" placeholder="Suggested action" />
            </div>
          </FormSection>
          </>
        )}

        {activeForm === 'priorities' && (
          <FormSection title="Marketing Action Tracker" description="Update marketing priority tasks">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Task" name="task" required placeholder="Task description" />
              <FormField label="Key Action" name="keyAction" required placeholder="Primary action" />
              <FormField label="Owner" name="owner" required />
              <FormField label="Deadline" name="deadline" type="date" required />
              <FormField label="Status" name="status" type="select" required options={[
                { label: 'Not Started', value: 'not-started' }, { label: 'In Progress', value: 'in-progress' },
                { label: 'Completed', value: 'completed' }, { label: 'Blocked', value: 'blocked' },
              ]} />
              <FormField label="Priority" name="priority" type="select" options={[
                { label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' },
              ]} />
              <FormField label="Notes" name="notes" type="textarea" placeholder="Progress notes" />
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
        <RecentEntries department="marketing" />
      </div>
    </div>
  );
}
