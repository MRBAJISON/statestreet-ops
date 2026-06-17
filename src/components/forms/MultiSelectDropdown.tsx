'use client';

import { useState } from 'react';

interface Opt { label: string; value: string }

// A dropdown that allows selecting multiple options (checkbox list). Styled to
// match the global input/select look. Controlled via value (string[]) / onChange.
export default function MultiSelectDropdown({ label, options, value, onChange, placeholder = 'Select…' }: {
  label: string; options: Opt[]; value: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const selected = options.filter((o) => value.includes(o.value));
  const summary = selected.length ? selected.map((o) => o.label).join(', ') : placeholder;

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 bg-[var(--c-hover)] border border-[var(--c-border2)] rounded-md px-3 py-2 text-sm text-left">
          <span className={`truncate ${selected.length ? 'text-[var(--c-fg)]' : 'text-gray-500'}`}>{summary}</span>
          <span className="text-gray-500 shrink-0 text-xs">▾</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
            <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg shadow-xl p-1">
              {options.length === 0 && <div className="px-2 py-1.5 text-xs text-gray-500">No categories available</div>}
              {options.map((o) => {
                const on = value.includes(o.value);
                return (
                  <button type="button" key={o.value} onClick={() => toggle(o.value)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded hover:bg-[var(--c-hover)]">
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[0.6rem] ${on ? 'bg-[#c8a951] border-[#c8a951] text-black' : 'border-[var(--c-border2)] text-transparent'}`}>✓</span>
                    <span className={on ? 'text-[var(--c-fg)]' : 'text-gray-400'}>{o.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
