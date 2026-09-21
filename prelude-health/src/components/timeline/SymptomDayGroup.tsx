'use client';

import { useState } from 'react';
import { Icon } from '@/components/primitives';
import { SeverityMark } from './SeverityMark';
import type { SymptomEntry } from '@/types';

const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

interface SymptomDayGroupProps {
  day: string;
  entries: SymptomEntry[];
  onDelete: (id: string) => void;
}

export function SymptomDayGroup({ day, entries, onDelete }: SymptomDayGroupProps) {
  return (
    <section className="grid sm:grid-cols-[150px_1fr] gap-x-5">
      <h2 className="text-sm font-bold text-ink py-3 sm:text-right sm:sticky sm:top-4 self-start">
        {new Date(day).toLocaleDateString(undefined, DAY_FORMAT)}
      </h2>
      <ul className="border-l border-line">
        {entries.map((entry) => (
          <SymptomRow key={entry.id} entry={entry} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );
}

function SymptomRow({ entry, onDelete }: { entry: SymptomEntry; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="group flex items-start gap-4 pl-5 pr-2 py-3.5 border-b border-line last:border-b-0">
      <span className="flex w-7 shrink-0 justify-center pt-0.5">
        <SeverityMark severity={entry.severity} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed text-ink break-words">{entry.text}</p>
        <p className="mt-1 text-xs text-faint">
          {new Date(entry.onset).toLocaleTimeString(undefined, TIME_FORMAT)}
        </p>
        {entry.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <li key={tag} className="bg-ink/5 px-2 py-0.5 text-xs text-body">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
      {confirming ? (
        <span className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="text-xs font-bold text-danger px-2 py-1 hover:bg-danger hover:text-bright transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-xs text-body px-2 py-1 hover:text-ink transition-colors"
          >
            Keep
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete symptom: ${entry.text}`}
          className="shrink-0 p-1.5 text-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger transition-all"
        >
          <Icon name="delete" className="text-[18px]" />
        </button>
      )}
    </li>
  );
}
