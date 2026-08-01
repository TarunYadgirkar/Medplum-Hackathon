'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { EPIC_FHIR_MOCK, EPIC_SYSTEMS, type EpicSystem } from '@/data/epic-mock';
import { saveEpicImport } from '@/lib/epic-import';
import { Btn } from '@/components/primitives';

type Step = 'select' | 'connecting' | 'success';

type Props = {
  onClose: () => void;
  patientName?: string;
};

const CONNECT_DELAY_MS = 2000;

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ConnectHealthRecordsModal({ onClose, patientName }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [system, setSystem] = useState<EpicSystem | null>(null);
  const [search, setSearch] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [isProgressStarted, setIsProgressStarted] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const filteredSystems = EPIC_SYSTEMS.filter((sys) =>
    sys.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    queueMicrotask(() => setIsMounted(true));
    previousFocusRef.current = document.activeElement as HTMLElement;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    closeBtnRef.current?.focus();
  }, [isMounted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (step !== 'connecting' || !system) return;
    // rAF so the bar mounts at 0% before the width transition kicks in.
    const raf = requestAnimationFrame(() => setIsProgressStarted(true));
    const timer = setTimeout(() => {
      saveEpicImport(system.id, system.name, patientName);
      setStep('success');
    }, CONNECT_DELAY_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [step, system, patientName]);

  const handleSelect = (selected: EpicSystem) => {
    if (step !== 'select') return;
    setSystem(selected);
    setStep('connecting');
  };

  const openedAtRef = useRef(Date.now());

  // Rapid double-clicks on the trigger land the second click inside the freshly
  // mounted modal (Cancel/backdrop sit under the trigger) and instantly close it —
  // ignore mouse-driven closes right after open. Escape stays unguarded.
  const guardedClose = () => {
    if (Date.now() - openedAtRef.current < 500) return;
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) guardedClose();
  };

  if (!isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onClick={handleBackdropClick}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Connect Health Records"
        className="w-full max-w-sm rounded-2xl border border-line bg-white shadow-lg"
      >
        {step === 'select' && (
          <div className="p-6">
            <div className="mb-1 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="text-brand">
                <rect x="2" y="1" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.25" />
                <path d="M5 6h8M5 9.5h8M5 13h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              </svg>
              <h2 className="text-base font-bold text-ink">Connect Health Records</h2>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={guardedClose}
                aria-label="Close"
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-faint transition-opacity hover:opacity-70 focus-visible:outline-2"
              >
                <CloseIcon />
              </button>
            </div>
            <p className="mb-4 text-xs text-body">
              Select your health system to securely link your chart.
            </p>

            <div className="relative mb-3">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              >
                <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.25" />
                <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search health systems…"
                className="w-full rounded-xl border border-line bg-surface py-2 pl-8 pr-4 text-sm text-ink outline-none transition-colors focus:border-brand"
              />
            </div>

            <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin' }}>
              {filteredSystems.length === 0 && (
                <p className="py-6 text-center text-sm text-body">
                  No health systems match &quot;{search}&quot;.
                </p>
              )}
              {filteredSystems.map((sys) => (
                <button
                  key={sys.id}
                  type="button"
                  onClick={() => handleSelect(sys)}
                  className="flex items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-brand-light focus-visible:outline-2"
                >
                  <span className="text-base" aria-hidden="true">{sys.logo}</span>
                  {sys.name}
                </button>
              ))}
            </div>

            <Btn variant="secondary" className="mt-4 w-full px-4 py-2 text-sm" onClick={guardedClose}>
              Cancel
            </Btn>
          </div>
        )}

        {step === 'connecting' && system && (
          <div className="relative flex flex-col items-center gap-5 p-8 text-center">
            <button
              ref={closeBtnRef}
              type="button"
              onClick={guardedClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-faint transition-opacity hover:opacity-70 focus-visible:outline-2"
            >
              <CloseIcon />
            </button>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light">
              <span
                aria-hidden="true"
                className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-light border-t-brand"
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Connecting to {system.name}</h2>
              <p className="mt-1 text-xs text-body">SMART on FHIR authorization</p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-brand"
                style={{
                  width: isProgressStarted ? '100%' : '0%',
                  transition: `width ${CONNECT_DELAY_MS}ms ease-out`,
                }}
              />
            </div>
            <p className="text-xs text-faint">Your records stay private to this visit.</p>
          </div>
        )}

        {step === 'success' && system && (
          <div className="relative flex flex-col items-center gap-4 p-8 text-center">
            <button
              ref={closeBtnRef}
              type="button"
              onClick={guardedClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-faint transition-opacity hover:opacity-70 focus-visible:outline-2"
            >
              <CloseIcon />
            </button>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <polyline
                  points="20 6 9 17 4 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-base font-bold text-ink">Records imported from {system.name}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-body">
                {EPIC_FHIR_MOCK.medications.length} medications &middot;{' '}
                {EPIC_FHIR_MOCK.allergies.length} allerg
                {EPIC_FHIR_MOCK.allergies.length === 1 ? 'y' : 'ies'} &middot;{' '}
                {EPIC_FHIR_MOCK.conditions.length} conditions &middot;{' '}
                {EPIC_FHIR_MOCK.labResults.length} test results &middot;{' '}
                {EPIC_FHIR_MOCK.immunizations.length} immunizations &middot;{' '}
                {EPIC_FHIR_MOCK.recentEncounters.length} recent visits
              </p>
            </div>

            <div className="mt-1 flex w-full flex-col gap-2">
              <Link
                href="/records"
                onClick={guardedClose}
                className="w-full rounded-xl bg-brand py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-dark hover:shadow-md"
              >
                View imported records
              </Link>
              <Btn variant="secondary" className="w-full px-4 py-2.5 text-sm" onClick={guardedClose}>
                Done
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
