import Link from 'next/link';
import { Icon, Wordmark } from '@/components/primitives';
import CoverageBot from '@/components/coverage-bot/CoverageBot';
import CheckInPreview from '@/components/landing/CheckInPreview';

const PATIENT_TOOLS = [
  { href: '/card', icon: 'id_card', label: 'See a sample Care Card' },
  { href: '/medcard', icon: 'medication', label: 'My Med Card' },
  { href: '/records', icon: 'folder_shared', label: 'My health records' },
  { href: '/timeline', icon: 'timeline', label: 'Log a symptom' },
] as const;

export default function Home() {
  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <header className="flex items-center justify-between gap-4 px-4 sm:px-11 py-4 border-b border-line bg-bright">
        <Wordmark />
        <Link href="/dashboard" className="flex items-center gap-2 text-[13px] font-semibold text-brand hover:text-ink">
          <Icon name="stethoscope" className="text-[18px]" />
          Clinician view
        </Link>
      </header>

      <main className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div className="px-4 sm:px-11 pt-10 sm:pt-16 pb-24 lg:pb-12 flex flex-col gap-10">
          <div className="flex flex-col gap-5">
            <h1 className="font-extrabold text-[40px] sm:text-[56px] lg:text-[64px] leading-[1] tracking-[-0.028em] text-ink max-w-[14ch] text-balance">
              The visit starts before the doctor walks in.
            </h1>
            <p className="max-w-[58ch] text-[17px] leading-relaxed text-body">
              Talk with Prelude for about three minutes before your appointment. It writes what you
              say into your chart as you speak, tells you what the visit costs on your plan, and gives
              your clinician a draft note to review.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/intake"
              className="flex items-center justify-center gap-2.5 bg-ink text-bright font-bold text-[15px] px-7 py-4 transition-colors duration-200 hover:bg-brand"
            >
              <Icon name="mic" className="text-[20px]" />
              Start a check-in
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2.5 bg-bright text-ink font-bold text-[15px] px-7 py-4 shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors duration-200 hover:bg-panel"
            >
              Review the patient queue
            </Link>
          </div>

          <nav aria-label="Patient tools" className="grid sm:grid-cols-2 gap-px bg-line max-w-2xl shadow-[0_0_0_1px_var(--color-line)]">
            {PATIENT_TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex items-center gap-3 bg-panel px-5 py-4 text-[14px] font-semibold text-ink transition-colors duration-200 hover:bg-bright"
              >
                <Icon name={tool.icon} className="text-[20px] text-brand" />
                <span className="flex-1">{tool.label}</span>
                <Icon name="arrow_forward" className="text-[18px] text-faint transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            ))}
          </nav>

          <p className="mt-auto flex items-start gap-2.5 max-w-[62ch] text-[13px] leading-relaxed text-body">
            <Icon name="emergency" className="text-[18px] text-danger shrink-0" />
            <span>
              Prelude gathers information and does not diagnose. In an emergency call{' '}
              <strong className="text-danger">911</strong>, or <strong className="text-danger">988</strong> for a
              mental health crisis. All patients and plans here are synthetic.
            </span>
          </p>
        </div>

        <CheckInPreview />
      </main>

      <footer className="px-4 sm:px-11 py-4 border-t border-line text-[12px] text-faint">
        Built on Medplum FHIR with Deepgram voice, Stedi eligibility and Moss retrieval. YC × Medplum hackathon, Aug 2026.
      </footer>
      <CoverageBot />
    </div>
  );
}
