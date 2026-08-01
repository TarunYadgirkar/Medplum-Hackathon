'use client';

import { useCallback, useEffect, useState } from 'react';
import { Nav, SectionCard, Btn } from '@/components/primitives';
import { MedCard } from '@/components/medcard/MedCard';
import { PillBottleScanner } from '@/components/medcard/PillBottleScanner';
import { ConnectHealthRecordsButton } from '@/components/epic/ConnectHealthRecordsButton';
import { getMedCard, clearMedCard, type MedCardData } from '@/lib/medcard';

export default function MedCardPage() {
  const [card, setCard] = useState<MedCardData | null>(null);

  const refresh = useCallback(() => {
    setCard(getMedCard());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClear = useCallback(() => {
    clearMedCard();
    setCard(null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex flex-1 flex-col items-center gap-6 px-6 py-10">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Your MedCard</h1>
          <p className="max-w-md text-sm leading-relaxed text-body">
            Medications, allergies, and conditions on file. Prelude uses this during your voice
            check-in so you don&apos;t have to repeat yourself.
          </p>
        </header>

        <div className="w-full max-w-3xl flex flex-col gap-5">
          <MedCard
            medications={card?.medications ?? []}
            allergies={card?.allergies ?? []}
            conditions={card?.conditions ?? []}
            lastUpdated={card?.lastUpdated}
          />

          {card && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-faint hover:text-body transition-colors"
                aria-label="Clear saved MedCard data"
              >
                Clear saved data
              </button>
            </div>
          )}

          <SectionCard title="Import from your health record">
            <p className="text-sm text-body leading-relaxed">
              Connect your Epic MyChart to pre-fill your medications, allergies, and conditions —
              they land on this card automatically.
            </p>
            <ConnectHealthRecordsButton />
          </SectionCard>

          <div className="flex items-center gap-4" aria-hidden="true">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs font-bold uppercase tracking-widest text-faint">
              or scan a pill bottle
            </span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <PillBottleScanner onSaved={refresh} />

          <div className="flex justify-center">
            <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={refresh}>
              Refresh card
            </Btn>
          </div>
        </div>
      </main>
    </div>
  );
}
