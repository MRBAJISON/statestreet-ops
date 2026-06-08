'use client';

import { useEffect } from 'react';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Optional footer area (e.g. action buttons), pinned below the scrollable body. */
  footer?: React.ReactNode;
  size?: Size;
}

// Reusable, theme-aware modal. Closes on backdrop click or Escape, locks body
// scroll while open, and pins an optional footer below a scrollable body.
export default function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${SIZE[size]} max-h-[90vh] flex flex-col bg-[var(--c-card)] border border-[var(--c-border)] rounded-xl shadow-2xl`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--c-border)]">
            <h3 className="text-sm font-bold">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-[var(--c-fg)] text-xl leading-none">×</button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-[var(--c-border)] flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
}

// Convenience confirmation dialog built on Modal.
export function ConfirmModal({
  open, onClose, onConfirm, title = 'Confirm', message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm rounded-lg font-semibold disabled:opacity-50 ${danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#c8a951] hover:bg-[#d4bf7a] text-black'}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-gray-300">{message}</div>
    </Modal>
  );
}
