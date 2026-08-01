'use client';
// Patient voice check-in — UI structure carried over from klarity-voicenote's
// intake flow, voice engine swapped from Retell to the Deepgram Voice Agent.
// Styled per the Claude Design handoff (§5b–5d, §5g): sharp corners, ink-on-paper
// palette, segmented step header, icon-square input rows, dark voice stage.
// Circles are reserved for the voice orb.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { useGrokVoice } from '@/hooks/useGrokVoice';
import { Nav, Btn, Icon } from '@/components/primitives';
import CoverageBot from '@/components/coverage-bot/CoverageBot';
import { ConnectHealthRecordsButton } from '@/components/epic/ConnectHealthRecordsButton';
import { getImportedHistoryDocs, getEpicImport, RECORDS_CHANGED_EVENT } from '@/lib/epic-import';

type Step = 'form' | 'consent' | 'calling' | 'complete';
const OTHER_APPOINTMENT = '__other__';

const CALL_LENGTHS = [
  { seconds: 30, label: '30 sec (demo)' },
  { seconds: 60, label: '1 min' },
  { seconds: 180, label: '3 min' },
  { seconds: 300, label: '5 min' },
];
const STEPS = [
  { label: 'Form', icon: 'edit_note' },
  { label: 'Consent', icon: 'verified_user' },
  { label: 'Check-in', icon: 'mic' },
  { label: 'Done', icon: 'task_alt' },
];
const STEP_INDEX: Record<Step, number> = { form: 0, consent: 1, calling: 2, complete: 3 };

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.38, ease: 'easeOut' as const },
};

const DEMO_TRANSCRIPT = `Agent: Hi, I'm Prelude, your clinic's intake assistant. What brings you in?
Patient: I've got this itchy rash on my right forearm, it started about three days ago after I was gardening.
Agent: I see you had a similar rash last November that was treated with triamcinolone cream. Does this feel like the same thing?
Patient: Oh yeah, honestly it does. That cream worked great last time.
Agent: Good to know — I'll note that for your doctor. Any fever, swelling of your face or throat, or trouble breathing?
Patient: No, nothing like that. Just really itchy, especially at night. I tried hydrocortisone from the pharmacy but it barely helps.
Agent: Understood. Anything else the doctor should know? And do you have any questions about cost or coverage?
Patient: Yeah actually — what would a visit cost me?
Agent: Your UnitedHealthcare plan shows active coverage. A telehealth visit would be about a $20 copay, and given your history this looks well suited to telehealth. Your doctor will confirm.
Patient: Perfect, that's all I needed.
Agent: Great. I've charted everything for your provider to review before your visit. Feel better soon!`;

/* Micro field label (design-system recipe) */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[9.5px] font-semibold uppercase tracking-[.2em] text-faint">{children}</span>;
}

/* Dark voice stage — hero call presence. The orb is the one place circles are allowed. */
function VoiceStage({ state }: { state: string }) {
  const status =
    state === 'ended'
      ? { icon: 'hub', text: 'Charting your visit…' }
      : state === 'connecting'
        ? { icon: 'mic', text: 'Connecting — allow microphone access…' }
        : state === 'agent_speaking'
          ? { icon: 'volume_up', text: 'Prelude is speaking' }
          : { icon: 'hearing', text: 'Listening — speak when ready' };
  return (
    <div className="relative h-72 bg-ink overflow-hidden flex items-center justify-center">
      {/* ambient glows */}
      <div className="absolute w-72 h-72 -left-10 -top-16 rounded-full bg-caution/25 blur-3xl" aria-hidden />
      <div className="absolute w-64 h-64 -right-12 -bottom-16 rounded-full bg-danger/25 blur-3xl" aria-hidden />
      {/* corner ticks */}
      {(['left-2.5 top-2.5', 'right-2.5 top-2.5', 'left-2.5 bottom-2.5', 'right-2.5 bottom-2.5'] as const).map((pos) => (
        <span key={pos} className={`absolute ${pos}`} aria-hidden>
          <span className={`absolute w-4 h-px bg-bright/50 ${pos.includes('right') ? 'right-0' : 'left-0'} ${pos.includes('bottom') ? 'bottom-0' : 'top-0'}`} />
          <span className={`absolute w-px h-4 bg-bright/50 ${pos.includes('right') ? 'right-0' : 'left-0'} ${pos.includes('bottom') ? 'bottom-0' : 'top-0'}`} />
        </span>
      ))}

      {state === 'ended' ? (
        <div className="w-16 h-16 bg-positive flex items-center justify-center">
          <Icon name="check" className="text-[34px] text-bright" />
        </div>
      ) : (
        <div className="relative w-40 h-40">
          <div className="absolute -inset-8 rounded-full bg-brand-accent/25 blur-2xl animate-breathe" aria-hidden />
          <div className={`relative w-40 h-40 rounded-full bg-bright overflow-hidden shadow-[0_0_0_1px_var(--color-line),0_24px_60px_rgba(0,0,0,.4)] ${state === 'connecting' ? 'animate-breathe' : ''}`}>
            <div className="absolute w-28 h-28 -left-4 -top-2 rounded-full bg-brand/80 blur-xl" aria-hidden />
            <div className="absolute w-24 h-24 right-0 top-9 rounded-full bg-danger/70 blur-xl" aria-hidden />
            <div className="absolute w-24 h-24 left-4 -bottom-2 rounded-full bg-caution/80 blur-xl" aria-hidden />
          </div>
        </div>
      )}

      <span className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 text-[9.5px] font-bold uppercase tracking-[.2em] text-bright/80">
        <Icon name={status.icon} className="text-[16px]" />
        {status.text}
      </span>
    </div>
  );
}

