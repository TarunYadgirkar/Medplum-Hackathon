import Link from 'next/link';
import { Nav } from '@/components/primitives';

export default function Home() {
  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <Nav
        homeLink={false}
        right={<span className="text-xs text-faint font-medium hidden sm:block">YC × Medplum Agentic Healthcare Hackathon 2026</span>}
      />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand mb-4">Voice-first pre-visit intake</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-ink leading-tight tracking-tight">
            The visit starts before<br />the doctor walks in.
          </h1>
          <p className="mt-5 text-body leading-relaxed max-w-xl mx-auto">
            Check in by talking. Prelude charts your conversation into your clinic&apos;s FHIR record as it happens,
            pulls your history mid-sentence, and tells you what the visit will cost — before you ever see a doctor.
          </p>

          <div className="mt-10 grid sm:grid-cols-2 gap-4 text-left">
            <Link href="/intake" className="group bg-white border border-line hover:border-brand rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-xl mb-4">🎙️</div>
              <h2 className="font-bold text-ink">I&apos;m a patient</h2>
              <p className="text-sm text-body mt-1">Do your 3-minute voice check-in. Ask what it&apos;ll cost.</p>
              <p className="text-sm font-semibold text-brand mt-3 group-hover:translate-x-1 transition-transform">Start check-in →</p>
            </Link>
            <Link href="/dashboard" className="group bg-white border border-line hover:border-brand rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-xl mb-4">🩺</div>
              <h2 className="font-bold text-ink">I&apos;m a provider</h2>
              <p className="text-sm text-body mt-1">Review AI-drafted SOAP notes, risk flags, and the patient queue.</p>
              <p className="text-sm font-semibold text-brand mt-3 group-hover:translate-x-1 transition-transform">Open dashboard →</p>
            </Link>
          </div>

          <div className="mt-12 text-xs text-faint">
            <p className="font-semibold uppercase tracking-widest mb-2">Powered by</p>
            <p>
              <span className="font-semibold text-body">Medplum</span> FHIR record ·{' '}
              <span className="font-semibold text-body">Deepgram</span> voice agent (nova-3-medical + Aura-2) ·{' '}
              <span className="font-semibold text-body">Stedi</span> live eligibility ·{' '}
              <span className="font-semibold text-body">Moss</span> sub-10ms history retrieval
            </p>
          </div>

          <p className="mt-8 text-[11px] text-faint max-w-md mx-auto">
            Prelude is an intake tool, not a clinician. It never diagnoses or treats. Hackathon demo — synthetic data only.
          </p>
        </div>
      </main>
    </div>
  );
}
