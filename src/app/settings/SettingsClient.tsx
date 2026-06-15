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

export default function SettingsClient({ user, isOwner }: { user: UserInfo; isOwner: boolean }) {
  const router = useRouter();
  const { org, refresh: refreshOrg } = useOrg();

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

      {/* Profile (hidden for owner) */}
      {!isOwner && (
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
      {!isOwner && (
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

      {/* Appearance */}
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

      {/* Organization (owner only) */}
      {isOwner && (
        <section className={cardCls}>
          <h2 className={h2Cls}>Organization</h2>
          <Msg m={orgMsg} />
          <form onSubmit={saveOrg} className="space-y-4 max-w-md mx-auto">
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
            <div className="flex justify-center pt-1">
              <button type="submit" disabled={savingOrg} className={btnCls}>{savingOrg ? <><Spinner /> Saving…</> : 'Save Organization'}</button>
            </div>
          </form>
        </section>
      )}
      </div>
    </div>
  );
}
