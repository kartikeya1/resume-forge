'use client';

import { useEffect, useRef, useState } from 'react';

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">{children}</label>;
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 ${className}`}
    />
  );
}

export function AutoTextarea({
  value,
  onChange,
  placeholder,
  minRows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      rows={minRows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm leading-snug text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
    />
  );
}

export function IconBtn({
  onClick,
  title,
  children,
  danger = false,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm transition ${
        danger
          ? 'border-neutral-300 text-neutral-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
          : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900"
    >
      <span className="text-base leading-none">+</span>
      {children}
    </button>
  );
}

export function SectionCard({
  title,
  children,
  defaultOpen = true,
  right,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-800"
        >
          <span className={`text-xs text-neutral-400 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          {title}
        </button>
        {right}
      </div>
      {open && <div className="border-t border-neutral-100 px-3 py-3">{children}</div>}
    </div>
  );
}
