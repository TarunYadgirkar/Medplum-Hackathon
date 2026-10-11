'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Icon, Nav } from '@/components/primitives';
import CareCardView from '@/components/care-card/CareCardView';
import ShareCardActions from '@/components/care-card/ShareCardActions';
import { DEMO_CARE_CARD } from '@/data/demo-care-card';
import { careCardPath, decodeCareCard } from '@/lib/care-card';
import { useClientValue } from '@/hooks/useClientValue';

const readHash = () => window.location.hash;

export default function CareCardPage() {
  const [hash] = useClientValue<string | null>(readHash, null, 'hashchange');
  const decoded = useMemo(() => (hash ? decodeCareCard(hash) : null), [hash]);

  if (hash === null) return <div className="min-h-dvh bg-surface" />;

  const isSample = !hash;
  const card = decoded ?? (isSample ? DEMO_CARE_CARD : null);
  const shareUrl = typeof window === 'undefined' || !card ? '' : `${window.location.origin}${careCardPath(card)}`;

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <Nav right={<Link href="/intake" className="text-[13px] font-semibold text-brand hover:text-ink">Start a check-in</Link>} />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12 flex justify-center">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          {isSample && (
            <p className="flex items-start gap-2.5 bg-brand-light px-4 py-3 text-[13.5px] text-ink print:hidden">
              <Icon name="info" className="text-[18px] text-brand shrink-0" />
              This is a sample card for a seeded demo patient. Finish a check-in to get your own.
            </p>
          )}
          {card ? (
            <>
              <CareCardView card={card} />
              <ShareCardActions url={shareUrl} title={`Care Card: ${card.concern}`} />
            </>
          ) : (
            <section className="bg-bright px-6 py-10 flex flex-col gap-4">
              <h1 className="text-[24px] font-extrabold text-ink">This Care Card link is incomplete</h1>
              <p className="text-[15px] leading-relaxed text-body max-w-[56ch]">
                The card lives inside the link, and part of it is missing. Ask whoever sent it to copy the full
                link again, or start your own check-in.
              </p>
              <Link href="/intake" className="self-start flex items-center gap-2 bg-ink text-bright px-5 py-3 text-[14px] font-bold hover:bg-brand">
                <Icon name="mic" className="text-[18px]" />
                Start a check-in
              </Link>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
