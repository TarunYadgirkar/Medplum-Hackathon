import type { ReactNode } from 'react';
import { BulletList, MicroLabel } from '@/components/primitives';

type Props = {
  medications: string[];
  allergies: string[];
  conditions: string[];
  lastUpdated?: string;
};

function Group({
  title,
  items,
  dotClass,
  icon,
}: {
  title: string;
  items: string[];
  dotClass: string;
  icon: ReactNode;
}) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-line">
        <span aria-hidden="true" className="text-brand flex items-center">{icon}</span>
        <MicroLabel>{title}</MicroLabel>
      </div>
      <BulletList items={items} dotClass={dotClass} empty="Nothing on file yet" />
    </div>
  );
}

const MedIcon = () => (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M22 22l-1.5-1.5" />
  </svg>
);

const AllergyIcon = () => (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ConditionIcon = () => (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ShieldIcon = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const EMPTY_STATE_WAYS = [
  { icon: '📷', label: 'Scan a pill bottle', detail: 'Snap a photo of the label below' },
  { icon: '✍️', label: 'Add it manually', detail: 'Type a medication in the form below' },
  { icon: '🔗', label: 'Import from MyChart', detail: 'Connect Epic to pre-fill everything' },
] as const;

function EmptyState() {
  return (
    <div className="p-5">
      <div className="rounded-xl border border-dashed border-line bg-surface px-5 py-6 text-center">
        <p className="text-sm font-semibold text-ink">Your card is empty — let&apos;s fix that</p>
        <p className="mt-1 text-xs text-faint">Three ways to fill it, pick whichever is easiest:</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-left">
          {EMPTY_STATE_WAYS.map(({ icon, label, detail }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-center">
              <span aria-hidden="true" className="text-xl">{icon}</span>
              <p className="text-xs font-semibold text-body">{label}</p>
              <p className="text-xs leading-relaxed text-faint">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MedCard({ medications, allergies, conditions, lastUpdated }: Props) {
  const isEmpty = medications.length === 0 && allergies.length === 0 && conditions.length === 0;
  return (
    <section aria-labelledby="medcard-heading" className="bg-white border border-line rounded-2xl shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-line">
        <div className="flex items-center gap-2">
          <ShieldIcon />
          <h2 id="medcard-heading" className="text-xs font-bold uppercase tracking-widest text-faint">
            Medical card
          </h2>
        </div>
        {lastUpdated && (
          <span className="text-xs text-faint">
            Updated {new Date(lastUpdated).toLocaleDateString()}
          </span>
        )}
      </div>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <Group title="Medications" items={medications} dotClass="bg-brand" icon={<MedIcon />} />
          <Group title="Allergies" items={allergies} dotClass="bg-red-400" icon={<AllergyIcon />} />
          <Group title="Conditions" items={conditions} dotClass="bg-amber-400" icon={<ConditionIcon />} />
        </div>
      )}
    </section>
  );
}
