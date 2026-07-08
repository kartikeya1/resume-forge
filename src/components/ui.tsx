'use client';

import { useEffect, useRef, useState } from 'react';

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{children}</label>;
}

const INPUT_CLASS =
  'w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400';

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
      className={`${INPUT_CLASS} ${className}`}
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
      className={`${INPUT_CLASS} resize-none leading-snug`}
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
          ? 'border-neutral-300 text-neutral-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-400'
          : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700'
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
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-400 dark:hover:text-neutral-100"
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
    <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100"
        >
          <span className={`text-xs text-neutral-400 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          {title}
        </button>
        {right}
      </div>
      {open && <div className="border-t border-neutral-100 px-3 py-3 dark:border-neutral-700">{children}</div>}
    </div>
  );
}

// Reusable dropdown menu with outside-click close. `children` is a render prop
// receiving a `close` callback so items can dismiss the menu when clicked.
export function Menu({
  label,
  width = 'w-72',
  align = 'left',
  children,
}: {
  label: React.ReactNode;
  width?: string;
  align?: 'left' | 'right';
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
      >
        <span className="truncate">{label}</span>
        <span className="text-xs text-neutral-400">▾</span>
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-30 mt-1 ${width} rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
