'use client';

import { useState } from 'react';
import { Btn, SectionCard } from '@/components/primitives';
import { getMedCard } from '@/lib/medcard';
import { getEpicImport } from '@/lib/epic-import';

interface TrialMatch {
  title: string;
  condition_match: string;
  why_eligible: string;
  search_url: string;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

const DISCLAIMER =
  'Potential matches only — eligibility is determined by the trial team and your provider. Not medical advice.';

function safeTrialsUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.hostname === 'clinicaltrials.gov') return url;
  } catch {
    return null;
  }
  return null;
}

export function TrialMatches() {
  const [status, setStatus] = useState<Status>('idle');
  const [trials, setTrials] = useState<TrialMatch[]>([]);

  const handleCheck = async () => {
    setStatus('loading');
    try {
      const card = getMedCard();
      const epic = getEpicImport();
      const chartConditions = (epic?.record?.conditions ?? [])
        .map((c) => (typeof c?.name === 'string' ? c.name : ''))
        .filter(Boolean);

      const res = await fetch('/api/trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medications: (card?.medications ?? []).slice(0, 20),
          conditions: [...(card?.conditions ?? []), ...chartConditions].slice(0, 20),
          allergies: (card?.allergies ?? []).slice(0, 20),
        }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data: { trials?: TrialMatch[] } = await res.json();
      setTrials(Array.isArray(data.trials) ? data.trials : []);
      setStatus('done');
    } catch {
      setTrials([]);
      setStatus('error');
    }
  };

  return (
    <SectionCard title="Clinical trials">
      <p className="text-sm text-body leading-relaxed">
        Scan your MedCard and imported chart for research studies you may be eligible for.
      </p>

      {status === 'idle' && (
        <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={handleCheck}>
          Check trial eligibility
        </Btn>
      )}

      {status === 'loading' && (
        <p className="text-sm text-faint" role="status" aria-live="polite">
          Scanning for potential matches&hellip;
        </p>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-4" role="status">
          Couldn&apos;t check trials right now — please try again later.
        </div>
      )}

      {status === 'done' && trials.length === 0 && (
        <p className="text-sm italic text-faint" role="status" aria-live="polite">
          No potential matches found from your current card. Adding medications or conditions may
          surface more.
        </p>
      )}

      {status === 'done' && trials.length > 0 && (
        <ul className="space-y-2.5">
          {trials.map((trial) => {
            const url = safeTrialsUrl(trial.search_url);
            return (
              <li key={trial.title} className="bg-surface border border-line rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-ink">{trial.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-body">{trial.why_eligible}</p>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Search ${trial.condition_match} trials on ClinicalTrials.gov in a new tab`}
                    className="mt-1.5 inline-flex text-xs font-semibold text-brand hover:underline"
                  >
                    View on ClinicalTrials.gov &rarr;
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-faint">{DISCLAIMER}</p>
    </SectionCard>
  );
}
