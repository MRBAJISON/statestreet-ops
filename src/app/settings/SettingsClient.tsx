'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/BrandedLoader';
import { useOrg } from '@/components/providers/OrgProvider';

interface UserInfo { name: string; email: string; role: string; store: string }

const inputCls =
  'w-full bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';
const labelCls = 'block text-xs text-gray-400 mb-1';
const btnCls = 'bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-50';
const secBtnCls = 'border border-[var(--c-border2)] hover:border-[#c8a951] text-[var(--c-fg)] px-5 py-2 rounded-lg text-sm';
const cancelBtnCls = 'text-gray-400 hover:text-[var(--c-fg)] px-4 py-2 rounded-lg text-sm';
const cardCls = 'bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-5';
const h2Cls = 'text-sm font-bold uppercase tracking-wide mb-4 text-center';
const formCls = 'space-y-3 max-w-sm mx-auto';

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <div className={`mb-3 text-sm p-3 rounded-lg border ${m.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{m.text}</div>
  );
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

type Opt = { label: string; value: string };

// Editable label/value list (Stores, Brands, Categories). Value auto-derives from the label.
function ListEditor({ title, items, onChange }: { title: string; items: Opt[]; onChange: (next: Opt[]) => void }) {
  // Code tracks the full name as you type (don't freeze on the first letter, or
  // "Dresses" would end up coded "d"). Editing an existing name re-derives its code.
  const set = (i: number, label: string) => onChange(items.map((it, k) => (k === i ? { label, value: slugify(label) } : it)));
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));
  const add = () => onChange([...items, { label: '', value: '' }]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{title}</span>
        <button type="button" onClick={add} className="text-xs text-[#c8a951] hover:underline">+ Add</button>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={inputCls} value={it.label} placeholder="Name" onChange={(e) => set(i, e.target.value)} />
            <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-400 text-sm px-1" aria-label="Remove">✕</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-500">None yet — click “Add”.</p>}
      </div>
    </div>
  );
}

type ExpOpt = { label: string; value: string; group: 'operating' | 'capital' | 'below-line' };
function ExpenseEditor({ items, onChange }: { items: ExpOpt[]; onChange: (next: ExpOpt[]) => void }) {
  const set = (i: number, patch: Partial<ExpOpt>) => onChange(items.map((it, k) => (k === i ? { ...it, ...patch, value: (patch.label !== undefined ? slugify(patch.label) : it.value) } : it)));
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));
  const add = () => onChange([...items, { label: '', value: '', group: 'operating' }]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Expense Items</span>
        <button type="button" onClick={add} className="text-xs text-[#c8a951] hover:underline">+ Add</button>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={inputCls} value={it.label} placeholder="Name" onChange={(e) => set(i, { label: e.target.value })} />
            <select className={`${inputCls} w-40`} value={it.group} onChange={(e) => set(i, { group: e.target.value as ExpOpt['group'] })}>
              <option value="operating">Operating</option>
              <option value="capital">Capital</option>
              <option value="below-line">Below-line</option>
            </select>
            <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-400 text-sm px-1" aria-label="Remove">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Maps each brand to a subset of items (categories or stores) via checkboxes.
// value is Record<brandValue, itemValue[]>; onChange returns the next map.
function MappingEditor({ title, hint, brands, items, value, onChange }: {
  title: string; hint: string; brands: Opt[]; items: Opt[];
  value: Record<string, string[]>; onChange: (next: Record<string, string[]>) => void;
}) {
  const toggle = (brand: string, item: string) => {
    const cur = value[brand] ?? [];
    const next = cur.includes(item) ? cur.filter((v) => v !== item) : [...cur, item];
    onChange({ ...value, [brand]: next });
  };
  return (
    <div>
      <div className="mb-1">
        <span className="text-xs text-gray-400">{title}</span>
        <p className="text-[0.65rem] text-gray-500">{hint}</p>
      </div>
      <div className="space-y-3">
        {brands.filter((b) => b.label.trim()).map((b) => (
          <div key={b.value} className="border border-[var(--c-border)] rounded-lg p-2.5">
            <div className="text-xs font-semibold text-[var(--c-fg)] mb-1.5">{b.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {items.filter((it) => it.label.trim()).map((it) => {
                const on = (value[b.value] ?? []).includes(it.value);
                return (
                  <button type="button" key={it.value} onClick={() => toggle(b.value, it.value)}
                    className={`text-[0.7rem] px-2 py-1 rounded border transition-colors ${on ? 'bg-[#c8a951] text-black border-[#c8a951] font-medium' : 'border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
                    {it.label}
                  </button>
                );
              })}
              {items.filter((it) => it.label.trim()).length === 0 && <span className="text-[0.65rem] text-gray-500">No items yet.</span>}
            </div>
          </div>
        ))}
        {brands.filter((b) => b.label.trim()).length === 0 && <p className="text-xs text-gray-500">Add brands above first.</p>}
      </div>
    </div>
  );
}

