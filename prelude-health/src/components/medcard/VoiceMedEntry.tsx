'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Btn, SectionCard } from '@/components/primitives';
import { saveMedCard, sanitizeField } from '@/lib/medcard';

type EntryState =
  | 'idle'
  | 'listening'
  | 'review'
  | 'extracting'
  | 'confirm'
  | 'unavailable'
  | 'error'
  | 'saved';

type ExtractedMed = {
  medicationName: string;
  dosage: string;
  frequency: string;
  confidence: 'low' | 'medium' | 'high';
};

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const INPUT_CLASS =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-surface border border-line text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-light transition-colors';

const MIC_ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was denied. Allow mic access in your browser settings, or type your medications below instead.',
  'service-not-allowed': 'Speech recognition is blocked in this browser. You can type your medications below instead.',
  'no-speech': "We didn't hear anything. Tap the mic and try again.",
  'audio-capture': 'No microphone was found. Check your device and try again.',
  network: 'Speech recognition needs a network connection. Check your connection and try again.',
};

export function VoiceMedEntry({ onSaved }: { onSaved?: () => void }) {
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<EntryState>('idle');
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [meds, setMeds] = useState<ExtractedMed[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef('');
  const stoppedByUserRef = useRef(false);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setSupported(false);
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    finalTranscriptRef.current = transcript ? `${transcript} ` : '';
    stoppedByUserRef.current = false;

    recognition.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += `${result[0].transcript} `;
        } else {
          interimText += result[0].transcript;
        }
      }
      setTranscript(finalTranscriptRef.current.trim());
      setInterim(interimText);
    };

    recognition.onerror = (e) => {
      recognitionRef.current = null;
      if (stoppedByUserRef.current || e.error === 'aborted') return;
      setErrorMsg(MIC_ERROR_MESSAGES[e.error] ?? 'Voice input failed — please try again.');
      setState('error');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setInterim('');
      setState((prev) => (prev === 'listening' ? 'review' : prev));
    };

    recognitionRef.current = recognition;
    setErrorMsg(null);
    setInterim('');
    setState('listening');
    recognition.start();
  }, [transcript]);

  const stopListening = useCallback(() => {
    stoppedByUserRef.current = true;
    recognitionRef.current?.stop();
    setState('review');
  }, []);

  const handleExtract = useCallback(async () => {
    const text = transcript.trim().slice(0, 2000);
    if (!text) return;

    setState('extracting');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/scan-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data: {
        available?: boolean;
        medications?: ExtractedMed[];
        error?: string;
      } = await res.json();

      if (res.ok && data.available === false) {
        setState('unavailable');
        return;
      }
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      const extracted = (data.medications ?? []).filter((m) => m.medicationName.trim());
      if (extracted.length === 0) {
        setErrorMsg("We couldn't find any medications in that description. Try naming them directly, e.g. \"I take lisinopril 10 milligrams once a day.\"");
        setState('review');
        return;
      }

      setMeds(extracted);
      setState('confirm');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Extraction failed — please try again.');
      setState('review');
    }
  }, [transcript]);

  const handleMedChange = useCallback(
    (index: number, field: 'medicationName' | 'dosage' | 'frequency') =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setMeds((prev) =>
          prev.map((m, i) => (i === index ? { ...m, [field]: e.target.value } : m))
        );
      },
    []
  );

  const handleRemoveMed = useCallback((index: number) => {
    setMeds((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    const formatted = meds
      .map((m) => {
        const name = sanitizeField(m.medicationName);
        if (!name) return '';
        const dosage = sanitizeField(m.dosage);
        const frequency = sanitizeField(m.frequency);
        const parts = [name, dosage].filter(Boolean).join(' ');
        return frequency ? `${parts} — ${frequency}` : parts;
      })
      .filter(Boolean);

    if (formatted.length === 0) return;

    saveMedCard({ medications: formatted, allergies: [], conditions: [] });
    setSavedCount(formatted.length);
    setState('saved');
    onSaved?.();
  }, [meds, onSaved]);

  const handleReset = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterim('');
    setMeds([]);
    setErrorMsg(null);
    setSavedCount(0);
    setState('idle');
  }, []);

  return (
    <SectionCard title="Describe by voice">
      <p className="text-sm text-body leading-relaxed">
        Just say what you take — &quot;I take lisinopril 10 milligrams every morning and metformin
        twice a day&quot; — and Prelude turns it into MedCard entries.
      </p>

      {!supported && (
        <div role="status" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm font-semibold text-amber-700">Voice input not supported in this browser</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-600">
            Try Chrome, or use the pill bottle scanner and manual entry below.
          </p>
        </div>
      )}

      {supported && state === 'idle' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            type="button"
            onClick={startListening}
            aria-label="Start describing your medications by voice"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-bright transition-all duration-200 hover:[background:var(--grad-hover)]"
          >
            <MicIcon className="h-7 w-7" />
          </button>
          <p className="text-xs text-faint">Tap to start speaking</p>
        </div>
      )}

      {state === 'listening' && (
        <div className="flex flex-col items-center gap-4 py-2">
          <button
            type="button"
            onClick={stopListening}
            aria-label="Stop listening"
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-danger text-bright"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-ping rounded-full bg-danger/40"
            />
            <span aria-hidden="true" className="relative h-5 w-5 bg-bright" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-danger" role="status">
            Listening — tap to stop
          </p>
          <div
            aria-live="polite"
            className="min-h-[3rem] w-full rounded-xl bg-surface border border-line px-4 py-3 text-sm leading-relaxed text-body"
          >
            {transcript || interim ? (
              <>
                {transcript && <span>{transcript} </span>}
                {interim && <span className="text-faint italic">{interim}</span>}
              </>
            ) : (
              <span className="text-faint italic">Say something like &quot;I take aspirin 81 milligrams daily&quot;…</span>
            )}
          </div>
        </div>
      )}

      {(state === 'review' || state === 'extracting') && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-body">Your description — edit if needed</span>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              maxLength={2000}
              disabled={state === 'extracting'}
              placeholder="I take lisinopril 10 milligrams once a day…"
              className={`${INPUT_CLASS} resize-y`}
            />
          </label>

          {errorMsg && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Btn
              className="px-6 py-2.5 text-sm"
              onClick={handleExtract}
              disabled={!transcript.trim() || state === 'extracting'}
            >
              {state === 'extracting' ? 'Extracting…' : 'Extract medications'}
            </Btn>
            <Btn
              variant="secondary"
              className="px-5 py-2.5 text-sm"
              onClick={startListening}
              disabled={state === 'extracting'}
            >
              Keep talking
            </Btn>
            <Btn
              variant="secondary"
              className="px-5 py-2.5 text-sm"
              onClick={handleReset}
              disabled={state === 'extracting'}
            >
              Start over
            </Btn>
          </div>
        </div>
      )}

      {state === 'confirm' && (
        <div className="flex flex-col gap-4">
          <p className="text-xs leading-relaxed text-body">
            Found {meds.length} medication{meds.length === 1 ? '' : 's'}. Review, correct, or remove
            before saving.
          </p>

          <div className="flex flex-col gap-4">
            {meds.map((med, i) => (
              <fieldset key={i} className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5">
                <div className="flex items-center justify-between">
                  <legend className="text-xs font-bold uppercase tracking-widest text-faint">
                    Medication {i + 1}
                  </legend>
                  <button
                    type="button"
                    onClick={() => handleRemoveMed(i)}
                    aria-label={`Remove ${med.medicationName || `medication ${i + 1}`}`}
                    className="text-xs text-faint hover:text-danger transition-colors"
                  >
                    Remove
                  </button>
                </div>
                {(
                  [
                    { field: 'medicationName', label: 'Name', placeholder: 'e.g. Lisinopril' },
                    { field: 'dosage', label: 'Dosage', placeholder: 'e.g. 10mg' },
                    { field: 'frequency', label: 'Frequency', placeholder: 'e.g. once daily' },
                  ] as const
                ).map(({ field, label, placeholder }) => (
                  <label key={field} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-body">{label}</span>
                    <input
                      type="text"
                      value={med[field]}
                      onChange={handleMedChange(i, field)}
                      placeholder={placeholder}
                      className={INPUT_CLASS}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Btn
              className="px-6 py-2.5 text-sm"
              onClick={handleSave}
              disabled={meds.every((m) => !m.medicationName.trim())}
            >
              Add {meds.filter((m) => m.medicationName.trim()).length} to MedCard
            </Btn>
            <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={() => setState('review')}>
              Back to transcript
            </Btn>
            <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={handleReset}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {state === 'unavailable' && (
        <div className="flex flex-col gap-3">
          <div role="status" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm font-semibold text-amber-700">Extraction needs an OpenAI key</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-600">
              Voice extraction uses OpenAI, which isn&apos;t configured on this server yet. You can
              still add medications manually below.
            </p>
          </div>
          <Btn variant="secondary" className="self-start px-5 py-2.5 text-sm" onClick={() => setState('review')}>
            Back
          </Btn>
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col gap-3">
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {errorMsg ?? 'Voice input failed — please try again.'}
          </div>
          <Btn variant="secondary" className="self-start px-5 py-2.5 text-sm" onClick={handleReset}>
            Try again
          </Btn>
        </div>
      )}

      {state === 'saved' && (
        <div className="flex flex-col gap-3">
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700"
          >
            <CheckIcon className="h-4 w-4 shrink-0" />
            Added {savedCount} medication{savedCount === 1 ? '' : 's'} to your MedCard
          </div>
          <Btn variant="secondary" className="self-start px-5 py-2.5 text-sm" onClick={handleReset}>
            Describe more
          </Btn>
        </div>
      )}

      <p className="text-xs leading-relaxed text-faint">
        <strong className="font-medium text-body">Privacy:</strong> Speech is transcribed by your
        browser. Only the text you approve is sent to OpenAI for one-time extraction — nothing is
        stored on Prelude servers.
      </p>
    </SectionCard>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
