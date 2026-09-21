'use client';

import { useState } from 'react';
import { Btn } from '@/components/primitives';
import { SeverityMark } from './SeverityMark';
import type { SymptomEntry } from '@/types';

const DEFAULT_SEVERITY = 4;

function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

interface SymptomFormProps {
  patientId: string;
  onLogged: (entry: SymptomEntry) => void;
}

export function SymptomForm({ patientId, onLogged }: SymptomFormProps) {
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState(DEFAULT_SEVERITY);
  const [onsetDate, setOnsetDate] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, text: text.trim(), severity, onset: onsetDate }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onLogged((await res.json()) as SymptomEntry);
      setText('');
      setSeverity(DEFAULT_SEVERITY);
      setOnsetDate(todayLocal());
    } catch {
      setError('That did not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-panel border border-line p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="symptom-text" className="text-sm font-bold text-ink">
          What are you feeling?
        </label>
        <input
          id="symptom-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          required
          placeholder="Dull headache behind my right eye"
          className="bg-bright border border-line px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-ink"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="symptom-severity" className="text-sm font-bold text-ink">
          How strong is it?
        </label>
        <div className="flex items-center gap-4">
          <input
            id="symptom-severity"
            type="range"
            min={1}
            max={10}
            step={1}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            aria-valuetext={`${severity} out of 10`}
            className="flex-1 accent-[var(--color-ink)]"
          />
          <SeverityMark severity={severity} title={`Severity ${severity} out of 10`} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="symptom-onset" className="text-sm font-bold text-ink">
            When did it start?
          </label>
          <input
            id="symptom-onset"
            type="date"
            value={onsetDate}
            max={todayLocal()}
            onChange={(e) => setOnsetDate(e.target.value)}
            className="bg-bright border border-line px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
          />
        </div>
        <Btn type="submit" disabled={saving || !text.trim()} className="px-6 py-2.5 text-sm ml-auto">
          {saving ? 'Saving' : 'Add to timeline'}
        </Btn>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
