'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import RecentEntries from '@/components/ui/RecentEntries';
import OpenItemsManager from './OpenItemsManager';
import { submitEntry } from '@/lib/api';
import { Spinner } from '@/components/ui/BrandedLoader';
import { useOrg } from '@/components/providers/OrgProvider';

export default function OperationsForms({ managerName = '' }: { managerName?: string }) {
  const { org } = useOrg();
  const [activeForm, setActiveForm] = useState('store-audit');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const num = (s: string) => Number(s) || 0;
  const avgOf = (vals: number[]) => (vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0);

  // Store Standards — Overall Status auto-derived from the average of the score fields.
  const [audit, setAudit] = useState({ opsScore: '', vmScore: '', readinessScore: '', cxScore: '', cleanScore: '', safetyScore: '' });
  const setA = (k: keyof typeof audit) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setAudit((s) => ({ ...s, [k]: e.target.value }));
  const auditAvg = avgOf(Object.values(audit).map(num).filter((n) => n > 0));
  const auditStatus = !auditAvg ? '' : auditAvg > 90 ? `Pass (${auditAvg}%)` : auditAvg >= 70 ? `Watch (${auditAvg}%)` : `Fail (${auditAvg}%)`;

  // VM Compliance — Overall VM Score auto-derived from the average of the sub-scores.
  const [vm, setVm] = useState({ windowDisplay: '', mannequin: '', productPresentation: '', signage: '' });
  const setV = (k: keyof typeof vm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setVm((s) => ({ ...s, [k]: e.target.value }));
  const vmAvg = avgOf(Object.values(vm).map(num).filter((n) => n > 0));

  // Human Resources — Attendance % auto-derived from staff counts (present / total).
  const [hr, setHr] = useState({ staffTotal: '', staffPresent: '' });
  const setH = (k: keyof typeof hr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setHr((s) => ({ ...s, [k]: e.target.value }));
  const attendancePct = num(hr.staffTotal) > 0 ? Math.round((num(hr.staffPresent) / num(hr.staffTotal)) * 1000) / 10 : 0;

  function resetAuto() {
    setAudit({ opsScore: '', vmScore: '', readinessScore: '', cxScore: '', cleanScore: '', safetyScore: '' });
    setVm({ windowDisplay: '', mannequin: '', productPresentation: '', signage: '' });
    setHr({ staffTotal: '', staffPresent: '' });
  }

  // Within Store Standards, a sub-tab toggles between the standards checklist
  // and a maintenance request (submitted as a separate 'maintenance' record).
  const [auditTab, setAuditTab] = useState<'standards' | 'maintenance'>('standards');

  const forms = [
    { id: 'store-audit', label: 'Store Standards' },
    { id: 'vm-check', label: 'VM Compliance' },
    { id: 'cx-feedback', label: 'Customer Experience' },
    { id: 'incident', label: 'Incident Report' },
    { id: 'sop-check', label: 'SOP Compliance' },
    { id: 'hr', label: 'Human Resources' },
  ];

  // A person field that pre-fills (read-only) with the logged-in manager's name.
  const personField = (label: string, name: string, required = false) =>
    managerName
      ? <FormField label={label} name={name} value={managerName} readOnly required={required} />
      : <FormField label={label} name={name} required={required} />;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    // Maintenance is a sub-tab of Store Standards but persists as its own record type.
    const effectiveType = activeForm === 'store-audit' && auditTab === 'maintenance' ? 'maintenance' : activeForm;
    setBusy(true);
    try {
      await submitEntry('operations', effectiveType, form);
      setMessage('Saved to the live database. The dashboard reflects it now.');
      form.reset();
      resetAuto();
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
        <h1 className="text-xl font-bold">Operations Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Enter operations data to update the Business Operations Command Center</p>
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
        {activeForm === 'store-audit' && (
          <>
            {/* Sub-tabs within Store Standards: the standards checklist + a maintenance request. */}
            <div className="flex gap-2">
              {([
                { id: 'standards', label: 'Store Standards' },
                { id: 'maintenance', label: 'Maintenance Request' },
              ] as const).map((t) => (
                <button key={t.id} type="button" onClick={() => setAuditTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${auditTab === t.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {auditTab === 'standards' && (
              <FormSection title="Store Standards" description="Complete the store standards checklist">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
                  <FormField label="Date" name="date" type="date" required />
                  <FormField label="Store" name="store" type="select" required options={org.stores} />
                  {personField('Auditor', 'auditor', true)}
                  <FormField label="Operations Score %" name="opsScore" type="number" suffix="%" required min={0} max={100} value={audit.opsScore} onChange={setA('opsScore')} />
                  <FormField label="VM Score %" name="vmScore" type="number" suffix="%" required min={0} max={100} value={audit.vmScore} onChange={setA('vmScore')} />
                  <FormField label="Readiness Score %" name="readinessScore" type="number" suffix="%" required min={0} max={100} value={audit.readinessScore} onChange={setA('readinessScore')} />
                  <FormField label="CX Score %" name="cxScore" type="number" suffix="%" required min={0} max={100} value={audit.cxScore} onChange={setA('cxScore')} />
                  <FormField label="Cleanliness & Lighting Score %" name="cleanScore" type="number" suffix="%" min={0} max={100} value={audit.cleanScore} onChange={setA('cleanScore')} />
                  <FormField label="Safety Score %" name="safetyScore" type="number" suffix="%" min={0} max={100} value={audit.safetyScore} onChange={setA('safetyScore')} />
                  <FormField label="Key Issues Found" name="issues" type="textarea" placeholder="List any issues found during the review" />
                  <FormField label="Overall Status (auto)" name="status" value={auditStatus} readOnly placeholder="Fill scores above" />
                </div>
              </FormSection>
            )}

            {auditTab === 'maintenance' && (
              <FormSection title="Maintenance Request" description="Log a maintenance need for a store or location.">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
                  <FormField label="Date" name="date" type="date" required />
                  <FormField label="Store" name="store" type="select" required options={org.stores} />
                  <FormField label="Category" name="category" type="select" options={[
                    { label: 'Electrical', value: 'electrical' }, { label: 'HVAC / Air Conditioning', value: 'hvac' },
                    { label: 'Plumbing', value: 'plumbing' }, { label: 'Carpentry', value: 'carpentry' },
                    { label: 'Painting', value: 'painting' }, { label: 'Security Systems', value: 'security' },
                    { label: 'IT / Network', value: 'it' }, { label: 'Other', value: 'other' },
                  ]} />
                  <FormField label="Priority" name="priority" type="select" options={[
                    { label: 'Critical - Immediate', value: 'critical' }, { label: 'High - Within 24hrs', value: 'high' },
                    { label: 'Medium - Within 1 week', value: 'medium' }, { label: 'Low - Scheduled', value: 'low' },
                  ]} />
                  <FormField label="Description" name="description" type="textarea" required placeholder="Describe the issue" />
                  {personField('Reported By', 'reportedBy')}
                  <FormField label="Assigned To" name="assignedTo" />
                  <FormField label="Estimated Cost" name="cost" type="number" prefix="GHS" step={0.01} />
                  <FormField label="Status" name="status" type="select" options={[
                    { label: 'Open', value: 'open' }, { label: 'In Progress', value: 'in-progress' },
                    { label: 'Completed', value: 'completed' }, { label: 'Overdue', value: 'overdue' },
                  ]} />
                </div>
              </FormSection>
            )}
          </>
        )}

        {activeForm === 'vm-check' && (
          <FormSection title="Visual Merchandising Compliance" description="Check VM standards per store">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={org.stores} />
              <FormField label="Window Display Compliance %" name="windowDisplay" type="number" suffix="%" min={0} max={100} value={vm.windowDisplay} onChange={setV('windowDisplay')} />
              <FormField label="Mannequin Styling %" name="mannequin" type="number" suffix="%" min={0} max={100} value={vm.mannequin} onChange={setV('mannequin')} />
              <FormField label="Product Presentation %" name="productPresentation" type="number" suffix="%" min={0} max={100} value={vm.productPresentation} onChange={setV('productPresentation')} />
              <FormField label="Size Arrangement %" name="signage" type="number" suffix="%" min={0} max={100} value={vm.signage} onChange={setV('signage')} />
              <FormField label="Overall VM Score % (auto)" name="overallVM" type="number" suffix="%" value={vmAvg ? String(vmAvg) : ''} readOnly />
              <FormField label="Needs Improvement" name="improvements" type="textarea" placeholder="Areas needing improvement" />
            </div>
          </FormSection>
        )}

        {activeForm === 'cx-feedback' && (
          <FormSection title="Customer Experience (In-Store, Staff-Assessed)" description="Manager/auditor assessment of the in-store customer experience. (The customer's own voice is captured separately via the Marketing survey.)">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={org.stores} />
              {personField('Assessed By', 'assessedBy', true)}
              <FormField label="Feedback Category" name="category" type="select" required options={[
                { label: 'Store Cleanliness', value: 'cleanliness' }, { label: 'Staff Knowledge', value: 'staff-knowledge' },
                { label: 'Product Availability', value: 'availability' }, { label: 'Fitting Room Experience', value: 'fitting-room' },
                { label: 'Checkout Speed', value: 'checkout' }, { label: 'Overall Experience', value: 'overall' },
              ]} />
              <FormField label="Experience Rating (1-5)" name="rating" type="number" min={1} max={5} required />
              <FormField label="NPS Score" name="nps" type="number" min={-100} max={100} />
              <FormField label="Would Recommend" name="recommend" type="select" options={[
                { label: 'Yes - Promoter', value: 'promoter' }, { label: 'Maybe - Passive', value: 'passive' },
                { label: 'No - Detractor', value: 'detractor' },
              ]} />
              <FormField label="Comments" name="comments" type="textarea" placeholder="What stood out, good or bad?" />
            </div>
          </FormSection>
        )}

        {activeForm === 'incident' && (
          <FormSection title="Incident Report" description="Report security, safety, or operational incidents">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date & Time" name="datetime" type="datetime-local" required />
              <FormField label="Store" name="store" type="select" required options={org.stores} />
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
              {personField('Reported By', 'reportedBy', true)}
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
              <FormField label="Store" name="store" type="select" required options={org.stores} />
              <FormField label="SOP Area" name="area" type="select" required options={[
                { label: 'Opening Procedures', value: 'opening' }, { label: 'Sales Floor Standards', value: 'sales-floor' },
                { label: 'Cash Handling', value: 'cash' }, { label: 'Customer Service', value: 'service' },
                { label: 'Closing Procedures', value: 'closing' }, { label: 'Loss Prevention', value: 'loss-prev' },
                { label: 'Inventory Handling', value: 'inventory-handling' }, { label: 'Staff Execution', value: 'staff-execution' },
                { label: 'Discipline & Leadership', value: 'discipline-leadership' }, { label: 'Staff Grooming', value: 'staff-grooming' },
              ]} />
              <FormField label="Compliance Score %" name="compliance" type="number" suffix="%" required min={0} max={100} />
              {personField('Checked By', 'checker', true)}
              <FormField label="Deviations Found" name="deviations" type="textarea" placeholder="List any SOP deviations" />
              <FormField label="Corrective Action" name="corrective" type="textarea" placeholder="Required corrective actions" />
            </div>
          </FormSection>
        )}

        {activeForm === 'hr' && (
          <FormSection title="Human Resources" description="People health — staff attendance, punctuality, training and absences per location">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store / Location" name="store" type="select" required options={org.stores} />
              <FormField label="Recorded By (name)" name="recordedBy" defaultValue={managerName} required placeholder="Person completing this record" />
              <FormField label="Number of Staff (at location)" name="staffTotal" type="number" min={0} required value={hr.staffTotal} onChange={setH('staffTotal')} />
              <FormField label="Number of Staff Present" name="staffPresent" type="number" min={0} required value={hr.staffPresent} onChange={setH('staffPresent')} />
              <FormField label="Absences (count)" name="absences" type="number" min={0} />
              <FormField label="Attendance % (auto)" name="attendance" type="number" suffix="%" value={attendancePct ? String(attendancePct) : ''} readOnly />
              <FormField label="Staff Punctuality %" name="punctuality" type="number" suffix="%" min={0} max={100} required />
              <FormField label="Training Completion %" name="training" type="number" suffix="%" min={0} max={100} />
              <FormField label="Absence Reason" name="reason" type="select" options={[
                { label: 'Sick', value: 'sick' }, { label: 'Approved Leave', value: 'leave' },
                { label: 'Off / Day Off', value: 'off' },
                { label: 'No-show', value: 'no-show' }, { label: 'Other', value: 'other' },
              ]} />
              <FormField label="Notes" name="notes" type="textarea" placeholder="Context on attendance / training" />
            </div>
          </FormSection>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={busy} className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">{busy ? <><Spinner /> Saving…</> : 'Submit Entry'}</button>
          <button type="reset" className="bg-[var(--c-hover)] border border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)] px-6 py-2.5 rounded-lg transition-colors text-sm">Clear Form</button>
        </div>
      </form>

      <OpenItemsManager />

      <div className="mt-8 max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Your Submissions</h2>
        <RecentEntries department="operations" />
      </div>
    </div>
  );
}