export default function SettingsClient({ user, isOwner, canEditOrg }: { user: UserInfo; isOwner: boolean; canEditOrg: boolean }) {
  const router = useRouter();
  const { org, refresh: refreshOrg } = useOrg();

  // Page split into tabs so each form opens on its own instead of one long scroll.
  const TABS = [
    { id: 'profile', label: 'Profile', show: !isOwner },
    { id: 'password', label: 'Password', show: !isOwner },
    { id: 'organization', label: 'Organization', show: canEditOrg },
    { id: 'appearance', label: 'Appearance', show: true },
  ].filter((t) => t.show);
  const [tab, setTab] = useState(TABS[0]?.id ?? 'appearance');
  // Organization is itself large, so it gets its own sub-tabs (one shared Save).
  const [orgTab, setOrgTab] = useState<'general' | 'catalog' | 'mappings'>('general');

  // Profile
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPw, setShowPw] = useState(false);

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    setTheme((document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark');
  }, []);
  function applyTheme(t: 'dark' | 'light') {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch {}
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true); setNameMsg(null);
    try {
      const res = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setNameMsg({ ok: true, text: 'Profile updated.' });
      router.refresh(); // refresh sidebar/header name
    } catch (err) {
      setNameMsg({ ok: false, text: (err as Error).message });
    }
    setSavingName(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (next !== confirm) { setPwMsg({ ok: false, text: 'New password and confirmation do not match.' }); return; }
    setSavingPw(true);
    try {
      const res = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change password');
      setPwMsg({ ok: true, text: 'Password changed.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setPwMsg({ ok: false, text: (err as Error).message });
    }
    setSavingPw(false);
  }

  // Organization (owner only)
  const [orgDraft, setOrgDraft] = useState(org);
  useEffect(() => { setOrgDraft(org); }, [org]);
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgMsg, setOrgMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) { setOrgMsg({ ok: false, text: 'Logo too large (max ~200 KB). Use a smaller PNG/SVG.' }); return; }
    const reader = new FileReader();
    reader.onload = () => setOrgDraft((d) => ({ ...d, logo: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault();
    setSavingOrg(true); setOrgMsg(null);
    try {
      const res = await fetch('/api/org', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: orgDraft.companyName, tagline: orgDraft.tagline, currency: orgDraft.currency,
          logo: orgDraft.logo, weekStart: orgDraft.weekStart, security: orgDraft.security,
          stores: orgDraft.stores.filter((s) => s.label.trim()),
          brands: orgDraft.brands.filter((s) => s.label.trim()),
          categories: orgDraft.categories.filter((s) => s.label.trim()),
          expenseItems: orgDraft.expenseItems.filter((s) => s.label.trim()),
          subCategories: orgDraft.subCategories.filter((s) => s.label.trim()),
          brandCategories: orgDraft.brandCategories,
          brandStores: orgDraft.brandStores,
          categorySubcategories: orgDraft.categorySubcategories,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setOrgMsg({ ok: true, text: 'Organization settings saved.' });
      refreshOrg(); router.refresh();
    } catch (err) {
      setOrgMsg({ ok: false, text: (err as Error).message });
    }
    setSavingOrg(false);
  }

  return (
    <div className="bg-[var(--c-bg)] min-h-screen text-[var(--c-fg)] p-6">
      <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile, password and appearance.</p>
      </div>

      {TABS.length > 1 && (
        <div className="flex gap-2 flex-wrap justify-center">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Profile (hidden for owner) */}
      {!isOwner && tab === 'profile' && (
      <section className={cardCls}>
        <h2 className={h2Cls}>Profile</h2>
        <Msg m={nameMsg} />
        <form onSubmit={saveName} className={formCls}>
          <div>
            <label className={labelCls}>Display Name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={`${inputCls} opacity-70`} value={user.email} readOnly />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Role</label>
              <input className={`${inputCls} opacity-70 capitalize`} value={user.role} readOnly />
            </div>
            <div>
              <label className={labelCls}>Store</label>
              <input className={`${inputCls} opacity-70`} value={user.store || '—'} readOnly />
            </div>
          </div>
          <div className="flex justify-center pt-1">
            <button type="submit" disabled={savingName} className={btnCls}>{savingName ? <><Spinner /> Saving…</> : 'Save Profile'}</button>
          </div>
        </form>
      </section>
      )}

      {/* Password (hidden for owner) — collapsed until the user chooses to change it */}
      {!isOwner && tab === 'password' && (
      <section className={cardCls}>
        <h2 className={h2Cls}>Change Password</h2>
        {!showPw ? (
          <div className="flex justify-center">
            <button type="button" onClick={() => { setShowPw(true); setPwMsg(null); }} className={secBtnCls}>Change Password</button>
          </div>
        ) : (
          <>
            <Msg m={pwMsg} />
            <form onSubmit={changePassword} className={formCls}>
              <div>
                <label className={labelCls}>Current Password</label>
                <input type="password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>New Password</label>
                <input type="password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} />
              </div>
              <div>
                <label className={labelCls}>Confirm New Password</label>
                <input type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
              </div>
              <div className="flex justify-center items-center gap-2 pt-1">
                <button type="submit" disabled={savingPw} className={btnCls}>{savingPw ? <><Spinner /> Saving…</> : 'Update Password'}</button>
                <button type="button" onClick={() => { setShowPw(false); setCurrent(''); setNext(''); setConfirm(''); setPwMsg(null); }} className={cancelBtnCls}>Cancel</button>
              </div>
            </form>
          </>
        )}
      </section>
      )}

      {/* Organization (owner + commercial + operations) */}
      {canEditOrg && tab === 'organization' && (
        <section className={cardCls}>
          <h2 className={h2Cls}>Organization</h2>
          <div className="flex gap-2 flex-wrap justify-center mb-4">
            {([{ id: 'general', label: 'General' }, { id: 'catalog', label: 'Catalog' }, { id: 'mappings', label: 'Mappings' }] as const).map((t) => (
              <button key={t.id} type="button" onClick={() => setOrgTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${orgTab === t.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[var(--c-card2)] border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <Msg m={orgMsg} />
          <form onSubmit={saveOrg} className="space-y-4 max-w-md mx-auto">
            {orgTab === 'general' && (
            <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              {orgDraft.logo ? (
                <img src={orgDraft.logo} alt="Logo" className="w-16 h-16 rounded object-contain border border-[var(--c-border)] bg-[var(--c-card2)]" />
              ) : (
                <div className="w-16 h-16 bg-[#c8a951] rounded flex items-center justify-center text-black text-[0.6rem] font-bold">LOGO</div>
              )}
              <label className="text-xs text-[#c8a951] cursor-pointer hover:underline">
                Upload logo
                <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
              </label>
              {orgDraft.logo && (
                <button type="button" onClick={() => setOrgDraft((d) => ({ ...d, logo: '' }))} className="text-[0.6rem] text-gray-400 hover:text-red-400">Remove logo</button>
              )}
            </div>
            <div>
              <label className={labelCls}>Company Name</label>
              <input className={inputCls} value={orgDraft.companyName} onChange={(e) => setOrgDraft((d) => ({ ...d, companyName: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Tagline</label>
              <input className={inputCls} value={orgDraft.tagline} onChange={(e) => setOrgDraft((d) => ({ ...d, tagline: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Currency</label>
                <input className={inputCls} value={orgDraft.currency} onChange={(e) => setOrgDraft((d) => ({ ...d, currency: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Week Starts On</label>
                <select className={inputCls} value={orgDraft.weekStart} onChange={(e) => setOrgDraft((d) => ({ ...d, weekStart: e.target.value === 'sunday' ? 'sunday' : 'monday' }))}>
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Min Password Length</label>
                <input type="number" min={6} className={inputCls} value={orgDraft.security.minPasswordLen} onChange={(e) => setOrgDraft((d) => ({ ...d, security: { ...d.security, minPasswordLen: Number(e.target.value) || 6 } }))} />
              </div>
              <div>
                <label className={labelCls}>Session Length (days)</label>
                <input type="number" min={1} className={inputCls} value={orgDraft.security.sessionDays} onChange={(e) => setOrgDraft((d) => ({ ...d, security: { ...d.security, sessionDays: Number(e.target.value) || 7 } }))} />
              </div>
            </div>
            </div>
            )}
            {orgTab === 'catalog' && (
            <div className="space-y-4">
              <ListEditor title="Stores / Locations" items={orgDraft.stores} onChange={(stores) => setOrgDraft((d) => ({ ...d, stores }))} />
              <ListEditor title="Brands" items={orgDraft.brands} onChange={(brands) => setOrgDraft((d) => ({ ...d, brands }))} />
              <ListEditor title="Product Categories" items={orgDraft.categories} onChange={(categories) => setOrgDraft((d) => ({ ...d, categories }))} />
              <ListEditor title="Sub-categories" items={orgDraft.subCategories} onChange={(subCategories) => setOrgDraft((d) => ({ ...d, subCategories }))} />
              <ExpenseEditor items={orgDraft.expenseItems} onChange={(expenseItems) => setOrgDraft((d) => ({ ...d, expenseItems }))} />
            </div>
            )}
            {orgTab === 'mappings' && (
            <div className="space-y-4">
              <MappingEditor title="Brand → Categories" hint="Tap to assign categories to each brand. Sales forms show only a brand's categories once mapped." brands={orgDraft.brands} items={orgDraft.categories} value={orgDraft.brandCategories} onChange={(brandCategories) => setOrgDraft((d) => ({ ...d, brandCategories }))} />
              <MappingEditor title="Brand → Stores" hint="Group stores under a brand. Stock transfers are allowed only between stores of the same brand (Head Office reaches all)." brands={orgDraft.brands} items={orgDraft.stores} value={orgDraft.brandStores} onChange={(brandStores) => setOrgDraft((d) => ({ ...d, brandStores }))} />
              <MappingEditor title="Category → Sub-categories" hint="Tap to assign sub-categories to each category. Goods Received lets you pick a category's sub-categories once mapped." brands={orgDraft.categories} items={orgDraft.subCategories} value={orgDraft.categorySubcategories} onChange={(categorySubcategories) => setOrgDraft((d) => ({ ...d, categorySubcategories }))} />
            </div>
            )}
            <div className="flex justify-center pt-1">
              <button type="submit" disabled={savingOrg} className={btnCls}>{savingOrg ? <><Spinner /> Saving…</> : 'Save Organization'}</button>
            </div>
          </form>
        </section>
      )}

      {/* Appearance */}
      {tab === 'appearance' && (
      <section className={cardCls}>
        <h2 className={h2Cls}>Appearance</h2>
        <div className="max-w-sm mx-auto">
          <label className={labelCls}>Theme</label>
          <select className={inputCls} value={theme} onChange={(e) => applyTheme(e.target.value === 'light' ? 'light' : 'dark')}>
            <option value="light">☀️ Light</option>
            <option value="dark">🌙 Dark</option>
          </select>
        </div>
      </section>
      )}
      </div>
    </div>
  );
}
