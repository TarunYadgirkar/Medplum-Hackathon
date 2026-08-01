'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Nav, Btn, Icon, StatusChip, RiskBadge, MicroLabel } from '@/components/primitives';
import type { NoteStatus, RiskLevel } from '@/types';

interface PatientRow {
  id: string;
  name: string;
  appointment_type: string;
  call_status: string;
  note_id?: string;
  note_status?: string;
  risk_level?: string;
  created_at: string;
}

/* ── appointment_type → Material Symbol ──
   Keyword match so any free-text appointment type from intake still gets a
   sensible glyph, with the mockup's five archetypes matched exactly. */
function appointmentIcon(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('urgent') || t.includes('emergency')) return 'emergency';
  if (t.includes('telehealth') || t.includes('video') || t.includes('virtual')) return 'videocam';
  if (t.includes('follow')) return 'event_repeat';
  if (t.includes('new patient') || t.includes('new visit')) return 'person_add';
  if (t.includes('annual') || t.includes('physical') || t.includes('wellness') || t.includes('checkup') || t.includes('check-up')) return 'monitor_heart';
  if (t.includes('mental') || t.includes('psych') || t.includes('therapy') || t.includes('counsel')) return 'psychology';
  if (t.includes('lab') || t.includes('test')) return 'biotech';
  if (t.includes('vaccin') || t.includes('immuniz')) return 'vaccines';
  if (t.includes('pediatric') || t.includes('child')) return 'child_care';
  if (t.includes('sick') || t.includes('illness')) return 'sick';
  return 'stethoscope';
}

/* ── row tint, keyed off note_status → risk_level → call_status ── */
function rowTone(patient: PatientRow): { color: string; pulse?: boolean } {
  if (patient.risk_level === 'high' || patient.note_status === 'urgent_review') return { color: 'text-danger' };
  if (patient.note_status === 'ai_draft') return { color: 'text-brand' };
  if (patient.note_status === 'reviewed') return { color: 'text-positive' };
  if (patient.call_status === 'completed') return { color: 'text-faint', pulse: true }; // note still generating
  return { color: 'text-faint' }; // awaiting call
}

const STATUS_ICON: Record<string, string> = {
  urgent_review: 'priority_high',
  ai_draft: 'smart_toy',
  reviewed: 'verified',
};

