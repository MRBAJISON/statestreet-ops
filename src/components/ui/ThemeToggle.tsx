'use client';

import { useEffect, useState } from 'react';

// Toggles the app between dark (default) and light by setting data-theme on <html>.
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
  }

  const label = theme === 'dark' ? 'Light mode' : 'Dark mode';
  const icon = theme === 'dark' ? '☀️' : '🌙';

  if (compact) {
    return (
      <button onClick={toggle} aria-label={label} title={label}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] hover:border-[#c8a951] transition-colors text-sm">
        {icon}
      </button>
    );
  }

  return (
    <button onClick={toggle}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-[var(--c-card)] transition-colors">
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
