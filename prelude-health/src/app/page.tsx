import Link from 'next/link';
import { Icon } from '@/components/primitives';
import CoverageBot from '@/components/coverage-bot/CoverageBot';

const PIPELINE = [
  { icon: 'mic', label: 'Talk', vendor: 'Deepgram' },
  { icon: 'hub', label: 'Charted', vendor: 'Medplum' },
  { icon: 'payments', label: 'Costed', vendor: 'Stedi' },
  { icon: 'history', label: 'Recalled', vendor: 'Moss' },
] as const;

export default function Home() {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-surface via-[#e6ddca] to-[#e8d2c6] flex flex-col">
      {/* Nav */}
      <div className="flex items-center justify-between px-6 sm:px-11 py-4 border-b border-line">
        <span className="flex items-center gap-3">
          <span className="flex gap-1" aria-hidden>
            <span className="w-3.5 h-3.5 bg-brand inline-block" />
            <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: 'var(--grad-hover)' }} />
          </span>
          <span className="font-extrabold text-xl text-ink tracking-tight">Prelude</span>
        </span>
        <span className="hidden sm:flex items-center gap-2 text-[9.5px] font-semibold uppercase tracking-[.2em] text-body">
          <Icon name="bolt" className="text-[16px]" />
          YC × Medplum · Aug 1 2026
        </span>
      </div>

      <main className="flex-1 grid lg:grid-cols-[1fr_460px] min-h-0">
        {/* Left: content */}
        <div className="px-6 sm:px-11 pt-10 sm:pt-12 pb-8 border-r-0 lg:border-r border-line flex flex-col">
          <div className="flex items-center gap-2.5 text-danger">
            <Icon name="graphic_eq" className="text-[20px]" />
            <span className="text-[10px] font-bold uppercase tracking-[.24em]">Voice-first pre-visit intake</span>
          </div>

          <h1 className="mt-5 font-extrabold text-[42px] sm:text-[56px] lg:text-[68px] leading-[0.98] tracking-[-0.028em] text-ink max-w-xl text-balance">
            The visit starts before the doctor walks in.
          </h1>

          <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-body">
            Three minutes of talking becomes a real FHIR record, a live coverage answer, and a
            draft SOAP note waiting for the provider.
          </p>

          {/* Pipeline tiles */}
          <div className="mt-7 flex flex-wrap gap-px bg-line border border-line max-w-xl">
            {PIPELINE.map((step) => (
              <div
                key={step.label}
                className="flex-1 min-w-[96px] bg-panel/70 p-4 flex flex-col gap-2 transition-all duration-200 hover:bg-ink hover:text-bright group"
              >
                <Icon name={step.icon} className="text-[22px] text-ink group-hover:text-bright" />
                <span className="font-bold text-xs">{step.label}</span>
                <span className="text-[8.5px] font-semibold uppercase tracking-[.16em] opacity-60">{step.vendor}</span>
              </div>
            ))}
          </div>

          {/* Primary CTAs */}
          <div className="mt-auto pt-8 grid sm:grid-cols-2 border-t border-line -mx-6 sm:mx-0">
            <Link
              href="/intake"
              className="group flex flex-col gap-3 px-6 sm:px-0 sm:pl-0 sm:pr-6 py-6 border-b sm:border-b-0 sm:border-r border-line transition-all duration-200 hover:bg-caution/10 hover:shadow-[inset_0_-5px_0_var(--color-caution)] hover:-translate-y-0.5"
            >
              <Icon name="person" className="text-[32px] text-danger" />
              <span className="font-extrabold text-2xl tracking-tight text-ink">I&apos;m a patient</span>
              <span className="flex items-center gap-2 text-[11px] font-semibold text-body">
                ~3 min · voice only <Icon name="arrow_forward" className="text-[16px]" />
              </span>
            </Link>
            <Link
              href="/dashboard"
              className="group flex flex-col gap-3 px-6 sm:px-6 py-6 transition-all duration-200 hover:bg-brand/10 hover:shadow-[inset_0_-5px_0_var(--color-brand)] hover:-translate-y-0.5"
            >
              <Icon name="stethoscope" className="text-[32px] text-brand" />
              <span className="font-extrabold text-2xl tracking-tight text-ink">I&apos;m a provider</span>
              <span className="flex items-center gap-2 text-[11px] font-semibold text-body">
                Review the queue <Icon name="arrow_forward" className="text-[16px]" />
              </span>
            </Link>
          </div>

          {/* Secondary links: preserved from prior lanes */}
          <div className="mt-px grid sm:grid-cols-2 border border-line border-t-0">
            <Link
              href="/medcard"
              className="group flex items-center justify-between gap-3 px-6 py-4 border-b border-line sm:border-b-0 sm:border-r transition-all duration-200 hover:bg-ink hover:text-bright"
            >
              <span className="text-sm font-bold">My Med Card</span>
              <Icon name="arrow_forward" className="text-[16px]" />
            </Link>
            <Link
              href="/records"
              className="group flex items-center justify-between gap-3 px-6 py-4 transition-all duration-200 hover:bg-ink hover:text-bright"
            >
              <span className="text-sm font-bold">My health records</span>
              <Icon name="arrow_forward" className="text-[16px]" />
            </Link>
          </div>
        </div>

        {/* Right: voice visual */}
        <div className="relative flex flex-col min-h-[420px] lg:min-h-0">
          <div className="relative flex-1 bg-gradient-to-br from-ink via-[#3a1f1c] to-[#6b2f22] overflow-hidden flex items-center justify-center">
            <div
              className="absolute w-[220px] h-[220px] rounded-full blur-2xl opacity-70 hero-orb"
              style={{ background: 'radial-gradient(circle, rgba(232,178,84,.4), rgba(168,52,43,.2) 52%, transparent 70%)' }}
              aria-hidden
            />
            <div className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] rounded-full bg-bright shadow-[0_0_0_1px_rgba(252,251,247,.25),0_24px_60px_rgba(0,0,0,.4)] overflow-hidden flex items-center justify-center animate-breathe">
              <div className="flex items-end gap-1.5 h-14" aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span key={i} className="voice-bar w-2 h-full bg-brand inline-block" />
                ))}
              </div>
            </div>
            <span className="absolute left-5 bottom-5 flex items-center gap-2 text-[9.5px] font-semibold uppercase tracking-[.2em] text-bright/70">
              <Icon name="hearing" className="text-[16px]" />
              Listening
            </span>
          </div>
          <div className="flex gap-3.5 px-6 py-4 border-t border-line bg-panel/60 items-center">
            <Icon name="emergency" className="text-[22px] text-danger shrink-0" />
            <p className="text-[11.5px] leading-relaxed text-body">
              Not a clinician · synthetic data only.{' '}
              <span className="font-bold text-danger">Emergency 911 · Crisis 988</span>
            </p>
          </div>
        </div>
      </main>
      <CoverageBot />
    </div>
  );
}
