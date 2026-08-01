'use client';

import type { EpicImportResult } from '@/data/epic-mock';

const STATS = [
  { label: 'Test Results', dotClass: 'bg-emerald-500', count: (r: EpicImportResult) => r.labResults.length },
  { label: 'Medications', dotClass: 'bg-blue-500', count: (r: EpicImportResult) => r.medications.length },
  { label: 'Visits', dotClass: 'bg-brand', count: (r: EpicImportResult) => r.recentEncounters.length + r.upcomingVisits.length },
  { label: 'Immunizations', dotClass: 'bg-violet-500', count: (r: EpicImportResult) => r.immunizations.length },
  { label: 'Allergies', dotClass: 'bg-red-500', count: (r: EpicImportResult) => r.allergies.length },
  { label: 'Health Issues', dotClass: 'bg-amber-500', count: (r: EpicImportResult) => r.conditions.length },
] as const;

export function RecordSummaryStrip({ record }: { record: EpicImportResult }) {
  return (
    <div className="flex flex-wrap items-stretch justify-center gap-2 rounded-2xl border border-line bg-white p-3 shadow-sm">
      {STATS.map((stat) => (
        <div
          key={stat.label}
          className="flex min-w-[5.5rem] flex-1 flex-col items-center gap-1 rounded-xl bg-surface px-3 py-2.5"
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${stat.dotClass}`} />
            <span className="text-lg font-bold tabular-nums leading-none text-ink">
              {stat.count(record)}
            </span>
          </span>
          <span className="text-xs font-medium text-faint">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
