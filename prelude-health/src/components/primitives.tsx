'use client';
// Shared UI primitives — the design-system surface.
// Styled per the Claude Design handoff ("Prelude UI Handoff.dc.html" §5g):
// Archivo 800 headings, sharp corners (radius 0 — circles reserved for the
// voice UI), ink-on-paper palette, gradient hover on primary actions.
// All values come from @theme tokens in globals.css. No logic in this file.

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { NoteStatus, RiskLevel } from '@/types';

/* ── Icons (Material Symbols Sharp, loaded in layout.tsx) ── */

export function Icon({ name, className = 'text-[18px]' }: { name: string; className?: string }) {
  return <span aria-hidden className={`msymbol ${className}`}>{name}</span>;
}

/* ── Nav shell ── */

export function Nav({ right, homeLink = true }: { right?: ReactNode; homeLink?: boolean }) {
  const wordmark = (
    <span className="flex items-center gap-2.5">
      <span className="flex gap-1" aria-hidden>
        <span className="w-3 h-3 bg-brand inline-block" />
        <span className="w-3 h-3 rounded-full inline-block" style={{ background: 'var(--grad-hover)' }} />
      </span>
      <span className="font-extrabold text-xl text-ink tracking-tight">Prelude</span>
    </span>
  );
  return (
    <nav className="bg-bright border-b border-line px-6 py-4 flex items-center justify-between">
      {homeLink ? <Link href="/">{wordmark}</Link> : wordmark}
      {right}
    </nav>
  );
}

/* ── Buttons ── */

const BTN_VARIANTS = {
  primary:
    'bg-ink text-bright font-bold tracking-[.06em] transition-all duration-200 hover:[background:var(--grad-hover)] hover:tracking-[.1em] disabled:bg-line disabled:text-faint disabled:tracking-[.06em] disabled:hover:[background:var(--color-line)]',
  secondary:
    'bg-transparent border border-ink/40 text-ink font-bold transition-all duration-200 hover:bg-ink hover:text-bright disabled:border-line disabled:text-faint disabled:hover:bg-transparent',
  dangerSoft:
    'bg-transparent border border-danger/50 text-danger font-bold transition-all duration-200 hover:bg-danger hover:text-bright',
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
    <div className="bg-panel border border-line p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-extrabold text-ink">{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  );
}

export function MicroLabel({ children }: { children: ReactNode }) {
  return <p className="text-[9.5px] font-semibold uppercase tracking-[.2em] text-faint">{children}</p>;
}

/* ── Badges ── */

const STATUS_CHIP: Record<NoteStatus, { cls: string; label: string }> = {
  urgent_review: { cls: 'bg-danger text-bright', label: 'Urgent' },
  ai_draft: { cls: 'bg-brand/10 text-brand', label: 'AI Draft' },
  reviewed: { cls: 'bg-positive/10 text-positive', label: 'Reviewed' },
};

export function StatusChip({ status, label }: { status: NoteStatus; label?: string }) {
  const s = STATUS_CHIP[status] ?? { cls: 'bg-ink/5 text-faint', label: status };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-[.14em] px-2.5 py-1 ${s.cls}`}>
      {label ?? s.label}
    </span>
  );
}

const RISK_BADGE: Record<RiskLevel, string> = {
  high: 'bg-danger text-bright',
  medium: 'bg-caution/15 text-caution',
  low: 'bg-positive/10 text-positive',
  none: 'bg-ink/5 text-faint',
};

export function RiskBadge({ level }: { level?: RiskLevel }) {
  const l = level ?? 'none';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-[.14em] px-2.5 py-1 ${RISK_BADGE[l] ?? RISK_BADGE.none}`}>
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
          <span className={`shrink-0 w-1.5 h-1.5 mt-1.5 ${dotClass}`} />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}
