'use client';

import { useCallback, useState } from 'react';
import { Btn, SectionCard } from '@/components/primitives';
import { sanitizeField, saveMedCard } from '@/lib/medcard';

type Fields = {
  name: string;
  dosage: string;
  frequency: string;
};

const EMPTY_FIELDS: Fields = { name: '', dosage: '', frequency: '' };

const INPUT_CLASS =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-surface border border-line text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-light transition-colors';

export function ManualMedForm({ onSaved }: { onSaved?: () => void }) {
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [savedName, setSavedName] = useState<string | null>(null);

  const handleChange = useCallback(
    (field: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setSavedName(null);
      setFields((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const name = sanitizeField(fields.name);
      const dosage = sanitizeField(fields.dosage);
      const frequency = sanitizeField(fields.frequency);
      if (!name) return;

      const nameDose = [name, dosage].filter(Boolean).join(' ');
      const formatted = frequency ? `${nameDose} — ${frequency}` : nameDose;

      saveMedCard({ medications: [formatted], allergies: [], conditions: [] });
      setFields(EMPTY_FIELDS);
      setSavedName(formatted);
      onSaved?.();
    },
    [fields, onSaved]
  );

  return (
    <SectionCard title="Add a medication manually">
      <p className="text-sm text-body leading-relaxed">
        No camera or photo handy? Type in a medication and it&apos;s saved to your MedCard right
        away — no account, no keys, stored only in this browser.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {(
          [
            { field: 'name', label: 'Medication name', placeholder: 'e.g. Lisinopril', required: true },
            { field: 'dosage', label: 'Dosage (optional)', placeholder: 'e.g. 10mg', required: false },
            { field: 'frequency', label: 'Frequency / instructions (optional)', placeholder: 'e.g. once daily', required: false },
          ] as const
        ).map(({ field, label, placeholder, required }) => (
          <label key={field} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-body">{label}</span>
            <input
              type="text"
              value={fields[field]}
              onChange={handleChange(field)}
              placeholder={placeholder}
              required={required}
              maxLength={200}
              className={INPUT_CLASS}
            />
          </label>
        ))}

        {savedName && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Added {savedName} to your MedCard
          </div>
        )}

        <Btn type="submit" className="self-start px-6 py-2.5 text-sm" disabled={!fields.name.trim()}>
          Add to MedCard
        </Btn>
      </form>
    </SectionCard>
  );
}
