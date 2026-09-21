'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getPatientSession } from '@/lib/patient-session';
import type { SymptomEntry } from '@/types';

const noopSubscribe = () => () => {};

// The stored patient id only exists in the browser, so it is read through
// useSyncExternalStore rather than an effect that sets state on mount.
export function usePatientId(): { patientId: string | null; resolved: boolean } {
  const patientId = useSyncExternalStore(
    noopSubscribe,
    () => getPatientSession()?.patientId ?? null,
    () => null
  );
  const resolved = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return { patientId, resolved };
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function groupByDay(entries: SymptomEntry[]): { day: string; entries: SymptomEntry[] }[] {
  const groups = new Map<string, SymptomEntry[]>();
  for (const entry of [...entries].sort((a, b) => (a.onset < b.onset ? 1 : -1))) {
    const key = dayKey(entry.onset);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return Array.from(groups, ([day, dayEntries]) => ({ day, entries: dayEntries }));
}

export function useSymptomTimeline(patientId: string | null) {
  const [entries, setEntries] = useState<SymptomEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = Boolean(patientId) && !loaded;

  useEffect(() => {
    if (!patientId) return;
    let active = true;
    fetch('/api/symptoms', { headers: { 'x-patient-id': patientId } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((rows: SymptomEntry[]) => {
        if (active) setEntries(rows);
      })
      .catch(() => {
        if (active) setError('Your timeline could not be loaded. Refresh to try again.');
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  const add = useCallback((entry: SymptomEntry) => {
    setEntries((current) => [entry, ...current]);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      if (!patientId) return;
      const previous = entries;
      setEntries((current) => current.filter((e) => e.id !== id));
      const res = await fetch('/api/symptoms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, id }),
      }).catch(() => null);
      if (!res?.ok) {
        setEntries(previous);
        setError('That entry could not be deleted. It is still on your timeline.');
      }
    },
    [entries, patientId]
  );

  const days = useMemo(() => groupByDay(entries), [entries]);

  return { entries, days, loading, error, add, remove };
}
