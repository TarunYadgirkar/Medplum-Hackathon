'use client';

import { useCallback, useRef, useState } from 'react';
import { Btn, SectionCard } from '@/components/primitives';
import { clearMedCard, getMedCard, saveMedCard, sanitizeField, type MedCardData } from '@/lib/medcard';

type ScanState = 'idle' | 'loading' | 'result' | 'autosaved' | 'unavailable' | 'error';

type ScanResult = {
  medicationName: string;
  dosage: string;
  frequency: string;
  confidence: 'low' | 'medium' | 'high';
};

type ConfirmFields = {
  medicationName: string;
  dosage: string;
  frequency: string;
};

const CONFIDENCE_META: Record<ScanResult['confidence'], { cls: string; icon: string; label: string }> = {
  low: { cls: 'bg-red-50 text-red-600 border border-red-200', icon: '⚠', label: 'Low confidence — please review carefully' },
  medium: { cls: 'bg-amber-50 text-amber-600 border border-amber-200', icon: '▲', label: 'Medium confidence — verify before saving' },
  high: { cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200', icon: '✓', label: 'High confidence' },
};

const INPUT_CLASS =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-surface border border-line text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-light transition-colors';

function formatMed(name: string, dosage: string, frequency: string): string {
  const cleanName = sanitizeField(name);
  const cleanDosage = sanitizeField(dosage);
  const cleanFrequency = sanitizeField(frequency);
  const parts = [cleanName, cleanDosage].filter(Boolean).join(' ');
  return cleanFrequency ? `${parts} — ${cleanFrequency}` : parts;
}

export function PillBottleScanner({ onSaved }: { onSaved?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [confirm, setConfirm] = useState<ConfirmFields>({ medicationName: '', dosage: '', frequency: '' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [autoSavedLabel, setAutoSavedLabel] = useState('');
  const prevCardRef = useRef<MedCardData | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanState('loading');
    setScanResult(null);
    setErrorMsg(null);
    setSaved(false);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);

      try {
        const res = await fetch('/api/scan-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        });

        const data: {
          available?: boolean;
          medicationName?: string;
          dosage?: string;
          frequency?: string;
          confidence?: string;
          error?: string;
        } = await res.json();

        if (res.ok && data.available === false) {
          setScanState('unavailable');
          return;
        }
        if (!res.ok || data.error) {
          throw new Error(data.error ?? `Server error ${res.status}`);
        }

        const result: ScanResult = {
          medicationName: data.medicationName ?? '',
          dosage: data.dosage ?? '',
          frequency: data.frequency ?? '',
          confidence: (data.confidence as ScanResult['confidence']) ?? 'low',
        };

        setScanResult(result);
        setConfirm({
          medicationName: result.medicationName,
          dosage: result.dosage,
          frequency: result.frequency,
        });

        if (result.confidence === 'high' && result.medicationName.trim()) {
          const formatted = formatMed(result.medicationName, result.dosage, result.frequency);
          prevCardRef.current = getMedCard();
          saveMedCard({ medications: [formatted], allergies: [], conditions: [] });
          setAutoSavedLabel(formatted);
          setScanState('autosaved');
          onSaved?.();
          return;
        }

        setScanState('result');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Scan failed — please try again.');
        setScanState('error');
      }
    };

    reader.onerror = () => {
      setErrorMsg('Could not read the image file.');
      setScanState('error');
    };

    reader.readAsDataURL(file);
  }, [onSaved]);

  const handleConfirmChange = useCallback(
    (field: keyof ConfirmFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirm((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  const handleAddToMedCard = useCallback(() => {
    if (!confirm.medicationName.trim()) return;

    saveMedCard({
      medications: [formatMed(confirm.medicationName, confirm.dosage, confirm.frequency)],
      allergies: [],
      conditions: [],
    });

    setSaved(true);
    onSaved?.();
  }, [confirm, onSaved]);

  const handleUndoAutoSave = useCallback(() => {
    const prev = prevCardRef.current;
    clearMedCard();
    if (prev) {
      saveMedCard({
        medications: prev.medications,
        allergies: prev.allergies,
        conditions: prev.conditions,
      });
    }
    prevCardRef.current = null;
    setAutoSavedLabel('');
    setScanState('result');
    onSaved?.();
  }, [onSaved]);

  const handleReset = useCallback(() => {
    setScanState('idle');
    setPreview(null);
    setScanResult(null);
    setConfirm({ medicationName: '', dosage: '', frequency: '' });
    setErrorMsg(null);
    setSaved(false);
    setAutoSavedLabel('');
    prevCardRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return (
    <SectionCard title="Scan a pill bottle">
      <p className="text-sm text-body leading-relaxed">
        Upload a photo of a pill bottle label. Prelude reads the medication name, dosage, and
        instructions so you can confirm and save them to your MedCard.
      </p>

      {scanState === 'idle' && (
        <div className="flex flex-col items-center gap-3">
          <label
            htmlFor="pill-bottle-input"
            className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line px-8 py-10 transition-colors hover:border-brand hover:bg-brand-light"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-6 w-6 text-brand"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <div className="text-center">
              <p className="text-sm font-semibold text-ink">Take photo or choose image</p>
              <p className="mt-0.5 text-xs text-faint">Camera opens on mobile · JPEG, PNG, HEIC supported</p>
            </div>
          </label>
          <input
            ref={inputRef}
            id="pill-bottle-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="sr-only"
          />
        </div>
      )}

      {scanState === 'loading' && (
        <div className="flex flex-col items-center gap-5 py-6">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Pill bottle being scanned"
              className="h-32 w-32 rounded-xl object-cover border border-line shadow-sm"
            />
          )}
          <div className="flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand"
            />
            <p className="text-sm font-medium text-body">Reading label…</p>
            <p className="text-xs text-faint">This usually takes a few seconds</p>
          </div>
        </div>
      )}

      {scanState === 'unavailable' && (
        <div className="flex flex-col gap-3">
          <div role="status" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm font-semibold text-amber-700">Scanner needs an OpenAI key</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-600">
              Label scanning uses OpenAI vision, which isn&apos;t configured on this server yet.
              You can still add medications via Epic import or during your voice check-in.
            </p>
          </div>
          <Btn variant="secondary" className="self-start px-5 py-2.5 text-sm" onClick={handleReset}>
            Back
          </Btn>
        </div>
      )}

      {scanState === 'autosaved' && (
        <div className="flex flex-col gap-3">
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3"
          >
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Scanned pill bottle"
                className="h-12 w-12 shrink-0 rounded-lg object-cover border border-emerald-200"
              />
            )}
            <div className="flex flex-col gap-0.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Added to your MedCard
              </p>
              <p className="text-xs text-emerald-600">{autoSavedLabel}</p>
              <p className="mt-0.5 text-xs text-emerald-600/80">
                Saved automatically — the label was read with high confidence.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={handleUndoAutoSave}>
              Undo &amp; edit
            </Btn>
            <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={handleReset}>
              Scan another bottle
            </Btn>
          </div>
        </div>
      )}

      {scanState === 'result' && scanResult && (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Scanned pill bottle"
                className="h-20 w-20 shrink-0 rounded-xl object-cover border border-line shadow-sm"
              />
            )}
            <div className="flex flex-col gap-2">
              <span
                className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold ${CONFIDENCE_META[scanResult.confidence].cls}`}
                aria-label={CONFIDENCE_META[scanResult.confidence].label}
              >
                <span aria-hidden="true">{CONFIDENCE_META[scanResult.confidence].icon}</span>
                {CONFIDENCE_META[scanResult.confidence].label}
              </span>
              <p className="text-xs leading-relaxed text-body">
                Review and correct any errors before saving — vision models aren&apos;t perfect on small print.
              </p>
            </div>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-xs font-bold uppercase tracking-widest text-faint">
              Confirm extracted details
            </legend>
            {(
              [
                { field: 'medicationName', label: 'Medication name', placeholder: 'e.g. Lisinopril' },
                { field: 'dosage', label: 'Dosage', placeholder: 'e.g. 10mg' },
                { field: 'frequency', label: 'Frequency / instructions', placeholder: 'e.g. once daily' },
              ] as const
            ).map(({ field, label, placeholder }) => (
              <label key={field} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-body">{label}</span>
                <input
                  type="text"
                  value={confirm[field]}
                  onChange={handleConfirmChange(field)}
                  placeholder={placeholder}
                  className={INPUT_CLASS}
                />
              </label>
            ))}
          </fieldset>

          {saved ? (
            <div className="flex flex-col gap-3">
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Added to your MedCard
              </div>
              <Btn variant="secondary" className="self-start px-5 py-2.5 text-sm" onClick={handleReset}>
                Scan another bottle
              </Btn>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Btn
                className="px-6 py-2.5 text-sm"
                onClick={handleAddToMedCard}
                disabled={!confirm.medicationName.trim()}
              >
                Add to MedCard
              </Btn>
              <Btn variant="secondary" className="px-5 py-2.5 text-sm" onClick={handleReset}>
                Cancel
              </Btn>
            </div>
          )}
        </div>
      )}

      {scanState === 'error' && (
        <div className="flex flex-col gap-3">
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
          >
            {errorMsg ?? 'Scan failed — please try again.'}
          </div>
          <Btn variant="secondary" className="self-start px-5 py-2.5 text-sm" onClick={handleReset}>
            Try again
          </Btn>
        </div>
      )}

      <p className="text-xs leading-relaxed text-faint">
        <strong className="font-medium text-body">Privacy:</strong> Your photo is sent to OpenAI for
        one-time label extraction and is not stored — not on Prelude servers, not in your browser.
        Only the extracted text is saved locally.
      </p>
    </SectionCard>
  );
}
