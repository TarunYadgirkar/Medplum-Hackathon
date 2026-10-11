import { Icon } from '@/components/primitives';
import { CARE_LEVELS, careLevelMeta } from '@/lib/care-levels';
import { formatCostRange, VISIT_LEVELS } from '@/lib/cost-estimate';
import type { CareCard } from '@/lib/care-card';

const COST_SOURCE_NOTE: Record<CareCard['costSource'], string> = {
  stedi: 'The suggested option uses your live eligibility check. Other options are estimates from your plan profile.',
  synthetic: 'Estimates from a demo profile of this plan. Your insurer has the final number.',
  self_pay: 'Typical self-pay prices. Ask the clinic about cash discounts before your visit.',
};

const issuedFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function LevelScale({ active }: { active: CareCard['careLevel'] }) {
  return (
    <ol className="grid grid-cols-5 gap-px" aria-label="Care levels from least to most urgent">
      {CARE_LEVELS.map((level) => {
        const isActive = level.key === active;
        return (
          <li
            key={level.key}
            aria-current={isActive ? 'step' : undefined}
            className={`flex flex-col items-center gap-1.5 px-1 py-3 text-center ${isActive ? `${level.activeBg} text-bright` : `${level.tint} text-ink/60`}`}
          >
            <Icon name={level.icon} className="text-[20px]" />
            <span className={`text-[11px] leading-tight ${isActive ? 'font-bold' : 'font-medium'}`}>{level.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CostTable({ card }: { card: CareCard }) {
  return (
    <section aria-labelledby="cost-heading" className="flex flex-col gap-3">
      <h2 id="cost-heading" className="text-[17px] font-extrabold text-ink text-balance">
        {card.plan ? `What each option costs on ${card.plan}` : 'What each option costs without insurance'}
      </h2>
      <table className="w-full text-left">
        <thead className="sr-only">
          <tr><th>Option</th><th>Your cost</th></tr>
        </thead>
        <tbody>
          {VISIT_LEVELS.map((key) => {
            const meta = careLevelMeta(key);
            const suggested = key === card.careLevel;
            return (
              <tr key={key} className={`border-b border-line ${suggested ? 'bg-brand-light' : ''}`}>
                <th scope="row" className="py-3 pl-3 pr-2 font-semibold text-[14px] text-ink">
                  <span className="flex items-center gap-2.5">
                    <Icon name={meta.icon} className="text-[18px] text-brand" />
                    {meta.label}
                    {suggested && <span className="text-[11px] font-bold text-brand">Suggested</span>}
                  </span>
                </th>
                <td className="py-3 pr-3 text-right font-numeral text-[22px] tabular-nums text-ink">
                  {formatCostRange(card.costs[key])}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[12.5px] leading-relaxed text-faint max-w-[60ch]">{COST_SOURCE_NOTE[card.costSource]}</p>
    </section>
  );
}

export default function CareCardView({ card }: { card: CareCard }) {
  const meta = careLevelMeta(card.careLevel);
  return (
    <article className="bg-bright shadow-[0_1px_0_var(--color-line),0_18px_40px_-24px_rgb(19_26_38/0.35)] flex flex-col">
      <header className="bg-brand text-bright px-5 sm:px-8 py-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <p className="text-[13px] text-bright/75">Care Card{card.firstName ? ` for ${card.firstName}` : ''}</p>
          <h1 className="font-extrabold text-[26px] sm:text-[30px] leading-tight text-balance">{card.concern}</h1>
        </div>
        <p className="text-[13px] text-bright/75 tabular-nums">{issuedFormat.format(new Date(`${card.issued}T00:00:00Z`))}</p>
      </header>

      <div className="px-5 sm:px-8 py-7 flex flex-col gap-8">
        <section aria-labelledby="care-heading" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="care-heading" className="text-[22px] font-extrabold text-ink">
              Suggested care: {meta.label.toLowerCase()}
            </h2>
            <span className="text-[13px] text-faint tabular-nums shrink-0">{Math.round(card.confidence * 100)}% confident</span>
          </div>
          <LevelScale active={card.careLevel} />
          {card.reasoning && <p className="text-[15px] leading-relaxed text-body max-w-[62ch]">{card.reasoning}</p>}
        </section>

        <CostTable card={card} />

        {card.redFlags.length > 0 && (
          <section aria-labelledby="flags-heading" className="bg-danger/[0.07] px-4 sm:px-5 py-4 flex flex-col gap-2.5">
            <h2 id="flags-heading" className="flex items-center gap-2 text-[15px] font-extrabold text-danger">
              <Icon name="emergency" className="text-[20px]" />
              Call 911 or go to the ER if you notice
            </h2>
            <ul className="flex flex-col gap-1.5">
              {card.redFlags.map((flag, i) => (
                <li key={`${i}-${flag}`} className="flex gap-2.5 text-[14px] text-ink">
                  <span className="mt-2 w-1.5 h-1.5 bg-danger shrink-0" aria-hidden />
                  {flag}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[12.5px] leading-relaxed text-faint max-w-[62ch]">
          Prelude suggested this from your check-in. It is not a diagnosis. Your clinician reviews the full
          note and may recommend something different. For a mental health crisis call or text 988.
        </p>
      </div>
    </article>
  );
}
