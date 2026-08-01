'use client';

import { useState } from 'react';
import { Btn, MicroLabel, SectionCard } from '@/components/primitives';

type ResearchCareLevel =
  | 'self_monitor'
  | 'telehealth'
  | 'primary_care'
  | 'urgent_care'
  | 'emergency_room';

type Fit = 'low' | 'medium' | 'high';

interface CareOption {
  level: ResearchCareLevel;
  fit: Fit;
  why: string;
  est_cost: string;
}

interface ResearchResult {
  patient_explainer: string;
  provider_considerations: string[];
  red_flags_to_watch: string[];
  care_options: CareOption[];
  questions_to_ask: string[];
}

interface ResearchResponse {
  source: 'openai' | 'fallback';
  research: ResearchResult;
}

interface ResearchCoverage {
  copay?: number | null;
  deductible_remaining?: number | null;
  payer?: string;
}

interface Props {
  summary: string;
  symptoms: string[];
  riskFlags: string[];
  careLevel?: string;
  coverage?: ResearchCoverage;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

const LEVEL_ORDER: ResearchCareLevel[] = [
  'self_monitor',
  'telehealth',
  'primary_care',
  'urgent_care',
  'emergency_room',
];

const LEVEL_META: Record<ResearchCareLevel, { label: string; bar: string; ring: string; chip: string }> = {
  self_monitor: {
    label: 'Self-monitor',
    bar: 'bg-teal-400',
    ring: 'ring-teal-300',
    chip: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  telehealth: {
    label: 'Telehealth',
    bar: 'bg-blue-400',
    ring: 'ring-blue-300',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  primary_care: {
    label: 'Primary care',
    bar: 'bg-yellow-400',
    ring: 'ring-yellow-300',
    chip: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  urgent_care: {
    label: 'Urgent care',
    bar: 'bg-orange-400',
    ring: 'ring-orange-300',
    chip: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  emergency_room: {
    label: 'Emergency room',
    bar: 'bg-red-500',
    ring: 'ring-red-300',
    chip: 'bg-red-50 text-red-700 border-red-200',
  },
};

const FIT_BADGE: Record<Fit, { cls: string; label: string }> = {
  high: { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'High fit' },
  medium: { cls: 'bg-amber-50 text-amber-700 border border-amber-200', label: 'Medium fit' },
  low: { cls: 'bg-slate-100 text-slate-500 border border-slate-200', label: 'Low fit' },
};

function normalizeCareLevel(careLevel?: string): ResearchCareLevel | null {
  if (!careLevel) return null;
  const normalized = careLevel === 'self_care' ? 'self_monitor' : careLevel;
  return LEVEL_ORDER.includes(normalized as ResearchCareLevel)
    ? (normalized as ResearchCareLevel)
    : null;
}

function CareLevelSpectrum({ recommended }: { recommended: ResearchCareLevel | null }) {
  return (
    <div>
      <MicroLabel>Care level spectrum</MicroLabel>
      <div
        className="mt-2 flex items-end gap-1.5"
        role="img"
        aria-label={
          recommended
            ? `Care level spectrum from self-monitor to emergency room. Recommended level: ${LEVEL_META[recommended].label}.`
            : 'Care level spectrum from self-monitor to emergency room.'
        }
      >
        {LEVEL_ORDER.map((level) => {
          const meta = LEVEL_META[level];
          const isRecommended = level === recommended;
          return (
            <div key={level} className="flex-1 min-w-0">
              <div
                className={`rounded-md ${meta.bar} ${
                  isRecommended ? `h-5 ring-2 ring-offset-1 ${meta.ring}` : 'h-2.5 opacity-60'
                }`}
              />
              <p
                className={`mt-1.5 text-[10px] leading-tight truncate ${
                  isRecommended ? 'font-bold text-ink' : 'font-medium text-faint'
                }`}
              >
                {meta.label}
                {isRecommended && <span className="block text-[9px] font-semibold text-body">Recommended</span>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskFlagPills({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <div>
      <MicroLabel>Risk signals noted</MicroLabel>
      <div className="mt-2 flex flex-wrap gap-2" role="list" aria-label="Risk signals">
        {flags.map((flag, i) => {
          const isHighSignal = i === 0;
          return (
            <span
              key={flag}
              role="listitem"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                isHighSignal
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${isHighSignal ? 'bg-red-400' : 'bg-amber-400'}`}
              />
              {flag}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CareOptionsTable({
  options,
  recommended,
}: {
  options: CareOption[];
  recommended: ResearchCareLevel | null;
}) {
  const ordered = LEVEL_ORDER.map((level) => options.find((o) => o.level === level)).filter(
    (o): o is CareOption => o !== undefined
  );

  return (
    <div>
      <MicroLabel>Care options &amp; estimated cost</MicroLabel>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm" aria-label="Care options comparison">
          <thead>
            <tr className="border-b border-line bg-surface text-[11px] font-bold uppercase tracking-widest text-faint">
              <th scope="col" className="px-4 py-2.5">Option</th>
              <th scope="col" className="px-3 py-2.5">Fit</th>
              <th scope="col" className="px-3 py-2.5">Est. cost</th>
              <th scope="col" className="px-4 py-2.5">Why</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((option) => {
              const meta = LEVEL_META[option.level];
              const fit = FIT_BADGE[option.fit];
              const isRecommended = option.level === recommended;
              return (
                <tr
                  key={option.level}
                  className={`border-b border-line last:border-b-0 align-top ${
                    isRecommended ? 'bg-brand-light ring-1 ring-inset ring-brand/40' : ''
                  }`}
                  aria-current={isRecommended ? 'true' : undefined}
                >
                  <th scope="row" className="px-4 py-3 font-semibold text-ink whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>
                      {meta.label}
                    </span>
                    {isRecommended && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Recommended
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${fit.cls}`}>
                      {fit.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap font-semibold text-ink">{option.est_cost}</td>
                  <td className="px-4 py-3 leading-relaxed text-body">{option.why}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ResearchPanel({ summary, symptoms, riskFlags, careLevel, coverage }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<ResearchResult | null>(null);

  const recommended = normalizeCareLevel(careLevel);

  const handleRun = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, symptoms, riskFlags, careLevel, coverage }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data: ResearchResponse = await res.json();
      if (!data.research || !Array.isArray(data.research.care_options)) {
        throw new Error('Malformed research response');
      }
      setResult(data.research);
      setStatus('done');
    } catch {
      setResult(null);
      setStatus('error');
    }
  };

  return (
    <SectionCard title="Deep research">
      <div className="space-y-4">
        <CareLevelSpectrum recommended={recommended} />
        <RiskFlagPills flags={riskFlags} />

        {status === 'idle' && (
          <div className="space-y-2">
            <p className="text-sm text-body leading-relaxed">
              Generate a research draft for this visit: what the symptoms could involve, care
              options with estimated costs, and questions to ask. We only run this when you ask.
            </p>
            <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={handleRun}>
              Run Deep Research
            </Btn>
          </div>
        )}

        {status === 'loading' && (
          <p className="text-sm text-faint" role="status" aria-live="polite">
            Researching these symptoms&hellip;
          </p>
        )}

        {status === 'error' && (
          <div className="space-y-2">
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-4" role="status">
              Couldn&apos;t run research right now. Your provider review is unaffected.
            </div>
            <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={handleRun}>
              Try again
            </Btn>
          </div>
        )}

        {status === 'done' && result && (
          <div className="space-y-5">
            <div>
              <MicroLabel>What this could involve</MicroLabel>
              <p className="mt-2 text-sm text-body leading-relaxed">{result.patient_explainer}</p>
              {result.provider_considerations.length > 0 && (
                <div className="mt-3 rounded-xl border border-line bg-surface p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-faint">
                    For provider review
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {result.provider_considerations.map((item, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-body">
                        <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <CareOptionsTable options={result.care_options} recommended={recommended} />

            {result.questions_to_ask.length > 0 && (
              <div>
                <MicroLabel>Questions to ask your doctor</MicroLabel>
                <ol className="mt-2 space-y-1.5">
                  {result.questions_to_ask.map((question, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-body">
                      <span className="shrink-0 font-bold text-brand tabular-nums">{i + 1}.</span>
                      <span className="leading-relaxed">{question}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {result.red_flags_to_watch.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">
                  Red flags to watch
                </p>
                <ul className="mt-2 space-y-1.5">
                  {result.red_flags_to_watch.map((flag, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-red-700">
                      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                      <span className="leading-relaxed">{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-faint leading-relaxed">
          AI-generated research draft &mdash; reviewed by your provider. Not medical advice.
        </p>
      </div>
    </SectionCard>
  );
}
