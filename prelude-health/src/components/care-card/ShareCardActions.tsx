'use client';

import { useState } from 'react';
import { Icon } from '@/components/primitives';

type CopyState = 'idle' | 'copied' | 'failed';

const ACTION_CLS =
  'flex items-center justify-center gap-2 px-5 py-3 text-[14px] font-bold transition-colors duration-200';

export default function ShareCardActions({ url, title }: { url: string; title: string }) {
  const [copy, setCopy] = useState<CopyState>('idle');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, url });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setCopy('failed');
    }
  };

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={copyLink} className={`${ACTION_CLS} bg-ink text-bright hover:bg-brand`}>
          <Icon name={copy === 'copied' ? 'check' : 'link'} className="text-[18px]" />
          {copy === 'copied' ? 'Link copied' : 'Copy link'}
        </button>
        {canShare && (
          <button type="button" onClick={share} className={`${ACTION_CLS} bg-bright text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-panel`}>
            <Icon name="ios_share" className="text-[18px]" />
            Share
          </button>
        )}
        <button type="button" onClick={() => window.print()} className={`${ACTION_CLS} bg-bright text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-panel`}>
          <Icon name="print" className="text-[18px]" />
          Print
        </button>
      </div>
      <p role="status" className="text-[12.5px] leading-relaxed text-faint max-w-[60ch]">
        {copy === 'failed'
          ? 'Your browser blocked the clipboard. Copy the address bar instead.'
          : 'The link carries the whole card, so anyone you send it to can read it. Prelude does not store a copy.'}
      </p>
    </div>
  );
}
