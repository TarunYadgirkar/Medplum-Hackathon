'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Nav, SectionCard, MicroLabel, Btn } from '@/components/primitives';
import { LAB_FLAG_STYLES } from '@/data/epic-mock';
import {
  getEpicImport,
  saveEpicImport,
  clearEpicImport,
  RECORDS_CHANGED_EVENT,
  type EpicImportState,
} from '@/lib/epic-import';
import { ConnectHealthRecordsButton } from '@/components/epic/ConnectHealthRecordsButton';
import { ChartTimeline } from '@/components/records/ChartTimeline';
import { RecordSummaryStrip } from '@/components/records/RecordSummaryStrip';

type RecordTab =
  | 'all'
  | 'timeline'
  | 'labs'
  | 'medications'
  | 'visits'
  | 'immunizations'
  | 'allergies'
  | 'conditions';

const TABS: { id: RecordTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'labs', label: 'Test Results' },
  { id: 'medications', label: 'Medications' },
  { id: 'visits', label: 'Visits' },
  { id: 'immunizations', label: 'Immunizations' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'conditions', label: 'Health Issues' },
];

type Snapshot = EpicImportState | null | undefined;

let cachedSnapshot: Snapshot = undefined;
const listeners = new Set<() => void>();

function notify() {
  cachedSnapshot = undefined;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Refresh when records change anywhere (e.g. the Epic import modal), not just
  // via this page's own actions.
  const onExternalChange = () => {
    cachedSnapshot = undefined;
    cb();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(RECORDS_CHANGED_EVENT, onExternalChange);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener(RECORDS_CHANGED_EVENT, onExternalChange);
    }
  };
}

function getSnapshot(): Snapshot {
  if (cachedSnapshot !== undefined) return cachedSnapshot;
  cachedSnapshot = getEpicImport();
  return cachedSnapshot;
}

function getServerSnapshot(): Snapshot {
  return undefined;
}

const EMERGENCY_NOTE =
  'Prelude is a pre-visit check-in tool, not a diagnosis system. In an emergency call 911, or 988 for mental health crises.';

