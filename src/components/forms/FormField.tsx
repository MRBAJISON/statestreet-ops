'use client';

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}

export default function FormField({ label, name, type = 'text', value, onChange, placeholder, required, options, prefix, suffix, min, max, step }: FormFieldProps) {
  if (type === 'select' && options) {
    return (
      <div>
        <label className="block text-xs text-gray-400 mb-1">{label}{required && <span className="text-red-400">*</span>}</label>
        <select name={name} value={value} onChange={onChange} required={required} className="w-full">
          <option value="">Select...</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{prefix}</span>}
        <input
          type={type} name={name} value={value} onChange={onChange}
          placeholder={placeholder} required={required}
          min={min} max={max} step={step}
          className={`w-full ${prefix ? 'pl-12' : ''} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}
