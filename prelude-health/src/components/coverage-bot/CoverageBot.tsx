'use client';
// Coverage bot — "Ask about coverage" Stedi assistant (handoff §6a/6b).
// Floating launcher docked bottom-right → slide-over panel with a guided,
// chip-driven thread: payer → member ID → care level → eligibility result.
// Talks to POST /api/eligibility; the API itself falls back to synthetic
// pricing, and a fetch failure still renders a synthetic-estimate notice —
// never a dead end. Self-contained: mount anywhere, no props required.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/primitives';
import type { CareLevel, CoverageSummary } from '@/types';

/* ── Guided-flow data ── */

type PayerKey = 'UHC' | 'CIGNA' | 'AETNA' | 'CMS';

const PAYERS: { key: PayerKey; label: string; demoId: string }[] = [
  { key: 'UHC', label: 'UnitedHealthcare', demoId: 'UHC202649' },
  { key: 'CIGNA', label: 'Cigna', demoId: '23456789100' },
  { key: 'AETNA', label: 'Aetna', demoId: 'AETNA12345' },
  { key: 'CMS', label: 'Medicare', demoId: 'CMS12345678' },
];

const CARE_LEVELS: { key: CareLevel; label: string; icon: string; hover: string }[] = [
  { key: 'telehealth', label: 'Telehealth', icon: 'videocam', hover: 'hover:bg-positive hover:border-positive hover:text-bright' },
  { key: 'primary_care', label: 'Primary care', icon: 'stethoscope', hover: 'hover:bg-brand hover:border-brand hover:text-bright' },
  { key: 'urgent_care', label: 'Urgent care', icon: 'local_hospital', hover: 'hover:bg-caution hover:border-caution hover:text-bright' },
  { key: 'emergency_room', label: 'Emergency room', icon: 'emergency', hover: 'hover:bg-danger hover:border-danger hover:text-bright' },
];

/* ── Thread message model ── */

type Msg =
  | { kind: 'bot'; text: string }
  | { kind: 'user'; text: string; icon?: string }
  | { kind: 'card'; coverage: CoverageSummary }
  | { kind: 'warn'; text: string };

type Step = 'payer' | 'member' | 'care' | 'checking' | 'result';

const GREETING: Msg[] = [
  { kind: 'bot', text: 'Hi — I can check what a visit will cost you. Estimates only, not a guarantee of coverage.' },
  { kind: 'bot', text: "Who's your insurer?" },
];

/* ── Small pieces ── */

const bubbleIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div {...bubbleIn} className="self-start max-w-[86%] bg-panel border border-line px-3.5 py-3 text-[13.5px] leading-relaxed text-ink">
      {children}
    </motion.div>
  );
}

function UserBubble({ text, icon }: { text: string; icon?: string }) {
  return (
    <motion.div {...bubbleIn} className="self-end bg-ink text-bright px-3.5 py-[11px] text-[13px] font-semibold flex items-center gap-2">
      {icon && <Icon name={icon} className="text-[16px]" />}
      {text}
    </motion.div>
  );
}

function WarnBubble({ text }: { text: string }) {
  return (
    <motion.div {...bubbleIn} className="self-start flex gap-2.5 bg-caution/15 border-l-4 border-caution px-3.5 py-3 text-[13px] leading-relaxed text-ink">
      <Icon name="warning" className="text-[20px] text-caution shrink-0" />
      <span>{text}</span>
    </motion.div>
  );
}

function TypingIndicator({ payerLabel }: { payerLabel: string }) {
  return (
    <motion.div {...bubbleIn} className="self-start flex items-center gap-2 bg-panel border border-line px-3.5 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 bg-brand"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
        />
      ))}
      <span className="ml-0.5 text-[11px] font-semibold text-body">Checking with {payerLabel}…</span>
    </motion.div>
  );
}

