'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RiskBadge, StatusChip } from '@/components/primitives';
import type { PatientRow } from '@/types';

interface PastVisitsProps {
  patientName?: string;
  currentNoteId: string;
}

function formatVisitDate(createdAt?: string): string {
  if (!createdAt) return 'Date unknown';
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return 'Date unknown';
  return parsed.toLocaleDateString('en-US', { dateStyle: 'medium' });
}

export function PastVisits({ patientName, currentNoteId }: PastVisitsProps) {
  const [visits, setVisits] = useState<PatientRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/patients');
        if (!res.ok) throw new Error(`patients fetch failed: ${res.status}`);
        const rows: PatientRow[] = await res.json();
        const currentRow = rows.find((r) => r.note_id === currentNoteId);
        const name = (patientName || currentRow?.name || '').trim().toLowerCase();
        const past = name
          ? rows.filter(
              (r) =>
                r.name?.trim().toLowerCase() === name &&
                r.note_id !== currentNoteId &&
                r.id !== currentRow?.id,
            )
          : [];
        const sorted = [...past].sort((a, b) =>
          (b.created_at || '').localeCompare(a.created_at || ''),
        );
        if (!cancelled) setVisits(sorted);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [patientName, currentNoteId]);

  if (failed) return <p className="text-sm text-faint italic">Visit history unavailable.</p>;
  if (visits === null) return <p className="text-sm text-faint">Loading visit history…</p>;
  if (visits.length === 0) return <p className="text-sm text-faint italic">First visit on record.</p>;

  return (
    <ul className="divide-y divide-line">
      {visits.map((visit) => {
        const row = (
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-body">{formatVisitDate(visit.created_at)}</span>
            <span className="flex items-center gap-2 shrink-0">
              <RiskBadge level={visit.risk_level} />
              {visit.note_status && <StatusChip status={visit.note_status} />}
            </span>
          </div>
        );
        return (
          <li key={visit.id}>
            {visit.note_id ? (
              <Link
                href={`/dashboard/${visit.note_id}`}
                className="block hover:bg-surface rounded-lg -mx-2 px-2 transition-colors"
              >
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
