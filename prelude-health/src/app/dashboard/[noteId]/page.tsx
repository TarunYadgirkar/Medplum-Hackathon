'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Icon, Nav, StatusChip, BulletList, MicroLabel } from '@/components/primitives';
import { CommunitySuggestions } from '@/components/communities/CommunitySuggestions';
import { PastVisits } from '@/components/visits/PastVisits';
import { ResearchPanel } from '@/components/research/ResearchPanel';
import type { Note, RiskLevel } from '@/types';

/* ── Config (design handoff §5f) ── */

const RISK_PILLS: { level: RiskLevel; active: string; hover: string }[] = [
  { level: 'none',   active: 'bg-ink text-bright ring-[3px] ring-ink/15',        hover: 'hover:bg-ink hover:text-bright hover:border-ink' },
  { level: 'low',    active: 'bg-brand text-bright ring-[3px] ring-brand/20',    hover: 'hover:bg-brand hover:text-bright hover:border-brand' },
  { level: 'medium', active: 'bg-caution text-bright ring-[3px] ring-caution/25', hover: 'hover:bg-caution hover:text-bright hover:border-caution' },
  { level: 'high',   active: 'bg-danger text-bright ring-[3px] ring-danger/25',  hover: 'hover:bg-danger hover:text-bright hover:border-danger' },
];

const CARE_LEVELS = [
  { key: 'self_care',      label: 'Self care',    icon: 'self_improvement', activeBg: 'bg-positive', tint: 'bg-positive/15' },
  { key: 'telehealth',     label: 'Telehealth',   icon: 'videocam',         activeBg: 'bg-positive', tint: 'bg-positive/10' },
  { key: 'primary_care',   label: 'Primary care', icon: 'stethoscope',      activeBg: 'bg-brand',    tint: 'bg-brand/10' },
  { key: 'urgent_care',    label: 'Urgent care',  icon: 'local_hospital',   activeBg: 'bg-caution',  tint: 'bg-caution/12' },
  { key: 'emergency_room', label: 'Emergency',    icon: 'emergency',        activeBg: 'bg-danger',   tint: 'bg-danger/12' },
];

const SOAP_BLOCKS = [
  { key: 'soap_subjective' as const, letter: 'S', label: 'Subjective', box: 'bg-brand text-bright',           labelCls: 'text-brand',    rowCls: '' },
  { key: 'soap_objective'  as const, letter: 'O', label: 'Objective',  box: 'border border-brand text-brand', labelCls: 'text-faint',    rowCls: '' },
  { key: 'soap_assessment' as const, letter: 'A', label: 'Assessment', box: 'bg-caution text-bright',         labelCls: 'text-caution',  rowCls: 'bg-caution/8 -mx-3 px-3' },
  { key: 'soap_plan'       as const, letter: 'P', label: 'Plan',       box: 'bg-positive text-bright',        labelCls: 'text-positive', rowCls: '' },
];

const HEADER_ACCENT: Record<RiskLevel, string> = {
  high: 'border-t-danger',
  medium: 'border-t-caution',
  low: 'border-t-brand',
  none: 'border-t-brand',
};

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

const EMPTY = 'Not enough information was provided during intake.';

/* ── Local layout pieces ── */

function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  // Radius 0 everywhere — the spinner is a rotating square, not a circle.
  return <span className={`inline-block border-2 border-ink/15 border-t-brand animate-spin ${className}`} aria-label="Loading" />;
}

