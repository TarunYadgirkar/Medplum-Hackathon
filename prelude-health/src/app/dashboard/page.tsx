'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

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

const RISK_BADGE: Record<string, string> = {
  high:   'bg-red-50 text-red-600 border border-red-200',
  medium: 'bg-amber-50 text-amber-600 border border-amber-200',
  low:    'bg-emerald-50 text-emerald-600 border border-emerald-200',
  none:   'bg-slate-100 text-slate-500 border border-slate-200',
};

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  urgent_review: { bg: 'bg-red-50 text-red-600',        label: 'Urgent' },
  ai_draft:      { bg: 'bg-blue-50 text-blue-600',       label: 'AI Draft' },
  reviewed:      { bg: 'bg-emerald-50 text-emerald-600', label: 'Reviewed' },
};

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

type StatCardProps = { label: string; value: number; color: string; icon: React.ReactNode; iconColor: string };

function StatCard({ label, value, color, icon, iconColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5 flex items-start justify-between">
      <div>
        <p className="text-[#64748B] text-xs font-semibold uppercase tracking-widest mb-2">{label}</p>
        <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
    </div>
  );
}

function RiskDot({ level }: { level?: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500', none: 'bg-slate-300',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[level ?? 'none'] ?? colors.none}`} />;
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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* ── Nav ── */}
      <nav className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-[#00B894] tracking-tight">Prelude</Link>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[#64748B] font-medium">Live</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#00B894]/10 flex items-center justify-center text-[#00B894] font-bold text-sm">
            D
          </div>
          <span className="text-sm font-semibold text-[#0F172A]">Dr. Chen</span>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Patient Intake Queue</h1>
              <p className="text-[#64748B] text-sm mt-1">AI-generated summaries require provider review before clinical use.</p>
            </div>
            <Link
              href="/intake"
              className="inline-flex items-center gap-2 bg-[#00B894] hover:bg-[#00897B] text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Intake
            </Link>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Patients" value={patients.length} color="text-[#0F172A]" icon={<IconUsers />}         iconColor="bg-slate-100 text-slate-500" />
            <StatCard label="Pending Review"  value={pending.length}  color="text-amber-600"  icon={<IconClock />}          iconColor="bg-amber-50 text-amber-500" />
            <StatCard label="High Risk"       value={highRisk.length} color="text-red-600"    icon={<IconAlertTriangle />}  iconColor="bg-red-50 text-red-500" />
          </div>

          {/* ── Urgent banner ── */}
          {urgent.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 mb-6"
            >
              <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              </div>
              <span className="text-red-700 font-semibold text-sm">
                {urgent.length} patient{urgent.length > 1 ? 's' : ''} flagged for urgent provider review
              </span>
            </motion.div>
          )}

          {/* ── Table ── */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
            <div className="hidden sm:grid sm:grid-cols-[1.8fr_1.8fr_1fr_1fr_auto_auto] gap-4 px-6 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              {['Patient', 'Appointment', 'Status', 'Risk', 'Action', ''].map((h) => (
                <span key={h} className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest">{h}</span>
              ))}
            </div>

            {loading && (
              <div className="px-6 py-16 text-center">
                <div className="w-8 h-8 border-2 border-[#00B894]/30 border-t-[#00B894] rounded animate-spin mx-auto mb-3" />
                <p className="text-[#64748B] text-sm">Loading patients…</p>
              </div>
            )}

            {!loading && patients.length === 0 && (
              <div className="px-6 py-16 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-[#64748B] font-medium">No patients yet.</p>
                <Link href="/intake" className="text-[#00B894] hover:text-[#00897B] font-semibold text-sm transition-colors">
                  Start an intake →
                </Link>
              </div>
            )}

            {patients.map((patient, i) => {
              const statusBadge = patient.note_status ? (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded ${STATUS_BADGE[patient.note_status]?.bg ?? 'bg-slate-100 text-slate-500'}`}>
                  {STATUS_BADGE[patient.note_status]?.label ?? patient.note_status}
                </span>
              ) : patient.call_status === 'completed' ? (
                <span className="text-xs font-medium px-2.5 py-1 rounded bg-slate-100 text-slate-500">Processing…</span>
              ) : (
                <span className="text-xs font-medium px-2.5 py-1 rounded bg-slate-100 text-slate-400">Pending</span>
              );

              const riskBadge = patient.note_id ? (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded capitalize ${RISK_BADGE[patient.risk_level ?? 'none'] ?? RISK_BADGE.none}`}>
                  {patient.risk_level ?? 'none'}
                </span>
              ) : (
                <span className="text-[#94A3B8] text-sm">—</span>
              );

              const noteLink = patient.note_id ? (
                <Link
                  href={`/dashboard/${patient.note_id}`}
                  className="text-sm text-[#00B894] hover:text-[#00897B] font-semibold transition-colors whitespace-nowrap"
                >
                  View Note →
                </Link>
              ) : (
                <span className="text-sm text-[#94A3B8]">—</span>
              );

              const deleteButton = (
                <button
                  onClick={async () => {
                    if (!confirm(`Remove ${patient.name} from the queue?`)) return;
                    await fetch(`/api/patients/${patient.id}`, { method: 'DELETE' });
                    void fetchPatients();
                  }}
                  className="p-2 rounded-lg text-[#CBD5E1] hover:text-red-400 hover:bg-red-50 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                  title="Remove patient"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              );

              const formattedDate = new Date(patient.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

              return (
                <motion.div
                  key={patient.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`px-6 py-4 hover:bg-[#F8FAFC] transition-colors group ${
                    i < patients.length - 1 ? 'border-b border-[#E2E8F0]' : ''
                  } ${patient.risk_level === 'high' ? 'bg-red-50/30' : ''}`}
                >
                  {/* Desktop row */}
                  <div className="hidden sm:grid sm:grid-cols-[1.8fr_1.8fr_1fr_1fr_auto_auto] sm:gap-4 sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {patient.risk_level === 'high' && <RiskDot level="high" />}
                        <p className="font-semibold text-[#0F172A] truncate">{patient.name}</p>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-0.5">{formattedDate}</p>
                    </div>
                    <p className="text-sm text-[#64748B] truncate">{patient.appointment_type}</p>
                    <div>{statusBadge}</div>
                    <div>{riskBadge}</div>
                    <div>{noteLink}</div>
                    <div>{deleteButton}</div>
                  </div>

                  {/* Mobile card */}
                  <div className="sm:hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {patient.risk_level === 'high' && <RiskDot level="high" />}
                          <p className="font-semibold text-[#0F172A] truncate">{patient.name}</p>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-0.5 truncate">{formattedDate} · {patient.appointment_type}</p>
                      </div>
                      {deleteButton}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {statusBadge}
                        {riskBadge}
                      </div>
                      {noteLink}
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
