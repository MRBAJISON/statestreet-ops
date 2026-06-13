'use client';

import { useState } from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  optgroups?: { label: string; options: { label: string; value: string }[] }[];
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
}

export default function FormField({ label, name, type = 'text', value, onChange, placeholder, required, options, optgroups, prefix, suffix, min, max, step, readOnly }: FormFieldProps) {
  const [hasContent, setHasContent] = useState(false);
  // Affix (GHS / %) is shown only while the field is empty.
  const filled = value !== undefined && value !== null ? String(value).length > 0 : hasContent;

  if (type === 'select' && (options || optgroups)) {
    return (
      <div>
        <label className="block text-xs text-gray-400 mb-1">{label}{required && <span className="text-red-400">*</span>}</label>
        <select name={name} value={value} onChange={onChange} required={required} className="w-full">
          <option value="">Select...</option>
          {optgroups
            ? optgroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))
            : options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (type === 'textarea') {
    return (
      <div>
        <label className="block text-xs text-gray-400 mb-1">{label}{required && <span className="text-red-400">*</span>}</label>
        <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} rows={3} className="w-full resize-none" />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}{required && <span className="text-red-400">*</span>}</label>
      <div className="relative">
        {prefix && !filled && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">{prefix}</span>}
        <input
          type={type}
          name={name}
          value={value}
          onChange={(e) => {
            setHasContent(e.target.value.length > 0);
            onChange?.(e);
          }}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          min={min}
          max={max}
          step={step}
          className={`w-full ${prefix ? 'pl-12' : ''} ${suffix ? 'pr-10' : ''} ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
        />
        {suffix && !filled && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}