function Row({ icon, iconClass, label, children }: { icon: string; iconClass: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[52px_1fr] gap-5 py-5 border-t border-line">
      <div className="flex flex-col items-center gap-1.5 pt-0.5">
        <Icon name={icon} className={`text-[25px] ${iconClass}`} />
        <span className="text-[7.5px] font-semibold uppercase tracking-[.12em] text-faint">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Tile({ icon, iconClass, children, bold = true }: { icon: string; iconClass: string; children: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex-1 min-w-[170px] bg-panel p-3.5 flex items-center gap-3 transition-colors duration-200 hover:bg-bright">
      <Icon name={icon} className={`text-[20px] ${iconClass}`} />
      <span className={bold ? 'text-xs font-bold text-ink' : 'text-[13px] leading-snug text-body'}>{children}</span>
    </div>
  );
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-px bg-line border border-line">{children}</div>;
}

export default function NoteDetailPage({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = use(params);
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedNote, setEditedNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [riskSaving, setRiskSaving] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
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
    setShowTranscript(true);
    setTranscriptLoading(true);
    const res = await fetch(`/api/calls/${note.call_id}`);
    if (res.ok) {
      const data = await res.json();
      setTranscript(data.transcript as string);
    }
    setTranscriptLoading(false);
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
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner className="w-7 h-7 mx-auto" />
          <MicroLabel>Loading note</MicroLabel>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-extrabold text-2xl text-ink tracking-tight">Note not found</p>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:text-ink transition-colors">
            <Icon name="west" className="text-[16px]" />
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const activeCareIdx = CARE_LEVELS.findIndex((l) => l.key === note.care_recommendation?.care_level);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ── Nav ── */}
      <Nav
        right={
          <div className="flex items-center gap-5">
            <Link href={`/dashboard/patient/${note.patient_id}`} className="flex items-center gap-2 text-[11px] font-bold text-body hover:text-ink transition-colors">
              <Icon name="person" className="text-[18px]" />
              Patient chart
            </Link>
            <Link href="/dashboard" className="flex items-center gap-2 text-[11px] font-bold text-body hover:text-ink transition-colors">
              <Icon name="west" className="text-[18px]" />
              Dashboard
            </Link>
          </div>
        }
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="bg-panel border border-line"
        >
          {/* ── Header ── */}
          <div className={`border-t-4 ${HEADER_ACCENT[note.risk_level] ?? HEADER_ACCENT.none} px-6 sm:px-8 py-6 border-b border-line`}>
            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-semibold uppercase tracking-[.2em] text-faint mr-1">Risk</span>
                {RISK_PILLS.map(({ level, active, hover }) => (
                  <button
                    key={level}
                    onClick={() => updateRisk(level)}
                    disabled={riskSaving}
                    className={`px-3 py-1.5 text-[10px] font-bold capitalize transition-all duration-200 disabled:opacity-60 ${
                      note.risk_level === level
                        ? active
                        : `border border-ink/20 text-faint ${hover}`
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <StatusChip
                status={note.status}
                label={note.status === 'reviewed' ? 'Provider reviewed' : undefined}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="font-extrabold text-3xl sm:text-4xl leading-none tracking-tight text-ink">Intake Note</h1>
                <div className="mt-2.5 flex items-center gap-4 flex-wrap text-[11px] font-semibold text-body">
                  <span className="flex items-center gap-1.5">
                    <Icon name="description" className="text-[15px]" />
                    AI-drafted intake note
                  </span>
                  {note.created_at && (
                    <span className="flex items-center gap-1.5">
                      <Icon name="schedule" className="text-[15px]" />
                      Generated {new Date(note.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                  {note.reviewed_at && (
                    <span className="flex items-center gap-1.5 text-positive">
                      <Icon name="task_alt" className="text-[15px]" />
                      Reviewed {new Date(note.reviewed_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2.5 shrink-0">
                <button
                  onClick={() => setEditing(!editing)}
                  className="flex items-center gap-2 px-4 py-3 border border-ink/40 text-[11px] font-bold text-ink transition-all duration-200 hover:bg-ink hover:text-bright"
                >
                  <Icon name={editing ? 'close' : 'edit'} className="text-[17px]" />
                  {editing ? 'Cancel' : 'Edit note'}
                </button>
                <button
                  onClick={approve}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-3 bg-positive text-bright text-[11px] font-bold transition-all duration-200 hover:[background:var(--grad-hover)] disabled:bg-line disabled:text-faint"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 inline-block border-2 border-bright/30 border-t-bright animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Icon name="task_alt" className="text-[17px]" />
                      {note.status === 'reviewed' ? 'Re-approve' : 'Approve note'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── AI disclaimer ── */}
          <div className="flex items-center gap-3.5 bg-caution/12 border-l-4 border-caution px-5 py-3">
            <Icon name="warning" className="text-[22px] text-caution" />
            <span className="text-xs font-semibold text-caution">
              AI-generated draft — review and edit before clinical use.
            </span>
          </div>

          <div className="px-6 sm:px-8 pb-8">
            {/* ── Flags strip ── */}
            <Row icon="flag" iconClass="text-caution" label="Flags">
              {note.risk_flags?.length > 0 ? (
                <TileGrid>
                  {note.risk_flags.map((flag, i) => (
                    <Tile key={i} icon="history" iconClass="text-caution" bold={false}>{flag}</Tile>
                  ))}
                </TileGrid>
              ) : (
                <p className="text-sm italic text-faint pt-1">No specific risk flags identified from intake.</p>
              )}
            </Row>

            {/* ── Summary: chief concern + ai_summary ── */}
            <Row icon="summarize" iconClass="text-brand" label="Summary">
              {note.chief_concern
                ? <p className="font-extrabold text-2xl leading-tight tracking-tight text-ink">{note.chief_concern}</p>
                : <p className="text-sm italic text-faint">{EMPTY}</p>}
              {note.ai_summary
                ? <p className="mt-2.5 text-[14.5px] leading-relaxed text-body">{note.ai_summary}</p>
                : <p className="mt-2.5 text-sm italic text-faint">{EMPTY}</p>}
            </Row>

            {/* ── Past visits ── */}
            <Row icon="history" iconClass="text-ink" label="Visits">
              <PastVisits currentNoteId={note.id} />
            </Row>

            {/* ── Reported: symptoms + goals ── */}
            <Row icon="sick" iconClass="text-ink" label="Reported">
              <div className="space-y-4">
                <div className="space-y-2">
                  <MicroLabel>Patient-reported symptoms</MicroLabel>
                  {note.symptoms_reported?.length > 0 ? (
                    <TileGrid>
                      {note.symptoms_reported.map((s, i) => (
                        <Tile key={i} icon="healing" iconClass="text-brand">{s}</Tile>
                      ))}
                    </TileGrid>
                  ) : (
                    <p className="text-sm italic text-faint">{EMPTY}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <MicroLabel>Patient goals</MicroLabel>
                  {note.patient_goals?.length > 0 ? (
                    <TileGrid>
                      {note.patient_goals.map((g, i) => (
                        <Tile key={i} icon="target" iconClass="text-positive">{g}</Tile>
                      ))}
                    </TileGrid>
                  ) : (
                    <p className="text-sm italic text-faint">{EMPTY}</p>
                  )}
                </div>
              </div>
            </Row>

            {/* ── Care level scale + coverage (carepath layer: Stedi + care classifier) ── */}
            {(note.care_recommendation || note.coverage) && (
              <Row icon="local_hospital" iconClass="text-positive" label="Care">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {note.care_recommendation && (
                    <div className="border border-line bg-panel p-4">
                      <MicroLabel>
                        Suggested care level · {Math.round((note.care_recommendation.confidence || 0) * 100)}%
                      </MicroLabel>
                      {/* Five-level spectrum, active level emphasized */}
                      <div className="mt-3 flex gap-px">
                        {CARE_LEVELS.map((l, i) => (
                          i === activeCareIdx ? (
                            <div key={l.key} className={`flex-[1.7] px-1 py-2.5 ${l.activeBg} flex flex-col items-center justify-center gap-1.5`}>
                              <Icon name={l.icon} className="text-[20px] text-bright" />
                              <span className="text-[9px] font-bold text-bright text-center leading-none">{l.label}</span>
                            </div>
                          ) : (
                            <div key={l.key} className={`flex-1 px-1 py-2.5 ${l.tint} flex items-center justify-center`} title={l.label}>
                              <Icon name={l.icon} className="text-[18px] text-ink/40" />
                            </div>
                          )
                        ))}
                      </div>
                      <p className="mt-3.5 text-[13px] leading-relaxed text-body">{note.care_recommendation.reasoning}</p>
                      {note.care_recommendation.red_flags_to_watch?.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-line">
                          <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.16em] text-danger">
                            <Icon name="emergency" className="text-[16px]" />
                            Escalate if
                          </span>
                          <div className="mt-2 space-y-1.5">
                            {note.care_recommendation.red_flags_to_watch.map((f, i) => (
                              <p key={i} className="text-[12.5px] leading-snug text-danger">{f}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {note.coverage && (
                    <div className="bg-brand p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-bright/85">
                          <Icon name="shield" className="text-[16px]" />
                          Coverage &amp; cost
                        </span>
                        <span className="text-[8px] font-semibold uppercase tracking-[.14em] text-bright/60 border border-bright/30 px-1.5 py-0.5">
                          {note.coverage.source === 'stedi' ? 'Stedi' : 'Synthetic'}
                        </span>
                      </div>
                      <div className="mt-3 font-extrabold text-[22px] leading-tight tracking-tight text-bright">{note.coverage.payer}</div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-bright/90">
                        <Icon name="verified" className="text-[16px]" />
                        <span className="text-[10px] font-semibold">{note.coverage.plan_status}</span>
                      </div>
                      <div className="mt-3.5 grid grid-cols-3 gap-px bg-bright/20">
                        <div className="bg-brand p-2.5">
                          <div className="text-[7.5px] font-semibold uppercase tracking-[.14em] text-bright/60">Copay</div>
                          <div className="mt-1 font-numeral font-light text-[25px] leading-none text-bright">
                            {note.coverage.copay != null ? `$${note.coverage.copay}` : '—'}
                          </div>
                        </div>
                        <div className="bg-brand p-2.5">
                          <div className="text-[7.5px] font-semibold uppercase tracking-[.14em] text-bright/60">Deduct.</div>
                          <div className="mt-1 font-numeral font-light text-[25px] leading-none text-bright">
                            {note.coverage.deductible_remaining != null ? `$${note.coverage.deductible_remaining}` : '—'}
                          </div>
                        </div>
                        <div className="bg-brand p-2.5">
                          <div className="text-[7.5px] font-semibold uppercase tracking-[.14em] text-bright/60">Visit</div>
                          <div className="mt-1 font-numeral font-light text-[25px] leading-none text-bright">
                            ${note.coverage.estimated_visit_cost.min}–{note.coverage.estimated_visit_cost.max}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3.5 text-[12.5px] leading-relaxed text-bright/75">&ldquo;{note.coverage.spoken_summary}&rdquo;</p>
                    </div>
                  )}
                </div>
              </Row>
            )}

            {/* ── Deep research + care-option visualization ── */}
            {(note.chief_concern || note.symptoms_reported?.length) && (
              <Row icon="science" iconClass="text-brand" label="Research">
                <ResearchPanel
                  summary={[note.chief_concern, ...(note.symptoms_reported || [])].filter(Boolean).join('. ')}
                  symptoms={note.symptoms_reported || []}
                  riskFlags={note.risk_flags || []}
                  careLevel={note.care_recommendation?.care_level}
                  coverage={note.coverage ? {
                    copay: note.coverage.copay ?? null,
                    deductible_remaining: note.coverage.deductible_remaining ?? null,
                    payer: note.coverage.payer,
                  } : undefined}
                />
              </Row>
            )}

            {/* ── Peer communities (carepath layer: Reddit via Arctic Shift) ── */}
            {(note.chief_concern || note.symptoms_reported?.length) && (
              <Row icon="groups" iconClass="text-ink" label="Peers">
                <CommunitySuggestions
                  summary={[note.chief_concern, ...(note.symptoms_reported || [])].filter(Boolean).join('. ')}
                  riskFlags={note.risk_flags}
                />
              </Row>
            )}

            {/* ── SOAP note ── */}
            <Row icon="note_alt" iconClass="text-ink" label="SOAP">
              {editing ? (
                <textarea
                  value={editedNote}
                  onChange={(e) => setEditedNote(e.target.value)}
                  rows={20}
                  className="w-full bg-bright border border-line px-4 py-3 text-sm text-ink font-mono leading-relaxed focus:outline-none focus:border-brand resize-none transition-colors"
                />
              ) : (
                <div className="flex flex-col">
                  {SOAP_BLOCKS.map(({ key, letter, label, box, labelCls, rowCls }, i) => (
                    <div
                      key={key}
                      className={`grid grid-cols-[32px_1fr] gap-3.5 py-3.5 ${i > 0 ? 'border-t border-ink/12' : 'pt-0'} ${rowCls}`}
                    >
                      <span className={`w-8 h-8 flex items-center justify-center font-extrabold text-sm ${box}`}>{letter}</span>
                      <div>
                        <span className={`text-[9px] font-bold uppercase tracking-[.18em] ${labelCls}`}>{label}</span>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink/85">{note[key] || 'Not available.'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Row>

            {/* ── Ask: suggested provider questions ── */}
            <Row icon="help" iconClass="text-brand" label="Ask">
              {note.suggested_questions?.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {note.suggested_questions.map((q, i) => (
                    <div key={i} className="flex gap-3.5 items-baseline">
                      <span className="font-numeral font-light text-[26px] leading-none text-brand w-8 shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[14.5px] leading-relaxed text-ink/85">{q}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-faint">Not enough information to generate suggested questions.</p>
              )}
            </Row>

            {/* ── Next: follow-up actions ── */}
            <Row icon="checklist" iconClass="text-positive" label="Next">
              {note.follow_up_actions?.length > 0 ? (
                <TileGrid>
                  {note.follow_up_actions.map((a, i) => (
                    <Tile key={i} icon="arrow_forward" iconClass="text-positive" bold={false}>{a}</Tile>
                  ))}
                </TileGrid>
              ) : (
                <p className="text-sm italic text-faint">Not enough information to generate follow-up actions.</p>
              )}
            </Row>

            {/* ── Transcript ── */}
            <div className="border-b border-line">
              <Row icon="record_voice_over" iconClass="text-ink" label="Voice">
                <div className="flex items-center justify-between gap-3">
                  <MicroLabel>Full transcript</MicroLabel>
                  <button
                    onClick={showTranscript ? () => setShowTranscript(false) : loadTranscript}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-brand hover:text-ink transition-colors"
                  >
                    <Icon name={showTranscript ? 'visibility_off' : 'record_voice_over'} className="text-[15px]" />
                    {showTranscript ? 'Hide' : 'Show transcript'}
                  </button>
                </div>
                {showTranscript && transcriptLoading && (
                  <div className="mt-3 flex items-center gap-3 bg-bright border border-line px-4 py-5">
                    <Spinner className="w-4 h-4" />
                    <span className="text-xs font-semibold text-faint">Loading transcript…</span>
                  </div>
                )}
                {showTranscript && !transcriptLoading && transcript && (
                  <pre className="mt-3 text-xs text-body whitespace-pre-wrap leading-relaxed font-mono max-h-80 overflow-y-auto bg-bright p-4 border border-line">
                    {transcript}
                  </pre>
                )}
                {showTranscript && !transcriptLoading && !transcript && (
                  <p className="mt-3 text-sm text-faint">Transcript not available.</p>
                )}
                {!showTranscript && (
                  <p className="mt-3 text-sm text-faint">Full conversation transcript available on request.</p>
                )}
              </Row>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
