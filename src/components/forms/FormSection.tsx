'use client';

import { useState } from 'react';

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function FormSection({ title, description, children, defaultOpen = true }: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#1a1a1a] transition-colors"
      >
        <div>
          <h3 className="text-sm font-semibold text-left">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        <span className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-[#2a2a2a]">
          {children}
        </div>
      )}
    </div>
  );
}
