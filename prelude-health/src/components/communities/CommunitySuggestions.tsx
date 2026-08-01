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

function RedditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="12" fill="#FF4500" />
      <path
        fill="#fff"
        d="M19.6 11.9c0-.9-.73-1.63-1.63-1.63-.44 0-.83.17-1.12.45-1.11-.8-2.64-1.31-4.33-1.37l.74-3.47 2.41.51a1.16 1.16 0 1 0 .12-.57l-2.69-.57a.29.29 0 0 0-.34.22l-.82 3.88c-1.72.05-3.27.56-4.4 1.37a1.62 1.62 0 0 0-1.12-.45 1.63 1.63 0 0 0-.66 3.12c-.03.18-.05.37-.05.56 0 2.86 3.33 5.18 7.43 5.18s7.43-2.32 7.43-5.18c0-.19-.02-.37-.05-.55.57-.26.98-.83.98-1.5ZM7.68 13.06a1.16 1.16 0 1 1 2.33 0 1.16 1.16 0 0 1-2.33 0Zm6.51 3.07c-.79.79-2.31.85-2.76.85-.44 0-1.96-.06-2.75-.85a.3.3 0 0 1 .43-.43c.5.5 1.57.68 2.32.68.76 0 1.83-.18 2.33-.68a.3.3 0 1 1 .43.43Zm-.2-1.91a1.16 1.16 0 1 1 0-2.33 1.16 1.16 0 0 1 0 2.33Z"
      />
    </svg>
  );
}

const COMMUNITY_WARNINGS = [
  'These are public Reddit communities — posts are personal experiences from strangers, not medical advice.',
  'Content is not reviewed by clinicians and may be inaccurate or not apply to your situation.',
  'Never start, stop, or change medications or treatment based on what you read there.',
  'If you post, avoid sharing personal health details — Reddit is public and searchable.',
  'For emergencies call 911 (or 988 for a mental health crisis) — never wait on an online forum.',
];

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
    <SectionCard
      title="Communities discussing similar symptoms"
      badge={
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
          <RedditIcon size={14} /> via Reddit
        </span>
      }
    >
      <p className="text-sm text-body leading-relaxed">
        Optionally find peer-support communities on Reddit where others discuss similar
        experiences. We&apos;ll only look this up when you ask &mdash; and these are peer
        stories, never medical advice.
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
          <div
            role="note"
            aria-label="Important warnings about online communities"
            className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
              ⚠ Before you visit these communities
            </p>
            <ul className="space-y-1">
              {COMMUNITY_WARNINGS.map((w) => (
                <li key={w} className="flex gap-1.5 text-xs font-medium leading-relaxed text-amber-700">
                  <span className="shrink-0">·</span>
                  {w}
                </li>
              ))}
            </ul>
            {disclaimer && (
              <p className="text-xs font-medium leading-relaxed text-amber-700 border-t border-amber-200 pt-1.5">
                {disclaimer}
              </p>
            )}
          </div>

          <ul className="space-y-3">
            {communities.map((community) => {
              const members = formatMembers(community.members);
              return (
                <li key={community.name} className="bg-surface border border-line rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                      <RedditIcon /> r/{community.name}
                    </span>
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
                    <RedditIcon size={12} /> Open on Reddit &rarr; <span className="font-normal text-faint">(external site)</span>
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
