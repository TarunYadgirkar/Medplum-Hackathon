'use client';
// Shared UI primitives — the design-system surface for the Claude Design handoff.
// Every primitive replicates the app's current look exactly (see docs/UI_SPEC.md);
// when the new design language arrives, restyle HERE (+ tokens in globals.css),
// not in the pages. No logic lives in this file.

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { NoteStatus, RiskLevel } from '@/types';

/* ── Nav shell ── */

export function Nav({ right, homeLink = true }: { right?: ReactNode; homeLink?: boolean }) {
  return (
    <nav className="bg-white border-b border-line px-6 py-4 flex items-center justify-between">
      {homeLink ? (
        <Link href="/" className="font-bold text-xl text-brand tracking-tight">Prelude</Link>
      ) : (
        <span className="font-bold text-xl text-brand tracking-tight">Prelude</span>
      )}
      {right}
    </nav>
  );
}

/* ── Buttons ── */

const BTN_VARIANTS = {
  primary:
    'bg-brand hover:bg-brand-dark disabled:bg-line disabled:text-faint text-white font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none',
  secondary:
    'bg-surface hover:bg-line text-ink font-semibold rounded-xl transition-colors border border-line',
  dangerSoft:
    'bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-semibold rounded-xl transition-colors',
} as const;

export function Btn({
  variant = 'primary',
  className = 'px-6 py-3.5',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BTN_VARIANTS;
}) {
  return <button className={`${BTN_VARIANTS[variant]} ${className}`} {...props} />;
}

/* ── Cards ── */

export function SectionCard({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white border border-line rounded-2xl shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-ink">{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  );
}

export function MicroLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-faint">{children}</p>;
}

/* ── Badges ── */

const STATUS_CHIP: Record<NoteStatus, { cls: string; label: string }> = {
  urgent_review: { cls: 'bg-red-50 text-red-600', label: 'Urgent' },
  ai_draft: { cls: 'bg-blue-50 text-blue-600', label: 'AI Draft' },
  reviewed: { cls: 'bg-emerald-50 text-emerald-600', label: 'Reviewed' },
};

export function StatusChip({ status, label }: { status: NoteStatus; label?: string }) {
  const s = STATUS_CHIP[status] ?? { cls: 'bg-slate-100 text-slate-500', label: status };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded ${s.cls}`}>{label ?? s.label}</span>;
}

const RISK_BADGE: Record<RiskLevel, string> = {
  high: 'bg-red-50 text-red-600 border border-red-200',
  medium: 'bg-amber-50 text-amber-600 border border-amber-200',
  low: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  none: 'bg-slate-100 text-slate-500 border border-slate-200',
};

export function RiskBadge({ level }: { level?: RiskLevel }) {
  const l = level ?? 'none';
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded capitalize ${RISK_BADGE[l] ?? RISK_BADGE.none}`}>
      {l}
    </span>
  );
}

/* ── Lists ── */

export function BulletList({ items, dotClass = 'bg-brand', empty }: { items?: string[]; dotClass?: string; empty: string }) {
  if (!items?.length) return <p className="text-sm italic text-faint">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-body">
          <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${dotClass}`} />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}
