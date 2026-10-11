import type { CSSProperties } from 'react';
import { Icon } from '@/components/primitives';
import { resolveCarrierPlan } from '@/data/insurance-plans';
import { estimateCareCosts, formatCostRange } from '@/lib/cost-estimate';

// A scripted check-in with the seeded demo plan, so the first screen shows
// what Prelude does rather than describing it. The copay is computed, not typed.
const { carrier, plan } = resolveCarrierPlan('UHC', 'uhc-choice-plus');
const TELEHEALTH = formatCostRange(estimateCareCosts(plan).telehealth);

interface Turn {
  speaker: 'Patient' | 'Prelude';
  text: string;
  charted?: { icon: string; label: string; value: string };
}

const TURNS: Turn[] = [
  {
    speaker: 'Patient',
    text: 'I have an itchy rash on my forearm. It started three days ago.',
    charted: { icon: 'edit_note', label: 'Chief concern', value: 'Rash, right forearm, 3 days' },
  },
  {
    speaker: 'Prelude',
    text: 'Your chart shows a similar rash last November that cleared with a cream. Is it the same spot?',
    charted: { icon: 'history', label: 'From your history', value: 'Contact dermatitis, Nov 2025' },
  },
  { speaker: 'Patient', text: 'Yes, same arm. What will this visit cost me?' },
  {
    speaker: 'Prelude',
    text: `On ${carrier.name} ${plan.name}, a video visit is a ${TELEHEALTH} copay.`,
    charted: { icon: 'payments', label: 'Coverage checked', value: `Telehealth ${TELEHEALTH}` },
  },
];

const STEP_SECONDS = 0.9;
const delay = (i: number) => ({ '--reveal-delay': `${0.3 + i * STEP_SECONDS}s` }) as CSSProperties;

export default function CheckInPreview() {
  return (
    <section aria-label="Example check-in" className="bg-stage text-bright flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 pt-7 sm:px-8">
        <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-stage-glow/25 text-bright" aria-hidden>
          <Icon name="graphic_eq" className="text-[22px]" />
        </span>
        <div>
          <p className="font-bold text-[15px]">Example check-in</p>
          <p className="text-[13px] text-bright/70">Sick visit with Dr. Chen, seeded demo patient</p>
        </div>
      </div>

      <ol className="flex-1 flex flex-col justify-center gap-5 px-6 py-7 sm:px-8">
        {TURNS.map((turn, i) => (
          <li key={i} className="reveal-line flex flex-col gap-2" style={delay(i)}>
            <p className="text-[12px] font-semibold text-bright/60">{turn.speaker}</p>
            <p className="text-[15px] leading-relaxed max-w-[46ch]">{turn.text}</p>
            {turn.charted && (
              <p className="self-start flex items-center gap-2 bg-bright/10 px-2.5 py-1.5 text-[12.5px]">
                <Icon name={turn.charted.icon} className="text-[16px] text-stage-glow" />
                <span className="text-bright/70">{turn.charted.label}</span>
                <span className="font-semibold tabular-nums">{turn.charted.value}</span>
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="reveal-line flex items-center gap-3 border-t border-bright/15 px-6 py-4 sm:px-8" style={delay(TURNS.length)}>
        <Icon name="task_alt" className="text-[20px] text-stage-glow" />
        <p className="text-[13px] text-bright/80">
          Draft note and Care Card ready before the patient sits down.
        </p>
      </div>
    </section>
  );
}
