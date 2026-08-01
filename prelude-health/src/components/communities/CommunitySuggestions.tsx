'use client';

import { useState } from 'react';
import { Btn, MicroLabel, SectionCard } from '@/components/primitives';

interface Community {
  name: string;
  title: string;
  members: number | null;
  description: string;
  why: string;
  url: string;
}

interface CommunitiesResponse {
  communities: Community[];
  disclaimer: string;
  source: 'openai' | 'fallback';
}

interface Props {
  summary: string;
  riskFlags?: string[];
}

type Status = 'idle' | 'loading' | 'done' | 'error';

function formatMembers(count: number | null): string | null {
  if (count === null || count <= 0) return null;
  if (count < 1000) return `${count} members`;
  if (count < 1_000_000) {
    const k = count / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k members`;
  }
  const m = count / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M members`;
}

export function CommunitySuggestions({ summary, riskFlags }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [disclaimer, setDisclaimer] = useState('');

  const handleFind = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, riskFlags }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data: CommunitiesResponse = await res.json();
      setCommunities(Array.isArray(data.communities) ? data.communities : []);
      setDisclaimer(typeof data.disclaimer === 'string' ? data.disclaimer : '');
      setStatus('done');
    } catch {
      setCommunities([]);
      setDisclaimer('');
      setStatus('error');
    }
  };

  return (
    <SectionCard title="Communities discussing similar symptoms">
      <p className="text-sm text-body leading-relaxed">
        Optionally find peer-support communities where others discuss similar experiences.
        We&apos;ll only look this up when you ask.
      </p>

      {status === 'idle' && (
        <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={handleFind}>
          Find related communities
        </Btn>
      )}

      {status === 'loading' && (
        <p className="text-sm text-faint" role="status" aria-live="polite">
          Searching communities&hellip;
        </p>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-4" role="status">
          Couldn&apos;t look up communities right now. Your provider and the steps above remain
          your best next move.
        </div>
      )}

      {status === 'done' && communities.length === 0 && (
        <p className="text-sm italic text-faint" role="status" aria-live="polite">
          No matching communities found &mdash; that&apos;s okay. Your provider and the steps
          above remain your best next move.
        </p>
      )}

      {status === 'done' && communities.length > 0 && (
        <div className="space-y-3">
          {disclaimer && (
            <div
              role="note"
              aria-label="Important disclaimer about online communities"
              className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium leading-relaxed rounded-xl p-3.5"
            >
              {disclaimer}
            </div>
          )}

          <ul className="space-y-3">
            {communities.map((community) => {
              const members = formatMembers(community.members);
              return (
                <li key={community.name} className="bg-surface border border-line rounded-xl p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">r/{community.name}</span>
                    {members && <MicroLabel>{members}</MicroLabel>}
                  </div>

                  {community.title && (
                    <p className="mt-0.5 text-xs font-medium text-faint">{community.title}</p>
                  )}

                  <p className="mt-2 text-sm text-body leading-relaxed">{community.why}</p>

                  {community.description && (
                    <p className="mt-1.5 text-xs text-faint leading-relaxed">{community.description}</p>
                  )}

                  <a
                    href={`https://www.reddit.com/r/${community.name}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open r/${community.name} on Reddit in a new tab`}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                  >
                    Open on Reddit &rarr;
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