function CoverageCard({ coverage }: { coverage: CoverageSummary }) {
  const cells: { label: string; value: string }[] = [];
  if (coverage.copay != null) cells.push({ label: 'Copay', value: `$${coverage.copay}` });
  if (coverage.deductible_remaining != null) cells.push({ label: 'Deduct.', value: `$${coverage.deductible_remaining}` });
  if (coverage.estimated_visit_cost) {
    const { min, max } = coverage.estimated_visit_cost;
    cells.push({ label: 'Visit', value: min === max ? `$${min}` : `$${min}–${max}` });
  }
  return (
    <motion.div {...bubbleIn} className="bg-brand p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-bright/85">
          <Icon name="shield" className="text-[16px]" />
          Coverage
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-[.14em] text-bright/60 border border-bright/30 px-1.5 py-0.5">
          {coverage.source === 'stedi' ? 'Stedi eligibility' : 'Synthetic'}
        </span>
      </div>
      <div className="mt-3 font-extrabold text-[21px] leading-[1.1] tracking-tight text-bright">{coverage.payer}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-bright/90">
        <Icon name="verified" className="text-[15px]" />
        <span className="text-[10px] font-semibold">{coverage.plan_status}</span>
      </div>
      {cells.length > 0 && (
        <div className="mt-3.5 grid gap-px bg-bright/20" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
          {cells.map((cell) => (
            <div key={cell.label} className="bg-brand p-2.5">
              <div className="text-[7.5px] font-semibold uppercase tracking-[.14em] text-bright/60">{cell.label}</div>
              <div className="mt-1 font-numeral text-2xl leading-none text-bright">{cell.value}</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ChoiceChip({
  onClick, disabled, icon, children, className = '',
}: {
  onClick: () => void;
  disabled?: boolean;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-2.5 border border-ink/30 text-[11px] font-semibold text-ink transition-all duration-200 hover:bg-ink hover:border-ink hover:text-bright disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      {icon && <Icon name={icon} className="text-[15px]" />}
      {children}
    </button>
  );
}

/* ── Component ── */

export default function CoverageBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(GREETING);
  const [step, setStep] = useState<Step>('payer');
  const [payer, setPayer] = useState<(typeof PAYERS)[number]>(PAYERS[0]);
  const [memberId, setMemberId] = useState('');
  const [failedCare, setFailedCare] = useState<CareLevel | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const memberInputRef = useRef<HTMLInputElement>(null);

  const push = (...msgs: Msg[]) => setMessages((prev) => [...prev, ...msgs]);

  const openBot = () => {
    // Fresh thread each open — state resets on close.
    setMessages(GREETING);
    setStep('payer');
    setPayer(PAYERS[0]);
    setMemberId('');
    setFailedCare(null);
    setOpen(true);
  };
  const closeBot = useCallback(() => setOpen(false), []);

  // Escape closes; focus the panel on open (aria-modal dialog).
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBot();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeBot]);

  // Keep the newest message in view.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, step]);

  // Focus the member-ID input when that step appears.
  useEffect(() => {
    if (step === 'member') memberInputRef.current?.focus();
  }, [step]);

  /* ── Flow actions ── */

  const choosePayer = (p: (typeof PAYERS)[number]) => {
    setPayer(p);
    setMemberId(p.demoId);
    push({ kind: 'user', text: p.label }, { kind: 'bot', text: "What's your member ID?" });
    setStep('member');
  };

  const submitMemberId = () => {
    const id = memberId.trim() || payer.demoId;
    setMemberId(id);
    push({ kind: 'user', text: id, icon: 'badge' }, { kind: 'bot', text: 'What kind of visit?' });
    setStep('care');
  };

  const runCheck = async (care: CareLevel, careLabel: string, careIcon: string, echoUser = true) => {
    if (echoUser) push({ kind: 'user', text: careLabel, icon: careIcon });
    setStep('checking');
    setFailedCare(null);
    try {
      const res = await fetch('/api/eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payerKey: payer.key, memberId: memberId.trim() || payer.demoId, careLevel: care }),
      });
      if (!res.ok) throw new Error(`eligibility ${res.status}`);
      const coverage: CoverageSummary = await res.json();
      push({ kind: 'card', coverage }, { kind: 'bot', text: `“${coverage.spoken_summary}”` });
    } catch {
      setFailedCare(care);
      push({
        kind: 'warn',
        text: "The payer didn't answer, so treat this as a synthetic estimate — a typical plan runs about a $20 copay for telehealth and more for higher-acuity visits. Try again in a moment for a live answer.",
      });
    }
    setStep('result');
  };

  const chooseCare = (c: (typeof CARE_LEVELS)[number]) => runCheck(c.key, c.label, c.icon);

  const anotherVisitType = () => {
    push({ kind: 'bot', text: 'What kind of visit?' });
    setStep('care');
  };

  const differentInsurer = () => {
    push({ kind: 'bot', text: "Who's your insurer?" });
    setStep('payer');
  };

  const tryAgain = () => {
    if (!failedCare) return;
    const c = CARE_LEVELS.find((x) => x.key === failedCare) ?? CARE_LEVELS[0];
    runCheck(c.key, c.label, c.icon, false);
  };

  /* ── Render ── */

  return (
    <>
      {/* Launcher — docked bottom-right, sharp square, hover gradient */}
      {!open && (
        <button
          type="button"
          onClick={openBot}
          aria-haspopup="dialog"
          className="fixed bottom-7 right-7 z-40 flex items-center gap-2.5 px-[17px] py-[13px] bg-ink text-bright text-xs font-bold shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition-all duration-200 hover:[background:var(--grad-hover)] hover:-translate-y-0.5"
        >
          <Icon name="forum" className="text-[20px]" />
          Ask about coverage
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            {/* Scrim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeBot}
              className="fixed inset-0 z-50 bg-ink/40"
              aria-hidden
            />
            {/* Slide-over panel */}
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Coverage assistant"
              tabIndex={-1}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[400px] bg-surface border-l border-ink/30 shadow-[-24px_0_60px_rgba(0,0,0,0.28)] flex flex-col outline-none"
            >
              {/* Header */}
              <div className="flex items-start gap-3 px-5 py-4 bg-panel border-b border-line">
                <span className="w-[34px] h-[34px] shrink-0 bg-brand text-bright flex items-center justify-center">
                  <Icon name="shield" className="text-[20px]" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-[15px] text-ink">Coverage assistant</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[8.5px] font-medium uppercase tracking-[.16em] text-faint">Powered by Stedi</span>
                    <span className="text-[8px] font-semibold uppercase tracking-[.14em] text-caution border border-caution/45 px-1.5 py-0.5">Test mode</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeBot}
                  aria-label="Close coverage assistant"
                  className="w-[30px] h-[30px] flex items-center justify-center border border-ink/20 text-body transition-all duration-200 hover:bg-ink hover:text-bright hover:border-ink"
                >
                  <Icon name="close" className="text-[18px]" />
                </button>
              </div>

              {/* Thread */}
              <div className="flex-1 min-h-0 overflow-y-auto p-[18px] flex flex-col gap-3">
                {messages.map((m, i) => {
                  if (m.kind === 'bot') return <BotBubble key={i}>{m.text}</BotBubble>;
                  if (m.kind === 'user') return <UserBubble key={i} text={m.text} icon={m.icon} />;
                  if (m.kind === 'card') return <CoverageCard key={i} coverage={m.coverage} />;
                  return <WarnBubble key={i} text={m.text} />;
                })}

                {step === 'checking' && <TypingIndicator payerLabel={payer.label} />}

                {step === 'payer' && (
                  <motion.div {...bubbleIn} className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap gap-2">
                      {PAYERS.map((p) => (
                        <ChoiceChip key={p.key} onClick={() => choosePayer(p)}>{p.label}</ChoiceChip>
                      ))}
                    </div>
                    <p className="text-[9px] font-medium uppercase tracking-[.14em] text-faint">Mock payers only · no PHI</p>
                  </motion.div>
                )}

                {step === 'member' && (
                  <motion.div {...bubbleIn} className="flex flex-col gap-2.5">
                    <div className="flex border border-ink bg-bright">
                      <span className="w-11 shrink-0 flex items-center justify-center bg-ink text-bright">
                        <Icon name="badge" className="text-[19px]" />
                      </span>
                      <input
                        ref={memberInputRef}
                        type="text"
                        value={memberId}
                        onChange={(e) => setMemberId(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitMemberId(); }}
                        aria-label="Member ID"
                        className="flex-1 min-w-0 px-3 py-[11px] bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
                        placeholder={payer.demoId}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setMemberId(payer.demoId)}
                        className="flex items-center gap-2 px-3 py-2.5 border border-brand/45 text-[11px] font-semibold text-brand transition-all duration-200 hover:bg-brand hover:text-bright"
                      >
                        <Icon name="auto_fix_high" className="text-[15px]" />
                        Use demo ID
                      </button>
                      <button
                        type="button"
                        onClick={submitMemberId}
                        className="flex items-center gap-2 px-3 py-2.5 bg-ink text-bright text-[11px] font-bold transition-all duration-200 hover:[background:var(--grad-hover)]"
                      >
                        Continue
                        <Icon name="arrow_forward" className="text-[15px]" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 'care' && (
                  <motion.div {...bubbleIn} className="grid grid-cols-2 gap-2">
                    {CARE_LEVELS.map((c) => (
                      <ChoiceChip key={c.key} icon={c.icon} onClick={() => chooseCare(c)} className={c.hover}>
                        {c.label}
                      </ChoiceChip>
                    ))}
                  </motion.div>
                )}

                <div ref={threadEndRef} />
              </div>

              {/* Follow-ups */}
              {step === 'result' && (
                <div className="border-t border-line bg-panel p-3.5">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[.2em] text-faint">Next</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {failedCare && (
                      <ChoiceChip icon="refresh" onClick={tryAgain}>Try again</ChoiceChip>
                    )}
                    <ChoiceChip icon="repeat" onClick={anotherVisitType}>Another visit type</ChoiceChip>
                    <ChoiceChip icon="swap_horiz" onClick={differentInsurer}>Different insurer</ChoiceChip>
                    <Link
                      href="/intake"
                      className="flex items-center gap-2 px-3.5 py-2.5 bg-ink text-bright text-[11.5px] font-bold transition-all duration-200 hover:[background:var(--grad-hover)] hover:-translate-y-0.5"
                    >
                      <Icon name="mic" className="text-[16px]" />
                      Start voice check-in
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
