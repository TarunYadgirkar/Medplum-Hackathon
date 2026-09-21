'use client';

import Link from 'next/link';
import { Nav } from '@/components/primitives';
import { SymptomForm } from '@/components/timeline/SymptomForm';
import { SymptomDayGroup } from '@/components/timeline/SymptomDayGroup';
import { usePatientId, useSymptomTimeline } from '@/components/timeline/useSymptomTimeline';

export default function TimelinePage() {
  const { patientId, resolved } = usePatientId();
  const { days, loading, error, add, remove } = useSymptomTimeline(patientId);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Symptom timeline</h1>
          <p className="max-w-xl text-sm leading-relaxed text-body">
            Log how you feel between visits. Each entry is saved to your medical record, so your
            doctor sees it and the voice agent can bring it up at your next check-in.
          </p>
        </header>

        {resolved && !patientId && (
          <p className="bg-panel border border-line p-5 text-sm leading-relaxed text-body">
            Your timeline starts with your first check-in, which creates your record.{' '}
            <Link href="/intake" className="font-bold text-ink underline underline-offset-4">
              Start a voice check-in
            </Link>
          </p>
        )}

        {patientId && (
          <>
            <SymptomForm patientId={patientId} onLogged={add} />

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            {loading && <p className="text-sm text-faint">Loading your entries.</p>}

            {!loading && days.length === 0 && (
              <p className="text-sm text-faint">
                Nothing logged yet. Your first entry will appear here with the day it started.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {days.map((group) => (
                <SymptomDayGroup key={group.day} day={group.day} entries={group.entries} onDelete={remove} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