export default function RecordsPage() {
  const importState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [activeTab, setActiveTab] = useState<RecordTab>('all');

  // Tab lives in the URL so back/forward/refresh/share behave like a real site.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab') as RecordTab | null;
    if (fromUrl && TABS.some((t) => t.id === fromUrl)) setActiveTab(fromUrl);
    const onPop = () => {
      const tab = new URLSearchParams(window.location.search).get('tab') as RecordTab | null;
      setActiveTab(tab && TABS.some((t) => t.id === tab) ? tab : 'all');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const selectTab = useCallback((tab: RecordTab) => {
    const url = tab === 'all' ? window.location.pathname : `${window.location.pathname}?tab=${tab}`;
    window.history.pushState(null, '', url);
    setActiveTab(tab);
  }, []);

  const handleLoadDemo = useCallback(() => {
    setIsLoadingDemo(true);
    saveEpicImport('sutter', 'Sutter Health');
    notify();
    setIsLoadingDemo(false);
  }, []);

  const handleClear = useCallback(() => {
    clearEpicImport();
    notify();
  }, []);

  if (importState === undefined) {
    return null;
  }

  if (importState === null) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav
          right={
            <Link href="/" className="text-sm font-semibold text-body hover:text-ink transition-colors">
              Home
            </Link>
          }
        />
        <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center">
          <div className="flex flex-col items-center gap-3">
            <MicroLabel>Health Records</MicroLabel>
            <h1 className="text-4xl font-bold leading-tight text-ink">No records yet</h1>
            <p className="max-w-sm text-base leading-relaxed text-body">
              Connect your health records to give Prelude the context it needs before your visit.
            </p>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm">
            <ul className="flex flex-col gap-4">
              <li className="flex flex-col items-start gap-1.5 text-left">
                <MicroLabel>From your health system</MicroLabel>
                <ConnectHealthRecordsButton />
              </li>

              <li aria-hidden="true" className="border-t border-line" />

              <li className="flex flex-col items-start gap-1.5 text-left">
                <MicroLabel>Explore with sample data</MicroLabel>
                <Btn
                  variant="secondary"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
                  onClick={handleLoadDemo}
                  disabled={isLoadingDemo}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.25" />
                    <path d="M7 4.5v2.75L8.5 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {isLoadingDemo ? 'Loading…' : 'Load example data'}
                </Btn>
                <p className="text-xs text-faint">
                  Loads a sample patient record to explore the experience.
                </p>
              </li>
            </ul>
          </div>

          <p className="max-w-md text-xs leading-relaxed text-faint">{EMERGENCY_NOTE}</p>
        </main>
      </div>
    );
  }

  const { record, systemName, importedAt } = importState;
  const shows = (tab: RecordTab) => activeTab === 'all' || activeTab === tab;

  return (
    <div className="flex min-h-screen flex-col">
      <Nav
        right={
          <Link href="/" className="text-sm font-semibold text-body hover:text-ink transition-colors">
            Home
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <header className="text-center">
          <MicroLabel>Health Records</MicroLabel>
          <h1 className="mt-2 text-3xl font-bold leading-snug text-ink">{record.patient.name}</h1>
          <p className="mt-1 text-sm text-body">
            DOB {record.patient.dob} · MRN {record.patient.mrn}
          </p>
          <p className="mt-1 text-xs text-faint">
            Imported from {systemName} on {new Date(importedAt).toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-faint">{record.patient.facility}</p>
        </header>

        <RecordSummaryStrip record={record} />

        <div role="tablist" aria-label="Filter records" className="flex flex-wrap justify-center gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => selectTab(tab.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand text-white shadow-sm'
                  : 'border border-line bg-white text-body hover:bg-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {shows('timeline') && <ChartTimeline record={record} />}

        {shows('labs') && (
        <SectionCard title="Test Results">
          <ul className="flex flex-col divide-y divide-line">
            {record.labResults.map((lab) => (
              <li key={lab.name} className="flex items-start justify-between gap-4 py-4 text-sm first:pt-0 last:pb-0">
                <div>
                  <p className="font-semibold text-ink">{lab.name}</p>
                  <p className="mt-0.5 text-body">
                    {lab.value} · {lab.date}
                  </p>
                  <p className="mt-0.5 text-xs text-faint">{lab.reference}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${LAB_FLAG_STYLES[lab.flag] ?? 'bg-slate-100 text-slate-500'}`}
                >
                  {lab.flag.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
        )}

        {shows('medications') && (
        <SectionCard title="Medications">
          <ul className="flex flex-col gap-4">
            {record.medications.map((med) => (
              <li key={med.name} className="text-sm">
                <p className="font-semibold text-ink">{med.name}</p>
                <p className="mt-0.5 text-body">
                  {med.frequency} — prescribed by {med.prescriber}, started {med.started}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
        )}

        {shows('visits') && (
        <SectionCard title="Visits">
          {record.upcomingVisits.length > 0 && (
            <div className="mb-5">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-faint">Upcoming</p>
              <ul className="flex flex-col gap-4">
                {record.upcomingVisits.map((visit) => (
                  <li key={`${visit.date}-${visit.type}`} className="text-sm">
                    <p className="font-semibold text-ink">{visit.type}</p>
                    <p className="mt-0.5 text-body">
                      {visit.date} — {visit.provider}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {record.upcomingVisits.length > 0 && (
            <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-faint">Past</p>
          )}
          <ul className="flex flex-col gap-4">
            {record.recentEncounters.map((enc) => (
              <li key={`${enc.date}-${enc.type}`} className="text-sm">
                <p className="font-semibold text-ink">{enc.type}</p>
                <p className="mt-0.5 text-body">
                  {enc.date} — {enc.provider}, {enc.facility}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
        )}

        {shows('immunizations') && (
        <SectionCard title="Immunizations">
          {record.immunizations.length === 0 ? (
            <p className="text-sm text-body">No immunizations on file.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {record.immunizations.map((imm) => (
                <li key={imm.name} className="text-sm">
                  <p className="font-semibold text-ink">{imm.name}</p>
                  <p className="mt-0.5 text-body">{imm.date}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        )}

        {shows('allergies') && (
        <SectionCard title="Allergies">
          <ul className="flex flex-col gap-4">
            {record.allergies.map((allergy) => (
              <li key={allergy.substance} className="text-sm">
                <p className="font-semibold text-ink">{allergy.substance}</p>
                <p className="mt-0.5 text-body">
                  {allergy.reaction} — {allergy.severity}, recorded {allergy.recorded}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
        )}

        {shows('conditions') && (
        <SectionCard title="Health Issues">
          <ul className="flex flex-col gap-4">
            {record.conditions.map((cond) => (
              <li key={cond.name} className="text-sm">
                <p className="font-semibold text-ink">{cond.name}</p>
                <p className="mt-0.5 text-body">
                  {cond.icd10} — {cond.status}, diagnosed {cond.diagnosed}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
        )}

        <div className="flex justify-center pt-4">
          <Link href="/intake">
            <Btn className="px-8 py-3.5 text-base">Start voice check-in</Btn>
          </Link>
        </div>

        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-medium text-faint transition-opacity hover:opacity-70"
          >
            Reset / clear records
          </button>
        </div>

        <p className="pb-4 text-center text-xs leading-relaxed text-faint">{EMERGENCY_NOTE}</p>
      </main>
    </div>
  );
}
