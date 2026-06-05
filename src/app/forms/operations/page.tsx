'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import { submitEntry } from '@/lib/api';

const STORES = [
  { label: 'Dzorwulu Men', value: 'dzorwulu-men' }, { label: 'East Legon Men', value: 'east-legon-men' },
  { label: 'Labone Men', value: 'labone-men' }, { label: 'Boulevard Women Labone', value: 'bw-labone' },
  { label: 'Boulevard Women Dzorwulu', value: 'bw-dzorwulu' }, { label: "D'Angelo Palace", value: 'dangelo' },
  { label: 'Woodpeckers', value: 'woodpeckers' },
];

export default function OperationsFormsPage() {
  const [activeForm, setActiveForm] = useState('store-audit');
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  const forms = [
    { id: 'store-audit', label: 'Store Audit' },
    { id: 'vm-check', label: 'VM Compliance' },
    { id: 'maintenance', label: 'Maintenance Request' },
    { id: 'cx-feedback', label: 'Customer Experience' },
    { id: 'incident', label: 'Incident Report' },
    { id: 'sop-check', label: 'SOP Compliance' },
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await submitEntry('operations', activeForm, form);
      setMessage('Saved to the live database. The dashboard reflects it now.');
      form.reset();
    } catch (err) {
      setMessage('Could not save: ' + (err as Error).message);
    }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Operations Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Enter operations data to update the Business Operations Command Center</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {forms.map(f => (
          <button key={f.id} onClick={() => setActiveForm(f.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${activeForm === f.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[#111] border border-[#2a2a2a] text-gray-400 hover:text-white'}`}>
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
        {activeForm === 'store-audit' && (
          <FormSection title="Store Operations Audit" description="Complete store audit checklist">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={STORES} />
              <FormField label="Auditor" name="auditor" required />
              <FormField label="Operations Score %" name="opsScore" type="number" suffix="%" required min={0} max={100} />
              <FormField label="VM Score %" name="vmScore" type="number" suffix="%" required min={0} max={100} />
              <FormField label="Readiness Score %" name="readinessScore" type="number" suffix="%" required min={0} max={100} />
              <FormField label="CX Score %" name="cxScore" type="number" suffix="%" required min={0} max={100} />
              <FormField label="Cleanliness Score %" name="cleanScore" type="number" suffix="%" min={0} max={100} />
              <FormField label="Safety Score %" name="safetyScore" type="number" suffix="%" min={0} max={100} />
              <FormField label="Key Issues Found" name="issues" type="textarea" placeholder="List any issues found during audit" />
              <FormField label="Overall Status" name="status" type="select" options={[
                { label: 'Pass (>90%)', value: 'pass' }, { label: 'Watch (70-89%)', value: 'watch' }, { label: 'Fail (<70%)', value: 'fail' },
              ]} />
            </div>
          </FormSection>
        )}

        {activeForm === 'vm-check' && (
          <FormSection title="Visual Merchandising Compliance" description="Check VM standards per store">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={STORES} />
              <FormField label="Window Display Compliance %" name="windowDisplay" type="number" suffix="%" min={0} max={100} />
              <FormField label="Mannequin Styling %" name="mannequin" type="number" suffix="%" min={0} max={100} />
              <FormField label="Product Presentation %" name="productPresentation" type="number" suffix="%" min={0} max={100} />
              <FormField label="Signage & POS %" name="signage" type="number" suffix="%" min={0} max={100} />
              <FormField label="Cleanliness & Lighting %" name="cleanliness" type="number" suffix="%" min={0} max={100} />
              <FormField label="Overall VM Score %" name="overallVM" type="number" suffix="%" required min={0} max={100} />
              <FormField label="Needs Improvement" name="improvements" type="textarea" placeholder="Areas needing improvement" />
            </div>
          </FormSection>
        )}

        {activeForm === 'maintenance' && (
          <FormSection title="Maintenance Request" description="Submit maintenance work orders">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date Reported" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={STORES} />
              <FormField label="Category" name="category" type="select" required options={[
                { label: 'Electrical', value: 'electrical' }, { label: 'HVAC / Air Conditioning', value: 'hvac' },
                { label: 'Plumbing', value: 'plumbing' }, { label: 'Carpentry', value: 'carpentry' },
                { label: 'Painting', value: 'painting' }, { label: 'Security Systems', value: 'security' },
                { label: 'IT / Network', value: 'it' }, { label: 'Other', value: 'other' },
              ]} />
              <FormField label="Priority" name="priority" type="select" required options={[
                { label: 'Critical - Immediate', value: 'critical' }, { label: 'High - Within 24hrs', value: 'high' },
                { label: 'Medium - Within 1 week', value: 'medium' }, { label: 'Low - Scheduled', value: 'low' },
              ]} />
              <FormField label="Description" name="description" type="textarea" required placeholder="Describe the issue in detail" />
              <FormField label="Reported By" name="reportedBy" required />
              <FormField label="Assigned To" name="assignedTo" />
              <FormField label="Estimated Cost" name="cost" type="number" prefix="GHS" step={0.01} />
              <FormField label="Status" name="status" type="select" options={[
                { label: 'Open', value: 'open' }, { label: 'In Progress', value: 'in-progress' },
                { label: 'Completed', value: 'completed' }, { label: 'Overdue', value: 'overdue' },
              ]} />
            </div>
          </FormSection>
        )}

        {activeForm === 'cx-feedback' && (
          <FormSection title="Customer Experience Feedback" description="Record customer feedback and scores">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={STORES} />
              <FormField label="Feedback Category" name="category" type="select" required options={[
                { label: 'Store Cleanliness', value: 'cleanliness' }, { label: 'Staff Knowledge', value: 'staff-knowledge' },
                { label: 'Product Availability', value: 'availability' }, { label: 'Fitting Room Experience', value: 'fitting-room' },
                { label: 'Checkout Speed', value: 'checkout' }, { label: 'Overall Experience', value: 'overall' },
              ]} />
              <FormField label="Rating (1-10)" name="rating" type="number" required min={1} max={10} />
              <FormField label="Customer Comment" name="comment" type="textarea" placeholder="What did the customer say?" />
              <FormField label="Action Taken" name="action" type="textarea" placeholder="Resolution or follow-up action" />
              <FormField label="NPS Score" name="nps" type="number" min={-100} max={100} />
              <FormField label="Would Recommend" name="recommend" type="select" options={[
                { label: 'Yes - Promoter', value: 'promoter' }, { label: 'Maybe - Passive', value: 'passive' },
                { label: 'No - Detractor', value: 'detractor' },
              ]} />
            </div>
          </FormSection>
        )}

        {activeForm === 'incident' && (
          <FormSection title="Incident Report" description="Report security, safety, or operational incidents">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date & Time" name="datetime" type="datetime-local" required />
              <FormField label="Store" name="store" type="select" required options={STORES} />
              <FormField label="Incident Type" name="type" type="select" required options={[
                { label: 'Security', value: 'security' }, { label: 'Safety', value: 'safety' },
                { label: 'Operational', value: 'operational' }, { label: 'Fire', value: 'fire' },
                { label: 'Theft / Shrinkage', value: 'theft' }, { label: 'Customer Injury', value: 'customer-injury' },
                { label: 'Staff Injury', value: 'staff-injury' },
              ]} />
              <FormField label="Severity" name="severity" type="select" required options={[
                { label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' },
              ]} />
              <FormField label="Description" name="description" type="textarea" required placeholder="Detailed description of the incident" />
              <FormField label="Reported By" name="reportedBy" required />
              <FormField label="Immediate Action Taken" name="actionTaken" type="textarea" placeholder="What was done immediately?" />
              <FormField label="Follow-Up Required" name="followUp" type="select" options={[
                { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' },
              ]} />
              <FormField label="Status" name="status" type="select" options={[
                { label: 'Open', value: 'open' }, { label: 'Investigating', value: 'investigating' },
                { label: 'Resolved', value: 'resolved' }, { label: 'Closed', value: 'closed' },
              ]} />
            </div>
          </FormSection>
        )}

        {activeForm === 'sop-check' && (
          <FormSection title="SOP Compliance Check" description="Standard operating procedure compliance audit">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={STORES} />
              <FormField label="SOP Area" name="area" type="select" required options={[
                { label: 'Opening Procedures', value: 'opening' }, { label: 'Sales Floor Standards', value: 'sales-floor' },
                { label: 'Cash Handling', value: 'cash' }, { label: 'Customer Service', value: 'service' },
                { label: 'Closing Procedures', value: 'closing' }, { label: 'Loss Prevention', value: 'loss-prev' },
              ]} />
              <FormField label="Compliance Score %" name="compliance" type="number" suffix="%" required min={0} max={100} />
              <FormField label="Checked By" name="checker" required />
              <FormField label="Deviations Found" name="deviations" type="textarea" placeholder="List any SOP deviations" />
              <FormField label="Corrective Action" name="corrective" type="textarea" placeholder="Required corrective actions" />
            </div>
          </FormSection>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm">Submit Entry</button>
          <button type="reset" className="bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white px-6 py-2.5 rounded-lg transition-colors text-sm">Clear Form</button>
        </div>
      </form>
    </div>
  );
}
