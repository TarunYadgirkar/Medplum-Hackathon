'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Note {
  id: string;
  patient_id: string;
  call_id: string;
  ai_summary: string;
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
  risk_level: string;
  risk_flags: string[];
  suggested_questions: string[];
  follow_up_actions: string[];
  chief_concern: string;
  symptoms_reported: string[];
  patient_goals: string[];
  status: string;
  provider_edited_note?: string;
  reviewed_at?: string;
  created_at: string;
  care_recommendation?: {
    care_level: string;
    confidence: number;
    reasoning: string;
    red_flags_to_watch: string[];
  };
  coverage?: {
    source: string;
    payer: string;
    plan_status: string;
    copay?: number;
    coinsurance_percent?: number;
    deductible_remaining?: number;
    estimated_visit_cost: { min: number; max: number };
    spoken_summary: string;
  };
}

const CARE_LEVEL_LABELS: Record<string, { label: string; cls: string }> = {
  self_care:      { label: 'Self care',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  telehealth:     { label: 'Telehealth',     cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  primary_care:   { label: 'Primary care',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  urgent_care:    { label: 'Urgent care',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  emergency_room: { label: 'Emergency room', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const RISK_COLORS: Record<string, string> = {
  high:   'bg-red-50 text-red-600 border-red-200',
  medium: 'bg-amber-50 text-amber-600 border-amber-200',
  low:    'bg-emerald-50 text-emerald-600 border-emerald-200',
  none:   'bg-slate-100 text-slate-500 border-slate-200',
};

const RISK_ACTIVE: Record<string, string> = {
  high:   'bg-red-50 text-red-600 border-red-300 ring-2 ring-red-200',
  medium: 'bg-amber-50 text-amber-600 border-amber-300 ring-2 ring-amber-200',
  low:    'bg-emerald-50 text-emerald-600 border-emerald-300 ring-2 ring-emerald-200',
  none:   'bg-slate-100 text-slate-600 border-slate-300 ring-2 ring-slate-200',
};

const SOAP_LABELS = [
  { key: 'soap_subjective' as const, label: 'S — Subjective', color: 'border-[#00B894]', labelColor: 'text-[#00897B]' },
  { key: 'soap_objective'  as const, label: 'O — Objective',  color: 'border-blue-400',  labelColor: 'text-blue-600'  },
  { key: 'soap_assessment' as const, label: 'A — Assessment', color: 'border-purple-400', labelColor: 'text-purple-600' },
  { key: 'soap_plan'       as const, label: 'P — Plan',       color: 'border-amber-400',  labelColor: 'text-amber-600'  },
];

function buildSoapText(n: Note) {
  return `AI Draft — Provider Review Required

Patient Summary:
${n.ai_summary || ''}

Chief Concern:
${n.chief_concern || ''}

Patient-Reported Symptoms:
${(n.symptoms_reported || []).map((s) => `- ${s}`).join('\n')}

SOAP Note Draft:
S — Subjective:
${n.soap_subjective || ''}

O — Objective:
${n.soap_objective || ''}

A — Assessment:
${n.soap_assessment || ''}

P — Plan:
${n.soap_plan || ''}`;
}

function SectionCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#0F172A]">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

function BulletList({ items, color = 'bg-[#00B894]', empty }: { items: string[]; color?: string; empty: string }) {
  if (!items?.length) return <p className="text-sm text-[#94A3B8] italic">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-[#64748B]">
          <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0 mt-1.5`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

const EMPTY = 'Not enough information was provided during intake.';

export default function NoteDetailPage({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = use(params);
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedNote, setEditedNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [riskSaving, setRiskSaving] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/notes/${noteId}`);
      if (res.ok) {
        const data: Note = await res.json();
        setNote(data);
        setEditedNote(data.provider_edited_note || buildSoapText(data));
      }
      setLoading(false);
    }
    void load();
  }, [noteId]);

  async function loadTranscript() {
    if (!note?.call_id) return;
    const res = await fetch(`/api/calls/${note.call_id}`);
    if (res.ok) {
      const data = await res.json();
      setTranscript(data.transcript as string);
    }
    setShowTranscript(true);
  }

  async function updateRisk(level: string) {
    if (!note || riskSaving) return;
    setRiskSaving(true);
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: note.status, riskLevel: level }),
    });
    if (res.ok) { const data: Note = await res.json(); setNote(data); }
    setRiskSaving(false);
  }

  async function approve() {
    setSaving(true);
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewed', providerEditedNote: editedNote }),
    });
    if (res.ok) { const data: Note = await res.json(); setNote(data); }
    setSaving(false);
    setEditing(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#00B894]/30 border-t-[#00B894] rounded-full animate-spin mx-auto" />
          <p className="text-[#64748B] text-sm">Loading note…</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        Note not found.{' '}
        <Link href="/dashboard" className="text-[#00B894] ml-2 font-medium">Back to dashboard</Link>
      </div>
    );
  }

  const riskBg = { high: 'bg-red-50 border-red-200', medium: 'bg-amber-50 border-amber-200', low: 'bg-[#F8FAFC] border-[#E2E8F0]', none: 'bg-[#F8FAFC] border-[#E2E8F0]' };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* ── Nav ── */}
      <nav className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-[#00B894] tracking-tight">Prelude</Link>
        <Link href="/dashboard" className="text-sm text-[#64748B] hover:text-[#00B894] transition-colors font-medium flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5"
        >
          {/* ── Note header ── */}
          <div className={`rounded-2xl border p-6 ${riskBg[note.risk_level as keyof typeof riskBg] ?? riskBg.none}`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Risk toggle */}
                  {(['none', 'low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => updateRisk(level)}
                      disabled={riskSaving}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize transition-all ${
                        note.risk_level === level
                          ? RISK_ACTIVE[level] ?? RISK_ACTIVE.none
                          : 'bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#00B894]/40 hover:text-[#00B894]'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                  <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-full ${
                    note.status === 'reviewed'      ? 'bg-emerald-50 text-emerald-600' :
                    note.status === 'urgent_review' ? 'bg-red-50 text-red-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {note.status === 'ai_draft' ? 'AI Draft' : note.status === 'reviewed' ? '✓ Provider Reviewed' : 'Urgent Review'}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#0F172A]">Intake Note</h1>
                  <p className="text-sm text-[#64748B] mt-1">
                    Generated {new Date(note.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    {note.reviewed_at && (
                      <span className="text-emerald-600 ml-2">
                        · Reviewed {new Date(note.reviewed_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditing(!editing)}
                  className="bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-sm font-medium rounded-xl px-4 py-2.5 transition-colors shadow-sm"
                >
                  {editing ? 'Cancel' : 'Edit Note'}
                </button>
                <button
                  onClick={approve}
                  disabled={saving}
                  className="bg-[#00B894] hover:bg-[#00897B] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors shadow-sm"
                >
                  {saving ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </span>
                  ) : note.status === 'reviewed' ? '✓ Re-approve' : '✓ Approve Note'}
                </button>
              </div>
            </div>
          </div>

          {/* ── AI disclaimer ── */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-700 font-medium flex gap-2.5 items-start">
            <span className="shrink-0 text-amber-500">⚠</span>
            This is an AI-generated draft. Review and edit before using as a clinical record.
          </div>

          {/* ── Risk flags ── */}
          {(note.risk_flags?.length > 0 || true) && (
            <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
              <h2 className="font-semibold text-amber-800 flex items-center gap-2">
                <span>⚠</span> Risk Flags
              </h2>
              {note.risk_flags?.length > 0 ? (
                <ul className="space-y-1.5">
                  {note.risk_flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      {flag}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-amber-700 italic">No specific risk flags identified from intake.</p>
              )}
            </section>
          )}

          {/* ── Patient summary ── */}
          <SectionCard title="Patient Summary">
            {note.ai_summary
              ? <p className="text-sm text-[#64748B] leading-relaxed">{note.ai_summary}</p>
              : <p className="text-sm text-[#94A3B8] italic">{EMPTY}</p>}
            <div className="pt-3 border-t border-[#E2E8F0]">
              <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">Chief Concern</p>
              {note.chief_concern
                ? <p className="text-sm text-[#0F172A] leading-relaxed">{note.chief_concern}</p>
                : <p className="text-sm text-[#94A3B8] italic">{EMPTY}</p>}
            </div>
          </SectionCard>

          {/* ── Symptoms & Goals ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="Patient-Reported Symptoms">
              <BulletList items={note.symptoms_reported} color="bg-[#00B894]" empty={EMPTY} />
            </SectionCard>
            <SectionCard title="Patient Goals">
              <BulletList items={note.patient_goals} color="bg-[#00CEB8]" empty={EMPTY} />
            </SectionCard>
          </div>

          {/* ── Care level + coverage (carepath layer: Stedi + care classifier) ── */}
          {(note.care_recommendation || note.coverage) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {note.care_recommendation && (
                <SectionCard
                  title="Suggested Care Level"
                  badge={
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${CARE_LEVEL_LABELS[note.care_recommendation.care_level]?.cls || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {CARE_LEVEL_LABELS[note.care_recommendation.care_level]?.label || note.care_recommendation.care_level}
                      {' · '}{Math.round((note.care_recommendation.confidence || 0) * 100)}%
                    </span>
                  }
                >
                  <p className="text-sm text-[#64748B] leading-relaxed">{note.care_recommendation.reasoning}</p>
                  {note.care_recommendation.red_flags_to_watch?.length > 0 && (
                    <div className="pt-3 border-t border-[#E2E8F0]">
                      <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">Escalate if</p>
                      <BulletList items={note.care_recommendation.red_flags_to_watch} color="bg-red-400" empty={EMPTY} />
                    </div>
                  )}
                </SectionCard>
              )}
              {note.coverage && (
                <SectionCard
                  title="Coverage & Cost"
                  badge={
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#00B894]/10 text-[#00897B] uppercase tracking-wider">
                      {note.coverage.source === 'stedi' ? 'Stedi eligibility' : 'Synthetic'}
                    </span>
                  }
                >
                  <p className="text-sm font-semibold text-[#0F172A]">{note.coverage.payer} — {note.coverage.plan_status}</p>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div>
                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Copay</p>
                      <p className="text-lg font-bold text-[#0F172A]">{note.coverage.copay != null ? `$${note.coverage.copay}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Deductible left</p>
                      <p className="text-lg font-bold text-[#0F172A]">{note.coverage.deductible_remaining != null ? `$${note.coverage.deductible_remaining}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Est. visit</p>
                      <p className="text-lg font-bold text-[#0F172A]">${note.coverage.estimated_visit_cost.min}–${note.coverage.estimated_visit_cost.max}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#94A3B8] pt-2 border-t border-[#E2E8F0]">{note.coverage.spoken_summary}</p>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── SOAP Note ── */}
          <SectionCard
            title="SOAP Note Draft"
            badge={<span className="text-xs text-[#94A3B8]">AI generated · provider review required</span>}
          >
            {editing ? (
              <textarea
                value={editedNote}
                onChange={(e) => setEditedNote(e.target.value)}
                rows={20}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm text-[#0F172A] font-mono focus:outline-none focus:border-[#00B894] focus:ring-2 focus:ring-[#00B894]/20 resize-none transition-colors"
              />
            ) : (
              <div className="space-y-4">
                {SOAP_LABELS.map(({ key, label, color, labelColor }) => (
                  <div key={key} className={`border-l-[3px] ${color} pl-4 py-1`}>
                    <p className={`text-[11px] font-bold ${labelColor} uppercase tracking-widest mb-1.5`}>{label}</p>
                    <p className="text-sm text-[#64748B] leading-relaxed">{note[key] || 'Not available.'}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Suggested questions ── */}
          <SectionCard title="Suggested Provider Questions">
            {note.suggested_questions?.length > 0 ? (
              <ol className="space-y-2.5">
                {note.suggested_questions.map((q, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[#64748B]">
                    <span className="text-[#00B894] font-bold shrink-0 tabular-nums w-5">{i + 1}.</span>
                    <span className="leading-relaxed">{q}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[#94A3B8] italic">Not enough information to generate suggested questions.</p>
            )}
          </SectionCard>

          {/* ── Follow-up ── */}
          <SectionCard title="Follow-Up Actions">
            <BulletList items={note.follow_up_actions} color="bg-[#64748B]" empty="Not enough information to generate follow-up actions." />
          </SectionCard>

          {/* ── Transcript ── */}
          <SectionCard
            title="Full Transcript"
            badge={
              <button
                onClick={showTranscript ? () => setShowTranscript(false) : loadTranscript}
                className="text-sm text-[#00B894] hover:text-[#00897B] transition-colors font-medium"
              >
                {showTranscript ? 'Hide' : 'Show transcript'}
              </button>
            }
          >
            {showTranscript && transcript && (
              <pre className="text-xs text-[#64748B] whitespace-pre-wrap leading-relaxed font-mono max-h-80 overflow-y-auto bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0]">
                {transcript}
              </pre>
            )}
            {showTranscript && !transcript && (
              <p className="text-sm text-[#94A3B8]">Transcript not available.</p>
            )}
            {!showTranscript && (
              <p className="text-sm text-[#94A3B8]">Full conversation transcript available on request.</p>
            )}
          </SectionCard>
        </motion.div>
      </main>
    </div>
  );
}