export default function IntakePage() {
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [appointmentType, setAppointmentType] = useState('Sick visit');
  const [isCustomAppointment, setIsCustomAppointment] = useState(false);
  const [payerKey, setPayerKey] = useState('UHC');
  const [callLengthIdx, setCallLengthIdx] = useState(2);
  const [ageRange, setAgeRange] = useState('');
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<{ patientId: string; encounterId: string } | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [provider, setProvider] = useState<'deepgram' | 'grok' | 'demo'>('deepgram');
  const [finishing, setFinishing] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [chartConnected, setChartConnected] = useState(false);

  useEffect(() => {
    const sync = () => setChartConnected(Boolean(getEpicImport()));
    sync();
    window.addEventListener(RECORDS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(RECORDS_CHANGED_EVENT, sync);
  }, []);

  // Browser back/forward moves between steps instead of leaving the flow.
  const stepRef = useRef<Step>('form');
  stepRef.current = step;
  const stopRef = useRef<(() => unknown) | null>(null);

  const goToStep = useCallback((next: Step) => {
    window.history.pushState({ intakeStep: next }, '');
    setStep(next);
  }, []);

  useEffect(() => {
    window.history.replaceState({ intakeStep: 'form' }, '');
    const onPop = (e: PopStateEvent) => {
      const target: Step = e.state?.intakeStep ?? 'form';
      // Leaving a live call via back: end it cleanly first.
      if (stepRef.current === 'calling' && target !== 'calling') stopRef.current?.();
      // Back from the done screen restarts the flow rather than replaying a call.
      setStep(target === 'calling' || target === 'complete' ? 'form' : target);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Two interchangeable voice engines: Deepgram Voice Agent (sponsor, primary)
  // and Grok Voice (carried over from carepath as a battle-tested backup).
  const deepgram = useVoiceAgent();
  const grok = useGrokVoice();
  const voice = provider === 'grok' ? grok : deepgram;
  const { state: voiceState, transcript, coverage, error, stop } = voice;
  stopRef.current = stop;

  // Live transcript auto-scrolls to the newest utterance.
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length]);

  const beginCheckIn = useCallback(async () => {
    setLoading(true);
    try {
      if (payerKey === 'NONE') localStorage.removeItem('prelude-payer');
      else localStorage.setItem('prelude-payer', payerKey);
      const res = await fetch('/api/intake-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName: name, appointmentType, ageRange, historyDocs: getImportedHistoryDocs() ?? undefined }),
      });
      const data = await res.json();
      setSession(data);
      goToStep('calling');

      const cfg = await fetch('/api/voice-config').then((r) => r.json()).catch(() => ({ provider: 'demo' }));
      setProvider(cfg.provider);
      if (cfg.provider === 'demo') {
        setDemoMode(true);
      } else {
        const engine = cfg.provider === 'grok' ? grok : deepgram;
        await engine.start({ patientId: data.patientId, patientName: name, appointmentType, callSeconds: CALL_LENGTHS[callLengthIdx].seconds });
      }
    } catch {
      alert('Failed to start check-in. Try again.');
    } finally {
      setLoading(false);
    }
  }, [name, appointmentType, ageRange, payerKey, callLengthIdx, grok, deepgram, goToStep]);

  const finishCall = useCallback(async (transcriptText?: string) => {
    if (!session) return;
    setFinishing(true);
    const finalTranscript = transcriptText
      ?? stop().map((u) => `${u.role === 'agent' ? 'Agent' : 'Patient'}: ${u.content}`).join('\n');
    try {
      const res = await fetch('/api/generate-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: finalTranscript || DEMO_TRANSCRIPT,
          patientId: session.patientId,
          encounterId: session.encounterId,
          patientName: name,
          payerKey: payerKey === 'NONE' ? undefined : payerKey,
        }),
      });
      const data = await res.json();
      setNoteId(data.noteId ?? null);
    } catch (err) {
      console.error('generate-note failed', err);
    } finally {
      setFinishing(false);
      goToStep('complete');
    }
  }, [session, stop, name, payerKey, goToStep]);

  const stepIdx = STEP_INDEX[step];

  const selectCls = 'mt-1 w-full appearance-none bg-transparent text-[15px] text-ink pr-7 focus:outline-none cursor-pointer';
  const chev = <Icon name="expand_more" className="text-[20px] text-faint absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />;

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <Nav right={
        <span className="flex items-center gap-2 text-[9.5px] font-semibold uppercase tracking-[.2em] text-faint">
          <Icon name="person" className="text-[16px]" />Voice check-in
        </span>
      } />

      <main className="flex-1 px-6 py-10 flex justify-center">
        <div className="w-full max-w-2xl">

          {/* Segmented step header */}
          <div className="flex border border-line bg-panel">
            {STEPS.map((s, i) => {
              const active = i === stepIdx;
              const done = i < stepIdx;
              return (
                <div key={s.label}
                  className={`flex-1 flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-3 transition-colors duration-300 ${i > 0 ? 'border-l border-line' : ''} ${
                    active ? 'bg-ink text-bright' : done ? 'text-ink' : 'text-faint'
                  }`}>
                  <Icon name={done ? 'check' : s.icon} className={`text-[18px] ${done ? 'text-positive' : ''}`} />
                  <span className="text-[11px] font-bold">{s.label}</span>
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} {...fadeUp} className="-mt-px">

              {step === 'form' && (
                <div className="border border-line bg-panel p-6 sm:p-8">
                  <h1 className="text-3xl font-extrabold text-ink tracking-tight">Check in before your visit</h1>
                  <p className="mt-2.5 text-sm text-body leading-relaxed">
                    Talk to Prelude for ~3 minutes. Your conversation is charted for your doctor as it happens — and you can ask what your visit will cost.
                  </p>

                  <div className="mt-5 flex items-center gap-3.5 bg-danger/10 border-l-4 border-danger px-4 py-3">
                    <Icon name="emergency" className="text-[22px] text-danger shrink-0" />
                    <p className="text-sm text-ink leading-relaxed"><strong className="text-danger">Not a doctor.</strong> Prelude collects information only — no diagnosis, no treatment. In an emergency call <strong>911</strong> (or <strong>988</strong> for mental health crisis).</p>
                  </div>

                  <div className="mt-6 space-y-3.5">
                    {/* Name */}
                    <div className="flex border border-ink bg-bright transition-shadow duration-200 focus-within:shadow-[0_6px_0_var(--color-line)]">
                      <span className="w-[52px] flex-none flex items-center justify-center bg-ink text-bright">
                        <Icon name="badge" className="text-[21px]" />
                      </span>
                      <label className="flex-1 px-4 py-2.5 cursor-text">
                        <FieldLabel>Your name</FieldLabel>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name as it appears in your records"
                          className="mt-1 w-full bg-transparent text-[15px] text-ink placeholder-faint focus:outline-none" />
                      </label>
                    </div>

                    {/* Appointment type + age range */}
                    <div className="grid sm:grid-cols-2 gap-3.5">
                      <div>
                        <div className="flex border border-line bg-bright transition-colors duration-200 hover:border-ink focus-within:border-ink">
                          <span className="w-[52px] flex-none flex items-center justify-center bg-ink/5 text-ink">
                            <Icon name="event_available" className="text-[21px]" />
                          </span>
                          <div className="relative flex-1 px-4 py-2.5">
                            <FieldLabel>Appointment type</FieldLabel>
                            <select value={isCustomAppointment ? OTHER_APPOINTMENT : appointmentType}
                              onChange={(e) => {
                                if (e.target.value === OTHER_APPOINTMENT) {
                                  setIsCustomAppointment(true);
                                  setAppointmentType('');
                                } else {
                                  setIsCustomAppointment(false);
                                  setAppointmentType(e.target.value);
                                }
                              }}
                              className={selectCls}>
                              <option>Sick visit</option>
                              <option>New patient visit</option>
                              <option>Annual physical</option>
                              <option>Follow-up</option>
                              <option>Telehealth consult</option>
                              <option value={OTHER_APPOINTMENT}>Other — describe it…</option>
                            </select>
                            {chev}
                          </div>
                        </div>
                        {isCustomAppointment && (
                          <div className="mt-2 flex border border-line bg-bright transition-colors duration-200 focus-within:border-ink">
                            <span className="w-[52px] flex-none flex items-center justify-center bg-ink/5 text-ink">
                              <Icon name="edit_note" className="text-[21px]" />
                            </span>
                            <label className="flex-1 px-4 py-2.5 cursor-text">
                              <FieldLabel>Describe it</FieldLabel>
                              <input type="text" value={appointmentType} autoFocus
                                onChange={(e) => setAppointmentType(e.target.value)}
                                placeholder="e.g. knee pain consult, medication review…"
                                maxLength={100}
                                className="mt-1 w-full bg-transparent text-[15px] text-ink placeholder-faint focus:outline-none" />
                            </label>
                          </div>
                        )}
                      </div>
                      <div className="flex self-start border border-line bg-bright transition-colors duration-200 hover:border-ink focus-within:border-ink">
                        <span className="w-[52px] flex-none flex items-center justify-center bg-ink/5 text-ink">
                          <Icon name="hourglass_empty" className="text-[21px]" />
                        </span>
                        <div className="relative flex-1 px-4 py-2.5">
                          <FieldLabel>Age range · optional</FieldLabel>
                          <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} className={selectCls}>
                            <option value="">Prefer not to say</option>
                            <option>18–24</option><option>25–34</option><option>35–44</option><option>45–54</option><option>55+</option>
                          </select>
                          {chev}
                        </div>
                      </div>
                    </div>

                    {/* Insurance */}
                    <div>
                      <div className="flex border border-line bg-bright transition-colors duration-200 hover:border-ink focus-within:border-ink">
                        <span className="w-[52px] flex-none flex items-center justify-center bg-ink/5 text-ink">
                          <Icon name="shield" className="text-[21px]" />
                        </span>
                        <div className="relative flex-1 px-4 py-2.5">
                          <FieldLabel>Insurance</FieldLabel>
                          <select value={payerKey} onChange={(e) => setPayerKey(e.target.value)} className={selectCls}>
                            <option value="UHC">UnitedHealthcare</option>
                            <option value="CIGNA">Cigna</option>
                            <option value="AETNA">Aetna</option>
                            <option value="CMS">Medicare</option>
                            <option value="NONE">Self-pay / not sure</option>
                          </select>
                          {chev}
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-faint">Used when you ask Prelude what your visit will cost.</p>
                    </div>

                    {/* Urgency / call length */}
                    <div className="flex border border-line bg-bright transition-colors duration-200 hover:border-ink focus-within:border-ink">
                      <span className="w-[52px] flex-none flex items-center justify-center bg-ink/5 text-ink">
                        <Icon name="timer" className="text-[21px]" />
                      </span>
                      <div className="flex-1 px-4 py-2.5">
                        <label htmlFor="urgency-slider">
                          <FieldLabel>Urgency · call length: {CALL_LENGTHS[callLengthIdx].label}</FieldLabel>
                        </label>
                        <input id="urgency-slider" type="range" min={0} max={3} step={1} value={callLengthIdx}
                          onChange={(e) => setCallLengthIdx(Number(e.target.value))}
                          className="mt-2 w-full accent-brand" />
                        <div className="flex justify-between text-[11px] text-faint mt-1">
                          {CALL_LENGTHS.map((c, i) => (
                            <button key={c.seconds} type="button" onClick={() => setCallLengthIdx(i)}
                              className={`transition-colors ${i === callLengthIdx ? 'text-brand font-semibold' : 'hover:text-body'}`}>
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* MyChart / health-records import */}
                    <div className={`flex items-center gap-3.5 border px-4 py-3.5 transition-colors ${chartConnected ? 'border-brand/35 bg-brand/5' : 'border-line bg-bright'}`}>
                      <Icon name="folder_shared" className={`text-[24px] shrink-0 ${chartConnected ? 'text-brand' : 'text-faint'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-ink">
                          {chartConnected ? `Health records connected · ${getEpicImport()?.systemName ?? ''}` : 'Use MyChart?'}
                        </p>
                        <p className="text-xs text-body mt-0.5">
                          {chartConnected
                            ? 'Prelude has your meds, allergies and history — it won’t re-ask.'
                            : 'Import your record so Prelude already knows your meds and allergies.'}
                        </p>
                      </div>
                      {chartConnected && <Icon name="check_circle" className="text-[22px] text-positive shrink-0" />}
                      <ConnectHealthRecordsButton patientName={name.trim() || undefined} />
                    </div>
                  </div>

                  <Btn onClick={() => goToStep('consent')} disabled={!name.trim() || (isCustomAppointment && !appointmentType.trim())}
                    className="mt-6 w-full px-6 py-4 flex items-center justify-center gap-2.5 text-[13px]">
                    Continue<Icon name="arrow_forward" className="text-[20px]" />
                  </Btn>
                </div>
              )}

              {step === 'consent' && (
                <div className="border border-line bg-panel p-6 sm:p-8">
                  <div className="flex items-center gap-2.5">
                    <Icon name="verified_user" className="text-[20px] text-danger" />
                    <span className="text-[10px] font-bold uppercase tracking-[.22em] text-danger">Step 2 · consent</span>
                  </div>
                  <h1 className="mt-4 text-3xl font-extrabold text-ink tracking-tight">Before we begin</h1>
                  <p className="mt-2 text-sm text-body">Please read and accept to continue.</p>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
                    {[
                      { icon: 'description', color: 'text-positive', label: 'What this is', text: 'An AI voice assistant that collects check-in information and charts it for your licensed provider.' },
                      { icon: 'block', color: 'text-danger', label: 'What this is not', text: 'Not medical advice, diagnosis, treatment, or crisis support.' },
                      { icon: 'lock', color: 'text-brand', label: 'Your responses', text: 'Transcribed, summarized, and stored in your clinic record (FHIR) for your provider to review before your visit.' },
                      { icon: 'emergency', color: 'text-danger', label: 'Emergency', text: 'If you are in immediate danger, call 911 (or 988 for mental health crisis) now.' },
                    ].map(({ icon, color, label, text }) => (
                      <div key={label} className="bg-panel p-4.5 flex flex-col gap-2 transition-all duration-200 hover:bg-bright hover:-translate-y-0.5">
                        <Icon name={icon} className={`text-[25px] ${color}`} />
                        <p className="text-[12.5px] font-bold text-ink">{label}</p>
                        <p className="text-[12.5px] leading-relaxed text-body">{text}</p>
                      </div>
                    ))}
                  </div>

                  <label className="mt-5 flex items-start gap-3 bg-bright border border-line px-4 py-3.5 cursor-pointer transition-colors duration-200 hover:border-ink">
                    <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-0.5 accent-brand w-4 h-4" />
                    <span className="text-sm text-ink leading-relaxed">
                      I understand this is an AI check-in assistant, not a clinician. I consent to my responses being charted for my provider&apos;s review.
                    </span>
                  </label>

                  <div className="mt-5 flex gap-2.5">
                    <Btn variant="secondary" onClick={() => window.history.back()} className="px-6 py-3.5 flex items-center gap-2 text-xs">
                      <Icon name="west" className="text-[17px]" />Back
                    </Btn>
                    <Btn onClick={beginCheckIn} disabled={!consented || loading}
                      className="flex-1 px-6 py-3.5 flex items-center justify-center gap-2.5 text-[12.5px]">
                      <Icon name="mic" className="text-[18px]" />
                      {loading ? 'Starting…' : 'Start Voice Check-in'}
                    </Btn>
                  </div>
                </div>
              )}

              {step === 'calling' && (
                <div className="border border-line bg-panel">
                  <div className="p-6 sm:p-8 pb-5 sm:pb-5 border-b border-line">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h1 className="text-2xl font-extrabold text-ink tracking-tight">
                        {demoMode ? 'Demo Mode' : voiceState === 'ended' ? 'Check-in Complete' : voiceState === 'connecting' ? 'Connecting…' : 'Speak naturally'}
                      </h1>
                      {!demoMode && (
                        <span className="flex items-center gap-2 text-[9.5px] font-semibold uppercase tracking-[.2em] text-faint">
                          <Icon name="graphic_eq" className="text-[16px] text-positive" />
                          {provider === 'grok' ? 'Grok Voice (fallback)' : 'Deepgram Voice Agent'}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-body">
                      {demoMode ? 'No voice keys configured — use the demo transcript to see the full pipeline.'
                        : 'Speak naturally. Ask what your visit will cost — Prelude checks your coverage live.'}
                    </p>
                  </div>

                  <div className="p-6 sm:p-8 space-y-5">
                    {error && (
                      <div className="flex items-center gap-3.5 bg-danger/10 border-l-4 border-danger px-4 py-3 text-sm text-danger">
                        <Icon name="warning" className="text-[20px] shrink-0" />{error}
                      </div>
                    )}

                    {demoMode ? (
                      <div className="space-y-4">
                        <div className="border border-line bg-bright">
                          <div className="flex items-center gap-2.5 px-5 pt-4">
                            <Icon name="smart_toy" className="text-[18px] text-brand" />
                            <span className="text-[9.5px] font-bold uppercase tracking-[.2em] text-faint">Demo transcript preview</span>
                          </div>
                          <p className="px-5 py-4 text-sm text-body leading-relaxed line-clamp-4 whitespace-pre-line">{DEMO_TRANSCRIPT}</p>
                        </div>
                        <Btn onClick={() => finishCall(DEMO_TRANSCRIPT)} disabled={finishing}
                          className="w-full px-6 py-4 flex items-center justify-center gap-2.5 text-[13px]">
                          <Icon name="hub" className={`text-[18px] ${finishing ? 'animate-pulse' : ''}`} />
                          {finishing ? 'Charting to Medplum…' : 'Use Demo Transcript + Chart Visit'}
                        </Btn>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <VoiceStage state={voiceState} />

                        {(voiceState === 'active' || voiceState === 'agent_speaking') && (
                          <div className="flex items-end justify-center gap-1.5 h-7" aria-hidden>
                            {['bg-ink', 'bg-ink', 'bg-caution', 'bg-danger', 'bg-caution', 'bg-ink', 'bg-ink'].map((c, i) => (
                              <span key={i} className={`w-[7px] h-full ${c} ${voiceState === 'agent_speaking' ? 'voice-bar-active' : 'voice-bar'}`} />
                            ))}
                          </div>
                        )}

                        {coverage && (
                          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}
                            className="bg-brand p-5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[.2em] text-bright/85">
                                <Icon name="shield" className="text-[17px]" />Live coverage check
                              </span>
                              <span className="text-[8.5px] font-semibold uppercase tracking-[.14em] text-bright/60 border border-bright/30 px-2 py-1">
                                {coverage.source === 'stedi' ? 'Stedi test mode' : 'synthetic data'}
                              </span>
                            </div>
                            <p className="mt-3.5 text-[26px] font-extrabold leading-tight tracking-tight text-bright">{coverage.payer}</p>
                            <p className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-bright/90">
                              <Icon name="verified" className="text-[16px]" />{coverage.plan_status}
                            </p>
                            <div className="mt-4 grid grid-cols-2 gap-px bg-bright/20">
                              {coverage.copay != null ? (
                                <div className="bg-brand p-3">
                                  <span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[.16em] text-bright/60">
                                    <Icon name="payments" className="text-[14px]" />Copay
                                  </span>
                                  <p className="mt-1.5 font-numeral text-3xl text-bright">${coverage.copay}</p>
                                </div>
                              ) : (
                                <div className="bg-brand p-3">
                                  <span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[.16em] text-bright/60">
                                    <Icon name="videocam" className="text-[14px]" />Visit est.
                                  </span>
                                  <p className="mt-1.5 font-numeral text-3xl text-bright">${coverage.estimated_visit_cost.min}–{coverage.estimated_visit_cost.max}</p>
                                </div>
                              )}
                              {coverage.deductible_remaining != null && (
                                <div className="bg-brand p-3">
                                  <span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[.16em] text-bright/60">
                                    <Icon name="savings" className="text-[14px]" />Deduct. left
                                  </span>
                                  <p className="mt-1.5 font-numeral text-3xl text-bright">${coverage.deductible_remaining}</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}

                        {transcript.length > 0 && (
                          <div className="border border-line bg-bright px-5 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[.18em] text-body">
                                <Icon name="record_voice_over" className="text-[17px]" />Live transcript
                              </span>
                              <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.16em] text-brand">
                                <Icon name="hub" className="text-[15px] animate-pulse" />Charting to FHIR
                              </span>
                            </div>
                            <div ref={transcriptRef} className="mt-2.5 max-h-52 overflow-y-auto">
                              {transcript.map((u, i) => (
                                <div key={i} className="grid grid-cols-[24px_1fr] gap-3 py-2.5 border-t border-line/60 first:border-t-0">
                                  <Icon name={u.role === 'agent' ? 'smart_toy' : 'person'}
                                    className={`text-[18px] mt-0.5 ${u.role === 'agent' ? 'text-brand' : 'text-danger'}`} />
                                  <p className={`text-[13.5px] leading-relaxed ${u.role === 'agent' ? 'text-body' : 'text-ink'}`}>{u.content}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(voiceState === 'active' || voiceState === 'agent_speaking') && (
                          <Btn variant="dangerSoft" onClick={() => finishCall()} disabled={finishing}
                            className="w-full px-6 py-3.5 flex items-center justify-center gap-2.5 text-xs">
                            <Icon name="stop_circle" className="text-[18px]" />
                            {finishing ? 'Charting to Medplum…' : 'End Check-in'}
                          </Btn>
                        )}
                        {(voiceState === 'ended' || voiceState === 'error') && !finishing && (
                          <Btn onClick={() => finishCall()}
                            className="w-full px-6 py-4 flex items-center justify-center gap-2.5 text-[13px]">
                            Generate Visit Note<Icon name="arrow_forward" className="text-[18px]" />
                          </Btn>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 'complete' && <CoverageBot />}
              {step === 'complete' && (
                <div className="border border-line bg-panel p-6 sm:p-8">
                  <div className="flex items-center gap-2.5">
                    <Icon name="task_alt" className="text-[20px] text-positive" />
                    <span className="text-[10px] font-bold uppercase tracking-[.22em] text-positive">Step 4 · done</span>
                  </div>

                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="mt-6 w-24 h-24 flex items-center justify-center text-bright [background:linear-gradient(135deg,var(--color-positive),var(--color-ink))]">
                    <Icon name="check" className="text-[52px]" />
                  </motion.div>

                  <h1 className="mt-5 text-[34px] font-extrabold leading-none tracking-tight text-ink">You&apos;re checked in</h1>
                  <p className="mt-3 max-w-sm text-sm text-body leading-relaxed">
                    Your conversation was charted as FHIR resources in Medplum. Your provider will review the AI draft note before your visit.
                  </p>

                  <div className="mt-5 flex flex-col gap-px bg-line border border-line">
                    {[
                      { icon: 'person', color: 'text-brand', label: 'Patient · Encounter created' },
                      { icon: 'article', color: 'text-brand', label: 'DocumentReference · transcript' },
                      { icon: 'note_alt', color: 'text-caution', label: 'Composition · SOAP draft' },
                      ...(coverage?.copay != null
                        ? [{ icon: 'payments', color: 'text-positive', label: `Copay $${coverage.copay} · confirmed` }]
                        : []),
                    ].map(({ icon, color, label }) => (
                      <div key={label} className="bg-bright px-4 py-3 flex items-center gap-3">
                        <Icon name={icon} className={`text-[19px] ${color}`} />
                        <span className="text-xs font-semibold text-ink">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 space-y-2.5">
                    {noteId && (
                      <Link href={`/dashboard/${noteId}`}
                        className="flex items-center justify-center gap-2.5 bg-ink text-bright font-bold text-xs tracking-[.06em] px-6 py-4 transition-all duration-200 hover:[background:var(--grad-hover)] hover:tracking-[.1em]">
                        <Icon name="description" className="text-[18px]" />
                        View the provider&apos;s draft note
                      </Link>
                    )}
                    <Link href="/dashboard"
                      className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-brand transition-colors hover:text-brand-dark">
                      Provider dashboard<Icon name="arrow_forward" className="text-[16px]" />
                    </Link>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
