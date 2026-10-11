'use client';

import { useState } from 'react';
import { Icon } from '@/components/primitives';
import { useClientValue } from '@/hooks/useClientValue';

type ShareState = 'idle' | 'copied' | 'copy_failed' | 'share_failed';

const ACTION_CLS =
  'flex items-center justify-center gap-2 px-5 py-3 text-[14px] font-bold transition-colors duration-200';
const SECONDARY_CLS = `${ACTION_CLS} bg-bright text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-panel`;

const STATUS_TEXT: Record<ShareState, string> = {
  idle: 'The link carries the whole card, so anyone you send it to can read it. Prelude does not store a copy.',
  copied: 'Link copied. Anyone you send it to can read the card. Prelude does not store a copy.',
  copy_failed: 'Your browser blocked the clipboard. Copy the address bar instead.',
  share_failed: 'Sharing did not open. Use Copy link instead.',
};

const readCanShare = () => typeof navigator.share === 'function';

export default function ShareCardActions({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<ShareState>('idle');
  const [canShare] = useClientValue(readCanShare, false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('copy_failed');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, url });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setState('share_failed');
    }
  };

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={copyLink} className={`${ACTION_CLS} bg-ink text-bright hover:bg-brand`}>
          <Icon name={state === 'copied' ? 'check' : 'link'} className="text-[18px]" />
          {state === 'copied' ? 'Link copied' : 'Copy link'}
        </button>
        {canShare && (
          <button type="button" onClick={share} className={SECONDARY_CLS}>
            <Icon name="ios_share" className="text-[18px]" />
            Share
          </button>
        )}
        <button type="button" onClick={() => window.print()} className={SECONDARY_CLS}>
          <Icon name="print" className="text-[18px]" />
          Print
        </button>
      </div>
      <p role="status" className="text-[12.5px] leading-relaxed text-faint max-w-[60ch]">
        {STATUS_TEXT[state]}
      </p>
    </div>
  );
}