function FallbackChip({ icon, label, spin }: { icon: string; label: string; spin?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] px-2.5 py-1 border border-line text-faint">
      <Icon name={icon} className={`text-[13px] ${spin ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}

type StatTone = { icon: string; iconColor: string; labelColor: string; valueColor: string; accent?: string };

function StatTile({ label, value, tone }: { label: string; value: number; tone: StatTone }) {
  return (
    <div className={`bg-panel p-5 flex items-center gap-4 transition-colors hover:bg-bright ${tone.accent ? `border-t-4 ${tone.accent}` : ''}`}>
      <Icon name={tone.icon} className={`text-[32px] shrink-0 ${tone.iconColor}`} />
      <div>
        <p className={`text-[9.5px] font-semibold uppercase tracking-[.2em] ${tone.labelColor}`}>{label}</p>
        <p className={`font-numeral text-[40px] sm:text-[44px] leading-none mt-1.5 ${tone.valueColor}`}>{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchPatients() {
    const res = await fetch('/api/patients');
    const data: PatientRow[] = await res.json();
    setPatients(data);
    setLoading(false);
  }

  useEffect(() => {
    const timeout = setTimeout(() => { void fetchPatients(); }, 0);
    const interval = setInterval(() => { void fetchPatients(); }, 5000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, []);

  const urgent   = patients.filter((p) => p.risk_level === 'high' || p.note_status === 'urgent_review');
  const pending  = patients.filter((p) => !p.note_status || p.note_status === 'ai_draft' || p.note_status === 'urgent_review');
  const highRisk = patients.filter((p) => p.risk_level === 'high');

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ── Nav ── */}
      <Nav
        right={
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-positive animate-pulse" />
              <span className="text-[9.5px] font-semibold uppercase tracking-[.18em] text-body">Live</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 bg-ink text-bright flex items-center justify-center">
                <Icon name="stethoscope" className="text-[16px]" />
              </span>
              <span className="text-sm font-bold text-ink">Dr. Chen</span>
            </div>
          </div>
        }
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ── Header ── */}
          <div className="flex items-end justify-between gap-6 flex-wrap mb-7">
            <div>
              <div className="flex items-center gap-2.5">
                <Icon name="groups" className="text-[19px] text-danger" />
                <span className="text-[9.5px] font-semibold uppercase tracking-[.22em] text-faint">Auto-refreshes every 5s</span>
              </div>
              <h1 className="mt-3 font-extrabold text-[38px] sm:text-[46px] leading-[0.96] tracking-[-.03em] text-ink">
                Patient intake queue
              </h1>
              <p className="mt-2.5 max-w-xl text-sm text-body">
                AI-generated summaries require provider review before clinical use.
              </p>
            </div>
            <Link href="/intake">
              <Btn className="px-6 py-3.5 inline-flex items-center gap-2">
                <Icon name="add" className="text-[20px]" />
                New intake
              </Btn>
            </Link>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border border-line mb-6">
            <StatTile
              label="Patients"
              value={patients.length}
              tone={{ icon: 'groups', iconColor: 'text-brand', labelColor: 'text-faint', valueColor: 'text-ink' }}
            />
            <StatTile
              label="Pending review"
              value={pending.length}
              tone={{ icon: 'pending_actions', iconColor: 'text-caution', labelColor: 'text-caution', valueColor: 'text-caution', accent: 'border-caution' }}
            />
            <StatTile
              label="High risk"
              value={highRisk.length}
              tone={{ icon: 'warning', iconColor: 'text-danger', labelColor: 'text-danger', valueColor: 'text-danger', accent: 'border-danger' }}
            />
          </div>

          {/* ── Urgent banner ── */}
          {urgent.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-danger flex items-center gap-3.5 px-5 py-3.5 mb-6"
            >
              <Icon name="emergency" className="text-[22px] text-bright animate-pulse shrink-0" />
              <span className="text-bright font-bold text-sm">
                {urgent.length} patient{urgent.length > 1 ? 's' : ''} flagged for urgent provider review
              </span>
            </motion.div>
          )}

          {/* ── Table ── */}
          <div className="bg-panel border border-line">
            <div className="hidden sm:grid sm:grid-cols-[40px_1.8fr_1.6fr_1.1fr_.7fr_84px] gap-4 px-6 py-3 border-b border-line bg-line/20">
              {['', 'Patient', 'Appointment', 'Status', 'Risk', ''].map((h, idx) => (
                <MicroLabel key={idx}>{h}</MicroLabel>
              ))}
            </div>

            {loading && (
              <div className="px-6 py-16 text-center">
                <Icon name="progress_activity" className="text-[28px] text-brand animate-spin inline-block mb-3" />
                <p className="text-body text-sm">Loading patients…</p>
              </div>
            )}

            {!loading && patients.length === 0 && (
              <div className="px-6 py-16 text-center space-y-3">
                <span className="w-10 h-10 bg-ink/5 flex items-center justify-center mx-auto text-faint">
                  <Icon name="inbox" className="text-[20px]" />
                </span>
                <p className="text-body font-medium">No patients yet.</p>
                <Link href="/intake" className="inline-flex items-center gap-1.5 text-brand hover:text-brand-dark font-semibold text-sm transition-colors">
                  Start an intake
                  <Icon name="arrow_forward" className="text-[15px]" />
                </Link>
              </div>
            )}

            {patients.map((patient, i) => {
              const tone = rowTone(patient);
              const icon = appointmentIcon(patient.appointment_type);

              const statusBadge = patient.note_status ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name={STATUS_ICON[patient.note_status] ?? 'help'} className={`text-[13px] ${tone.color}`} />
                  <StatusChip status={patient.note_status as NoteStatus} />
                </span>
              ) : patient.call_status === 'completed' ? (
                <FallbackChip icon="autorenew" label="Processing" spin />
              ) : (
                <FallbackChip icon="schedule" label="Pending" />
              );

              const riskBadge = patient.note_id ? (
                <RiskBadge level={patient.risk_level as RiskLevel} />
              ) : (
                <span className="text-faint text-sm">—</span>
              );

              const viewButton = patient.note_id ? (
                <Link
                  href={`/dashboard/${patient.note_id}`}
                  className="w-9 h-9 flex items-center justify-center bg-ink text-bright transition-all duration-200 hover:[background:var(--grad-hover)]"
                  title="View note"
                >
                  <Icon name="visibility" className="text-[18px]" />
                </Link>
              ) : (
                <span className="w-9 h-9 flex items-center justify-center bg-ink/10 text-ink/25" title="Note not ready">
                  <Icon name="visibility_off" className="text-[18px]" />
                </span>
              );

              const deleteButton = (
                <button
                  onClick={async () => {
                    if (!confirm(`Remove ${patient.name} from the queue?`)) return;
                    await fetch(`/api/patients/${patient.id}`, { method: 'DELETE' });
                    void fetchPatients();
                  }}
                  className="w-9 h-9 flex items-center justify-center border border-line text-faint transition-all duration-200 hover:bg-danger hover:text-bright hover:border-danger"
                  title="Remove patient"
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              );

              const date = new Date(patient.created_at);
              const formattedDate = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

              return (
                <motion.div
                  key={patient.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`px-6 py-4 transition-colors group ${
                    i < patients.length - 1 ? 'border-b border-line' : ''
                  } ${patient.risk_level === 'high' ? 'border-l-4 border-l-danger bg-danger/5 hover:bg-danger/10' : 'hover:bg-bright'}`}
                >
                  {/* Desktop row */}
                  <div className="hidden sm:grid sm:grid-cols-[40px_1.8fr_1.6fr_1.1fr_.7fr_84px] sm:gap-4 sm:items-center">
                    <Icon name={icon} className={`text-[24px] ${tone.color} ${tone.pulse ? 'animate-pulse' : ''}`} />
                    <div className="min-w-0">
                      <p className="font-extrabold text-ink truncate"><Link href={`/dashboard/patient/${patient.id}`} className="hover:text-brand transition-colors">{patient.name}</Link></p>
                      <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-faint mt-1">{formattedDate}</p>
                    </div>
                    <span className="flex items-center gap-2 text-sm text-body truncate">
                      <Icon name={icon} className="text-[16px] text-faint shrink-0" />
                      {patient.appointment_type}
                    </span>
                    <div>{statusBadge}</div>
                    <div>{riskBadge}</div>
                    <div className="flex gap-1 justify-self-end">
                      {viewButton}
                      {deleteButton}
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="sm:hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Icon name={icon} className={`text-[22px] mt-0.5 ${tone.color} ${tone.pulse ? 'animate-pulse' : ''} shrink-0`} />
                        <div className="min-w-0">
                          <p className="font-extrabold text-ink truncate"><Link href={`/dashboard/patient/${patient.id}`} className="hover:text-brand transition-colors">{patient.name}</Link></p>
                          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-faint mt-1 truncate">
                            {formattedDate} · {patient.appointment_type}
                          </p>
                        </div>
                      </div>
                      {deleteButton}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge}
                        {riskBadge}
                      </div>
                      {viewButton}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
