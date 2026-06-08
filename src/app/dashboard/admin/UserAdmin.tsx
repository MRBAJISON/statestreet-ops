'use client';

import { useCallback, useEffect, useState } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
}

const ROLES = ['owner', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand', 'store-manager'];
const DEPARTMENTS = ['executive', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'];
const selectClass = 'bg-[var(--c-card)] border border-[var(--c-border)] text-xs text-[var(--c-fg)] rounded px-2 py-1 focus:outline-none focus:border-[#c8a951]';
const inputClass = 'bg-[var(--c-card)] border border-[var(--c-border)] text-sm text-[var(--c-fg)] rounded-lg px-3 py-2 focus:outline-none focus:border-[#c8a951]';

export default function UserAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'finance', department: 'finance' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/users', { cache: 'no-store' });
    const json = await res.json();
    setUsers(Array.isArray(json.users) ? json.users : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      setMsg({ ok: true, text: `Added ${json.user.name}` });
      setForm({ name: '', email: '', password: '', role: 'finance', department: 'finance' });
      load();
    } else {
      setMsg({ ok: false, text: json.error || 'Failed to add user' });
    }
  }

  async function patchUser(id: number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    setMsg(res.ok ? { ok: true, text: 'Updated' } : { ok: false, text: json.error || 'Failed' });
    if (res.ok) load();
  }

  async function resetPassword(u: User) {
    const pw = window.prompt(`New password for ${u.name} (min 6 chars):`);
    if (!pw) return;
    patchUser(u.id, { password: pw });
  }

  async function removeUser(u: User) {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    const json = await res.json();
    setMsg(res.ok ? { ok: true, text: `Deleted ${u.name}` } : { ok: false, text: json.error || 'Failed' });
    if (res.ok) load();
  }

  return (
    <div className="bg-[var(--c-bg)] min-h-screen text-[var(--c-fg)] p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">User Administration</h1>
        <p className="text-sm text-gray-500 mt-1">Add, edit, reset passwords, and remove user accounts.</p>
      </div>

      {msg && (
        <div className={`mb-4 text-sm p-3 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Add user */}
      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4 mb-6 max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Add User</h2>
        <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className={inputClass} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={inputClass} type="email" placeholder="email@statestreet.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className={inputClass} type="password" placeholder="Password (min 6)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button type="submit" className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold rounded-lg px-4 py-2 text-sm">Add User</button>
        </form>
      </div>

      {/* User list */}
      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4 max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Users</h2>
        {loading ? (
          <div className="text-xs text-gray-600 py-4">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">Name</th>
                  <th className="text-left py-2 pr-3 font-medium">Email</th>
                  <th className="text-left py-2 pr-3 font-medium">Role</th>
                  <th className="text-left py-2 pr-3 font-medium">Department</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--c-hover)]">
                    <td className="py-2 pr-3">{u.name}</td>
                    <td className="py-2 pr-3 text-gray-400">{u.email}</td>
                    <td className="py-2 pr-3">
                      <select className={selectClass} value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select className={selectClass} value={u.department} onChange={(e) => patchUser(u.id, { department: e.target.value })}>
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button onClick={() => resetPassword(u)} className="text-gray-400 hover:text-[#c8a951] mr-3">Reset password</button>
                      <button onClick={() => removeUser(u)} className="text-gray-400 hover:text-red-400">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
