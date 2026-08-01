'use client';
// Patient voice check-in — UI structure carried over from klarity-voicenote's
// intake flow, voice engine swapped from Retell to the Deepgram Voice Agent.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { useGrokVoice } from '@/hooks/useGrokVoice';
import { Nav, Btn } from '@/components/primitives';
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
const STEPS = ['Form', 'Consent', 'Check-in', 'Done'];
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

function Visualizer({ state }: { state: string }) {
  const barHeights = ['h-5', 'h-9', 'h-14', 'h-20', 'h-14', 'h-9', 'h-5'];
  if (state === 'ended') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-body text-sm">Charting your visit…</p>
      </div>
    );
  }
  if (state === 'connecting') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse w-16 h-16 bg-brand/15 rounded-full flex items-center justify-center">
          <div className="w-8 h-8 bg-brand/30 rounded-full" />
        </div>
        <p className="text-body text-sm">Connecting — allow microphone access…</p>
      </div>
    );
  }
  const isAgent = state === 'agent_speaking';
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-end gap-[6px] h-20 px-2">
        {barHeights.map((h, i) => (
          <div key={i} className={`w-[6px] rounded-full ${isAgent ? 'bg-brand-accent animate-pulse' : 'bg-brand'} ${h} transition-colors duration-500`} />
        ))}
      </div>
      <p className="text-body text-sm">{isAgent ? 'Prelude is speaking…' : 'Listening — speak when ready'}</p>
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
  }, [session, stop, name, payerKey]);

  const stepIdx = STEP_INDEX[step];

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <Nav right={<span className="text-sm text-body font-medium">Voice Check-in</span>} />

      {/* Progress */}
      <div className="bg-white border-b border-line px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  i < stepIdx ? 'bg-brand text-white' : i === stepIdx ? 'bg-brand text-white ring-4 ring-brand/20' : 'bg-line text-faint'
                }`}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <span className={`text-[11px] font-medium mt-1 ${i === stepIdx ? 'text-brand' : 'text-faint'}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-[2px] mx-2 mb-4 rounded transition-colors duration-500 ${i < stepIdx ? 'bg-brand' : 'bg-line'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...fadeUp} className="w-full max-w-lg">

            {step === 'form' && (
              <div className="bg-white rounded-3xl shadow-sm border border-line overflow-hidden">
                <div className="bg-gradient-to-br from-brand/5 to-brand-accent/5 px-8 pt-8 pb-6 border-b border-line">
                  <h1 className="text-2xl font-bold text-ink">Check in before your visit</h1>
                  <p className="mt-1.5 text-body text-sm leading-relaxed">
                    Talk to Prelude for ~3 minutes. Your conversation is charted for your doctor as it happens — and you can ask what your visit will cost.
                  </p>
                </div>
                <div className="px-8 py-6 space-y-5">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 flex gap-3">
                    <span className="shrink-0 text-amber-500 text-base mt-0.5">⚠</span>
                    <p><strong className="text-amber-900">Not a doctor.</strong> Prelude collects information only — no diagnosis, no treatment. In an emergency call <strong>911</strong> (or <strong>988</strong> for mental health crisis).</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-1.5">Your name</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name as it appears in your records"
                        className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink placeholder-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 focus:bg-white transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-1.5">Appointment type</label>
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
                        className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 focus:bg-white transition-all">
                        <option>Sick visit</option>
                        <option>New patient visit</option>
                        <option>Annual physical</option>
                        <option>Follow-up</option>
                        <option>Telehealth consult</option>
                        <option value={OTHER_APPOINTMENT}>Other — describe it…</option>
                      </select>
                      {isCustomAppointment && (
                        <input type="text" value={appointmentType} autoFocus
                          onChange={(e) => setAppointmentType(e.target.value)}
                          placeholder="e.g. knee pain consult, medication review…"
                          maxLength={100}
                          className="mt-2 w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink placeholder-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 focus:bg-white transition-all" />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-1.5">Insurance</label>
                      <select value={payerKey} onChange={(e) => setPayerKey(e.target.value)}
                        className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 focus:bg-white transition-all">
                        <option value="UHC">UnitedHealthcare</option>
                        <option value="CIGNA">Cigna</option>
                        <option value="AETNA">Aetna</option>
                        <option value="CMS">Medicare</option>
                        <option value="NONE">Self-pay / not sure</option>
                      </select>
                      <p className="mt-1 text-xs text-faint">Used when you ask Prelude what your visit will cost.</p>
                    </div>
                    <div>
                      <label htmlFor="urgency-slider" className="block text-sm font-semibold text-ink mb-1.5">
                        Urgency <span className="text-faint font-normal">· call length: {CALL_LENGTHS[callLengthIdx].label}</span>
                      </label>
                      <input id="urgency-slider" type="range" min={0} max={3} step={1} value={callLengthIdx}
                        onChange={(e) => setCallLengthIdx(Number(e.target.value))}
                        className="w-full accent-brand" />
                      <div className="flex justify-between text-[11px] text-faint mt-1">
                        {CALL_LENGTHS.map((c, i) => (
                          <button key={c.seconds} type="button" onClick={() => setCallLengthIdx(i)}
                            className={`transition-colors ${i === callLengthIdx ? 'text-brand font-semibold' : 'hover:text-body'}`}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-1.5">Age range <span className="text-faint font-normal">(optional)</span></label>
                      <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)}
                        className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 focus:bg-white transition-all">
                        <option value="">Prefer not to say</option>
                        <option>18–24</option><option>25–34</option><option>35–44</option><option>45–54</option><option>55+</option>
                      </select>
                    </div>
                  </div>
                  <div className={`rounded-2xl border p-4 flex items-center justify-between gap-3 transition-colors ${chartConnected ? 'bg-brand/5 border-brand/30' : 'bg-surface border-line'}`}>
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {chartConnected ? `Health records connected · ${getEpicImport()?.systemName ?? ''}` : 'Use MyChart?'}
                      </p>
                      <p className="text-xs text-body mt-0.5">
                        {chartConnected
                          ? 'Prelude has your meds, allergies and history — it won’t re-ask.'
                          : 'Import your record so Prelude already knows your meds and allergies.'}
                      </p>
                    </div>
                    <ConnectHealthRecordsButton patientName={name.trim() || undefined} />
                  </div>
                  <Btn onClick={() => goToStep('consent')} disabled={!name.trim() || (isCustomAppointment && !appointmentType.trim())} className="w-full px-6 py-3.5">
                    Continue →
                  </Btn>
                </div>
              </div>
            )}

            {step === 'consent' && (
              <div className="bg-white rounded-3xl shadow-sm border border-line overflow-hidden">
                <div className="bg-gradient-to-br from-blue-50 to-brand/5 px-8 pt-8 pb-6 border-b border-line">
                  <h1 className="text-2xl font-bold text-ink">Before we begin</h1>
                  <p className="mt-1.5 text-body text-sm">Please read and accept to continue.</p>
                </div>
                <div className="px-8 py-6 space-y-5">
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-3 text-sm text-ink leading-relaxed">
                    {[
                      { label: 'What this is', text: 'An AI voice assistant that collects check-in information and charts it for your licensed provider.' },
                      { label: 'What this is not', text: 'Not medical advice, diagnosis, treatment, or crisis support.' },
                      { label: 'Your responses', text: 'Transcribed, summarized, and stored in your clinic record (FHIR) for your provider to review before your visit.' },
                      { label: 'Emergency', text: 'If you are in immediate danger, call 911 (or 988 for mental health crisis) now.' },
                    ].map(({ label, text }) => (
                      <div key={label} className="flex gap-2">
                        <span className="shrink-0 text-brand font-bold mt-0.5">·</span>
                        <p><strong className="text-ink">{label}:</strong> {text}</p>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-1 accent-brand w-4 h-4" />
                    <span className="text-sm text-ink leading-relaxed">
                      I understand this is an AI check-in assistant, not a clinician. I consent to my responses being charted for my provider&apos;s review.
                    </span>
                  </label>
                  <div className="flex gap-3 pt-1">
                    <Btn variant="secondary" onClick={() => window.history.back()} className="flex-1 px-6 py-3.5">Back</Btn>
                    <button onClick={beginCheckIn} disabled={!consented || loading}
                      className="flex-1 bg-brand hover:bg-brand-dark disabled:bg-line disabled:text-faint text-white font-semibold rounded-xl px-6 py-3.5 transition-all duration-200 shadow-sm disabled:shadow-none">
                      {loading ? 'Starting…' : 'Start Voice Check-in'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 'calling' && (
              <div className="bg-white rounded-3xl shadow-sm border border-line overflow-hidden">
                <div className="px-8 pt-8 pb-6 border-b border-line bg-gradient-to-br from-brand/8 to-brand-accent/5">
                  <h1 className="text-2xl font-bold text-ink">
                    {demoMode ? 'Demo Mode' : voiceState === 'ended' ? 'Check-in Complete' : voiceState === 'connecting' ? 'Connecting…' : 'Voice Check-in Active'}
                  </h1>
                  <p className="mt-1.5 text-body text-sm">
                    {demoMode ? 'No voice keys configured — use the demo transcript to see the full pipeline.'
                      : 'Speak naturally. Ask what your visit will cost — Prelude checks your coverage live.'}
                  </p>
                  {!demoMode && (
                    <p className="mt-2 text-[10px] uppercase tracking-widest text-faint">
                      Voice engine · {provider === 'grok' ? 'Grok Voice (fallback)' : 'Deepgram Voice Agent'}
                    </p>
                  )}
                </div>
                <div className="px-8 py-8 space-y-6">
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 flex gap-3"><span>⚠</span>{error}</div>
                  )}

                  {demoMode ? (
                    <div className="space-y-4">
                      <div className="bg-surface border border-line rounded-2xl p-5">
                        <p className="text-xs font-semibold text-body uppercase tracking-wider mb-3">Demo transcript preview</p>
                        <p className="text-sm text-body leading-relaxed line-clamp-4">{DEMO_TRANSCRIPT}</p>
                      </div>
                      <button onClick={() => finishCall(DEMO_TRANSCRIPT)} disabled={finishing}
                        className="w-full bg-brand hover:bg-brand-dark disabled:bg-line text-white font-semibold rounded-xl px-6 py-3.5 transition-all">
                        {finishing ? 'Charting to Medplum…' : 'Use Demo Transcript + Chart Visit'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="rounded-2xl p-10 text-center bg-surface border border-line">
                        <Visualizer state={voiceState} />
                      </div>

                      {coverage && (
                        <div className="bg-brand/5 border border-brand/30 rounded-2xl p-5">
                          <p className="text-xs font-semibold text-brand-dark uppercase tracking-widest mb-2">
                            Live coverage check · {coverage.source === 'stedi' ? 'Stedi test mode' : 'synthetic data'}
                          </p>
                          <p className="text-sm text-ink font-semibold">{coverage.payer} — {coverage.plan_status}</p>
                          <p className="text-sm text-body mt-1">
                            {coverage.copay != null ? `Copay ~$${coverage.copay}` : `Est. $${coverage.estimated_visit_cost.min}–$${coverage.estimated_visit_cost.max}`}
                            {coverage.deductible_remaining != null ? ` · Deductible remaining $${coverage.deductible_remaining}` : ''}
                          </p>
                        </div>
                      )}

                      {transcript.length > 0 && (
                        <div className="bg-surface border border-line rounded-2xl p-5 space-y-3 max-h-52 overflow-y-auto">
                          <p className="text-xs font-semibold text-body uppercase tracking-widest">Live transcript · charting as you speak</p>
                          {transcript.map((u, i) => (
                            <div key={i} className={`flex gap-2 text-sm ${u.role === 'agent' ? 'text-brand-dark' : 'text-ink'}`}>
                              <span className="font-bold text-xs uppercase opacity-50 shrink-0 mt-0.5 w-14">{u.role === 'agent' ? 'Prelude' : 'You'}</span>
                              <span className="leading-relaxed">{u.content}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(voiceState === 'active' || voiceState === 'agent_speaking') && (
                        <Btn variant="dangerSoft" onClick={() => finishCall()} disabled={finishing} className="w-full px-6 py-3.5">
                          {finishing ? 'Charting to Medplum…' : 'End Check-in'}
                        </Btn>
                      )}
                      {(voiceState === 'ended' || voiceState === 'error') && !finishing && (
                        <button onClick={() => finishCall()}
                          className="w-full bg-brand hover:bg-brand-dark text-white font-semibold rounded-xl px-6 py-3.5 transition-all shadow-sm">
                          Generate Visit Note →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'complete' && (
              <div className="bg-white rounded-3xl shadow-sm border border-line overflow-hidden">
                <div className="bg-gradient-to-br from-brand/8 to-brand-accent/5 px-8 pt-10 pb-8 text-center">
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="w-20 h-20 bg-brand rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand/30">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                  <h1 className="text-2xl font-bold text-ink">You&apos;re checked in</h1>
                  <p className="mt-3 text-body leading-relaxed text-sm max-w-sm mx-auto">
                    Your conversation was charted as FHIR resources in Medplum. Your provider will review the AI draft note before your visit.
                  </p>
                </div>
                <div className="px-8 py-6 space-y-3">
                  {noteId && (
                    <Link href={`/dashboard/${noteId}`}
                      className="block text-center bg-brand hover:bg-brand-dark text-white font-semibold rounded-xl px-6 py-3.5 transition-all shadow-sm">
                      View the provider&apos;s draft note →
                    </Link>
                  )}
                  <Link href="/dashboard" className="block text-center text-sm text-brand hover:text-brand-dark transition-colors font-medium py-2">
                    Provider dashboard →
                  </Link>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
