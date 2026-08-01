'use client';

// Provider patient chart — /dashboard/patient/[id]
// Built per the design handoff §6c (timeline), §6d (calendar + day detail),
// §6e (loading / empty / single-event states). Reads only the frozen
// contracts: GET /api/patients (PatientRow) and GET /api/notes/[id] (Note),
// plus the client-side Epic import store (localStorage) when present.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Icon, MicroLabel, Nav, RiskBadge, StatusChip } from '@/components/primitives';
import { getEpicImport, RECORDS_CHANGED_EVENT } from '@/lib/epic-import';
import type { EpicImportResult } from '@/data/epic-mock';
import type { Note, PatientRow } from '@/types';

/* ── Event model ───────────────────────────────────────────────────── */

type EventType = 'visit' | 'note' | 'lab' | 'medication' | 'allergy' | 'condition' | 'coverage';

interface ChartEvent {
  key: string;
  type: EventType;
  /** Date parts; d is null for month-precision records (e.g. "2023-02"). */
  y: number | null;
  m: number | null;
  d: number | null;
  sortKey: number | null;
  title: string;
  detail?: string;
  chip?: { label: string; cls: string };
  icon: string;
  /** Timeline square (27px) classes — background/border/text color. */
  dotCls: string;
  /** Solid 7px square color for calendar day cells. */
  calCls: string;
  link?: { href: string; label: string };
}

const TYPE_META: Record<EventType, { label: string; icon: string }> = {
  visit: { label: 'Visits', icon: 'event_available' },
  note: { label: 'Notes', icon: 'description' },
  lab: { label: 'Labs', icon: 'science' },
  medication: { label: 'Meds', icon: 'medication' },
  allergy: { label: 'Allergies', icon: 'dangerous' },
  condition: { label: 'Conditions', icon: 'monitor_heart' },
  coverage: { label: 'Coverage', icon: 'shield' },
};

const FILTER_ORDER: EventType[] = ['visit', 'note', 'lab', 'medication', 'allergy', 'condition', 'coverage'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ── Date helpers ──────────────────────────────────────────────────── */

interface DateParts { y: number; m: number; d: number | null }

function partsFromIso(raw?: string): DateParts | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
}

/** Epic-style partial dates: "2026-05-15" or "2023-02". */
function partsFromPartial(raw?: string): DateParts | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(raw.trim());
  if (!match) return null;
  const m = Number(match[2]) - 1;
  if (m < 0 || m > 11) return null;
  return { y: Number(match[1]), m, d: match[3] ? Number(match[3]) : null };
}

function sortKeyOf(p: DateParts | null): number | null {
  if (!p) return null;
  return p.y * 10000 + (p.m + 1) * 100 + (p.d ?? 0);
}

function labFlagLook(flag: string): { dotCls: string; calCls: string; chipCls: string } {
  if (flag === 'NORMAL') {
    return { dotCls: 'bg-positive text-bright', calCls: 'bg-positive', chipCls: 'bg-positive/10 text-positive' };
  }
  if (flag === 'HIGH' || flag === 'LOW') {
    return { dotCls: 'bg-danger text-bright', calCls: 'bg-danger', chipCls: 'bg-danger/10 text-danger' };
  }
  return { dotCls: 'bg-caution text-bright', calCls: 'bg-caution', chipCls: 'bg-caution/15 text-caution' };
}

/* ── Event builders ────────────────────────────────────────────────── */

function makeEvent(
  key: string,
  type: EventType,
  parts: DateParts | null,
  rest: Pick<ChartEvent, 'title' | 'detail' | 'chip' | 'icon' | 'dotCls' | 'calCls' | 'link'>,
): ChartEvent {
  return {
    key,
    type,
    y: parts?.y ?? null,
    m: parts?.m ?? null,
    d: parts?.d ?? null,
    sortKey: sortKeyOf(parts),
    ...rest,
  };
}

function buildEvents(row: PatientRow, note: Note | null, epic: EpicImportResult | null): ChartEvent[] {
  const events: ChartEvent[] = [];

  // Voice check-in / encounter — from the queue row itself.
  const visitParts = partsFromIso(row.created_at);
  if (visitParts) {
    const detail =
      row.call_status === 'completed' ? 'Charted to Medplum · Encounter finished'
      : row.call_status === 'in_progress' ? 'Check-in in progress — note will appear here when charting finishes'
      : row.call_status === 'failed' ? 'Check-in did not complete'
      : 'Awaiting voice check-in';
    events.push(makeEvent('row-visit', 'visit', visitParts, {
      title: `Voice check-in · ${row.appointment_type || 'visit'}`,
      detail,
      icon: 'mic',
      dotCls: 'bg-panel border border-brand text-brand',
      calCls: 'bg-brand',
    }));
  }

  if (note) {
    const noteParts = partsFromIso(note.created_at) ?? visitParts;

    // AI note.
    const noteDetailBits = [
      note.chief_concern,
      note.risk_level && note.risk_level !== 'none' ? `risk ${note.risk_level}` : null,
      note.care_recommendation ? `${note.care_recommendation.care_level.replace(/_/g, ' ')} suggested` : null,
    ].filter(Boolean);
    events.push(makeEvent('note', 'note', noteParts, {
      title: 'AI intake note drafted',
      detail: noteDetailBits.join(' · ') || note.ai_summary || undefined,
      chip:
        note.status === 'urgent_review' ? { label: 'Urgent', cls: 'bg-danger text-bright' }
        : note.status === 'reviewed' ? { label: 'Reviewed', cls: 'bg-positive/10 text-positive' }
        : { label: 'AI draft', cls: 'border border-brand/45 text-brand' },
      icon: 'description',
      dotCls: 'bg-ink text-bright',
      calCls: 'bg-ink',
      link: { href: `/dashboard/${note.id}`, label: 'Open note' },
    }));

    // Coverage check.
    if (note.coverage) {
      const cov = note.coverage;
      const covBits = [
        cov.plan_status,
        cov.copay !== undefined ? `$${cov.copay} copay` : null,
        cov.deductible_remaining !== undefined ? `$${cov.deductible_remaining} deductible remaining` : null,
      ].filter(Boolean);
      events.push(makeEvent('coverage', 'coverage', noteParts, {
        title: `Coverage check — ${cov.payer}`,
        detail: covBits.join(' · '),
        chip: {
          label: cov.source === 'stedi' ? 'Stedi' : 'Estimate',
          cls: 'bg-brand/10 text-brand',
        },
        icon: 'shield',
        dotCls: 'bg-brand text-bright',
        calCls: 'bg-brand',
      }));
    }

    // Risk flag.
    if (note.risk_level === 'high' || note.risk_level === 'medium') {
      const high = note.risk_level === 'high';
      events.push(makeEvent('risk', 'note', noteParts, {
        title: `Risk flagged — ${note.risk_level}`,
        detail: note.risk_flags.length > 0 ? note.risk_flags.join(' · ') : 'Flagged by intake screening',
        chip: high
          ? { label: 'High', cls: 'bg-danger text-bright' }
          : { label: 'Medium', cls: 'bg-caution/15 text-caution' },
        icon: 'warning',
        dotCls: high ? 'bg-danger text-bright' : 'bg-caution text-bright',
        calCls: high ? 'bg-danger' : 'bg-caution',
      }));
    }
  }

  // Imported records (Epic MyChart mock) — client-side store, may be absent.
  if (epic) {
    epic.recentEncounters.forEach((enc, i) => {
      events.push(makeEvent(`enc-${i}`, 'visit', partsFromPartial(enc.date), {
        title: enc.type,
        detail: `${enc.provider} · ${enc.facility}`,
        icon: /urgent/i.test(enc.type) ? 'local_hospital' : 'event_available',
        dotCls: 'bg-brand text-bright',
        calCls: 'bg-brand',
      }));
    });
    epic.labResults.forEach((lab, i) => {
      const look = labFlagLook(lab.flag);
      events.push(makeEvent(`lab-${i}`, 'lab', partsFromPartial(lab.date), {
        title: lab.name,
        detail: `${lab.value} · ${lab.reference}`,
        chip: { label: lab.flag.replace(/_/g, ' ').toLowerCase(), cls: look.chipCls },
        icon: 'science',
        dotCls: look.dotCls,
        calCls: look.calCls,
      }));
    });
    epic.medications.forEach((med, i) => {
      events.push(makeEvent(`med-${i}`, 'medication', partsFromPartial(med.started), {
        title: `Started ${med.name}`,
        detail: `${med.frequency} — ${med.prescriber}`,
        icon: 'medication',
        dotCls: 'bg-panel border border-brand text-brand',
        calCls: 'bg-brand',
      }));
    });
    epic.allergies.forEach((allergy, i) => {
      events.push(makeEvent(`alg-${i}`, 'allergy', partsFromPartial(allergy.recorded), {
        title: `Allergy recorded · ${allergy.substance}`,
        detail: `${allergy.reaction} · ${allergy.severity.toLowerCase()}`,
        icon: 'dangerous',
        dotCls: 'bg-danger text-bright',
        calCls: 'bg-danger',
      }));
    });
    epic.conditions.forEach((cond, i) => {
      events.push(makeEvent(`cnd-${i}`, 'condition', partsFromPartial(cond.diagnosed), {
        title: `Diagnosed: ${cond.name}`,
        detail: `ICD-10 ${cond.icd10}`,
        chip: { label: cond.status, cls: 'border border-caution/45 text-caution' },
        icon: 'monitor_heart',
        dotCls: 'bg-caution text-bright',
        calCls: 'bg-caution',
      }));
    });
  }

  return events.sort((a, b) => {
    if (a.sortKey === null && b.sortKey === null) return 0;
    if (a.sortKey === null) return 1;
    if (b.sortKey === null) return -1;
    return b.sortKey - a.sortKey;
  });
}

/* ── Timeline grouping ─────────────────────────────────────────────── */

interface Group {
  label: string;
  isToday: boolean;
  events: ChartEvent[];
}

function dayLabelOf(event: ChartEvent, inEarlier: boolean): string | undefined {
  if (event.y === null || event.m === null) return undefined;
  if (inEarlier) return `${MONTHS_SHORT[event.m]} ${event.y}`;
  return event.d !== null ? `${MONTHS_SHORT[event.m]} ${event.d}` : MONTHS_SHORT[event.m];
}

function groupEvents(events: ChartEvent[], today: DateParts): Group[] {
  const groups: Group[] = [];
  for (const event of events) {
    const isToday = event.y === today.y && event.m === today.m && event.d === today.d;
    const label = isToday
      ? `Today · ${MONTHS_SHORT[today.m]} ${today.d} ${today.y}`
      : event.y !== null && event.m !== null && event.y === today.y
        ? `${MONTHS[event.m]} ${event.y}`
        : 'Earlier';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(event);
    else groups.push({ label, isToday, events: [event] });
  }
  return groups;
}

/* ── Small shared pieces ───────────────────────────────────────────── */

function HeaderChip({ icon, children, tone = 'neutral' }: {
  icon: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'brandOutline';
}) {
  const cls =
    tone === 'brand' ? 'bg-brand/10 text-brand'
    : tone === 'brandOutline' ? 'border border-brand/40 text-brand'
    : 'border border-ink/20 text-body';
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold ${cls}`}>
      <Icon name={icon} className="text-[15px]" />
      {children}
    </span>
  );
}

function GroupRule({ label, count, isToday }: { label: string; count: number; isToday: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className={`text-[9.5px] font-bold uppercase tracking-[.22em] ${isToday ? 'text-danger' : 'text-faint'}`}>
        {label}
      </span>
      <span aria-hidden className={`h-px flex-1 ${isToday ? 'bg-danger/40' : 'bg-ink/20'}`} />
      <span className="border border-ink/20 px-2 py-0.5 text-[10px] font-semibold text-body font-numeral">
        {count}
      </span>
    </div>
  );
}

function EventLink({ link }: { link: NonNullable<ChartEvent['link']> }) {
  return (
    <Link
      href={link.href}
      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.1em] text-brand transition-colors hover:text-ink"
    >
      {link.label}
      <Icon name="arrow_forward" className="text-[14px]" />
    </Link>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function PatientChartPage() {
  const params = useParams<{ id: string }>();
  const patientId = params?.id;

  const [row, setRow] = useState<PatientRow | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [epic, setEpic] = useState<EpicImportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set());

  const today = useMemo<DateParts>(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/patients');
        const rows: PatientRow[] = await res.json();
        const found = rows.find((r) => r.id === patientId) ?? null;
        if (cancelled) return;
        setRow(found);
        if (found?.note_id) {
          try {
            const noteRes = await fetch(`/api/notes/${found.note_id}`);
            if (noteRes.ok) {
              const noteData: Note = await noteRes.json();
              if (!cancelled) setNote(noteData);
            }
          } catch { /* note fetch is best-effort */ }
        }
      } catch { /* keep empty state */ }
      if (!cancelled) setLoading(false);
    }
    if (patientId) void load();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [patientId]);

  useEffect(() => {
    const read = () => setEpic(getEpicImport()?.record ?? null);
    read();
    window.addEventListener(RECORDS_CHANGED_EVENT, read);
    return () => window.removeEventListener(RECORDS_CHANGED_EVENT, read);
  }, []);

  const events = useMemo(
    () => (row ? buildEvents(row, note, epic) : []),
    [row, note, epic],
  );

  const presentTypes = useMemo(
    () => FILTER_ORDER.filter((t) => events.some((e) => e.type === t)),
    [events],
  );

  const filtered = useMemo(
    () => (activeTypes.size === 0 ? events : events.filter((e) => activeTypes.has(e.type))),
    [events, activeTypes],
  );

  const groups = useMemo(() => groupEvents(filtered, today), [filtered, today]);

  const visitCount = events.filter((e) => e.type === 'visit').length;
  const lastSeen = events.find((e) => e.type === 'visit' && e.sortKey !== null);

  function toggleType(type: EventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const nav = (
    <Nav
      right={
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[11px] font-bold text-body transition-colors hover:text-ink"
          >
            <Icon name="west" className="text-[18px]" />
            Queue
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center bg-ink text-bright">
              <Icon name="stethoscope" className="text-[17px]" />
            </span>
            <span className="text-xs font-bold text-ink">Dr. Chen</span>
          </div>
        </div>
      }
    />
  );

  /* ── Loading skeleton (handoff 6e) ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        {nav}
        <main className="mx-auto w-full max-w-5xl px-6 py-8">
          <div className="border border-line bg-panel p-5">
            <div className="h-7 w-3/5 animate-pulse bg-ink/10" />
            <div className="mt-3 flex gap-1.5">
              <span className="h-4 w-16 bg-ink/10" />
              <span className="h-4 w-20 bg-ink/10" />
              <span className="h-4 w-14 bg-ink/10" />
            </div>
            <div className="relative mt-6 flex flex-col gap-4 pl-10">
              <span aria-hidden className="absolute bottom-1 left-3 top-1 w-px bg-ink/15" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="relative">
                  <span
                    className="absolute -left-10 top-0 h-6 w-6 animate-pulse bg-ink/10"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                  <div className="h-3.5 w-2/3 bg-ink/10" />
                  <div className="mt-2 h-2.5 w-2/5 bg-ink/5" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ── Empty state (handoff 6e) — no row, or a row with nothing charted ── */
  if (!row || events.length === 0) {
    return (
      <div className="min-h-screen bg-surface">
        {nav}
        <main className="mx-auto w-full max-w-5xl px-6 py-8">
          <div className="flex flex-col items-center gap-4 border border-line bg-panel px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center border border-line bg-ink/5 text-faint">
              <Icon name="folder_open" className="text-[28px]" />
            </span>
            <h1 className="text-xl font-extrabold tracking-tight text-ink">No history yet</h1>
            <p className="max-w-xs text-[13px] leading-relaxed text-body">
              Nothing charted for this patient. A voice check-in fills this in automatically.
            </p>
            <Link
              href="/intake"
              className="flex items-center gap-2 bg-ink px-5 py-3 text-[11px] font-bold text-bright transition-all duration-200 hover:[background:var(--grad-hover)]"
            >
              <Icon name="mic" className="text-[17px]" />
              Start an intake
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {nav}
      <main className="mx-auto w-full max-w-5xl px-6 pb-12 pt-7">
        {/* ── Patient header ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-start justify-between gap-6 border border-line border-t-4 border-t-brand bg-panel px-6 py-5"
        >
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{row.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {row.risk_level && <RiskBadge level={row.risk_level} />}
              {row.note_status && <StatusChip status={row.note_status} />}
              {row.age_range && <HeaderChip icon="hourglass_empty">{row.age_range}</HeaderChip>}
              <HeaderChip icon="event_repeat">
                <span className="font-numeral text-[13px] leading-none">{visitCount}</span>
                {visitCount === 1 ? 'visit' : 'visits'}
              </HeaderChip>
              {lastSeen && lastSeen.m !== null && (
                <HeaderChip icon="schedule">
                  Last seen {MONTHS_SHORT[lastSeen.m]}{lastSeen.d !== null ? ` ${lastSeen.d}` : ` ${lastSeen.y}`}
                </HeaderChip>
              )}
            </div>
          </div>
          <div className="flex flex-none gap-2.5">
            <Link
              href="/intake"
              className="flex items-center gap-2 border border-ink/40 px-4 py-3 text-[11px] font-bold text-ink transition-all duration-200 hover:bg-ink hover:text-bright"
            >
              <Icon name="add" className="text-[18px]" />
              New intake
            </Link>
            {row.note_id ? (
              <Link
                href={`/dashboard/${row.note_id}`}
                className="flex items-center gap-2 bg-ink px-5 py-3 text-[11px] font-bold text-bright transition-all duration-200 hover:[background:var(--grad-hover)]"
              >
                <Icon name="description" className="text-[18px]" />
                Open latest note
              </Link>
            ) : (
              <span className="flex items-center gap-2 bg-line px-5 py-3 text-[11px] font-bold text-faint">
                <Icon name="description" className="text-[18px]" />
                No note yet
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Allergy banner ── */}
        {epic?.allergies.map((allergy) => (
          <div
            key={allergy.substance}
            className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-1 border-l-4 border-danger bg-danger/10 px-4 py-3"
          >
            <Icon name="dangerous" className="text-[22px] text-danger" />
            <span className="text-[11px] font-bold uppercase tracking-[.1em] text-danger">
              Allergy · {allergy.substance}
            </span>
            <span className="text-[13px] text-body">
              {allergy.reaction} · {allergy.severity.toLowerCase()} · recorded {allergy.recorded}
            </span>
          </div>
        ))}

        {/* ── View toggle + filters ── */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex border border-ink/30" role="tablist" aria-label="Chart view">
            {(['timeline', 'calendar'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold transition-colors ${
                  v === 'calendar' ? 'border-l border-ink/30' : ''
                } ${view === v ? 'bg-ink text-bright' : 'text-body hover:bg-ink/10 hover:text-ink'}`}
              >
                <Icon name={v === 'timeline' ? 'timeline' : 'calendar_month'} className="text-[16px]" />
                {v === 'timeline' ? 'Timeline' : 'Calendar'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTypes(new Set())}
              className={`px-3 py-2 text-[10px] font-bold transition-colors ${
                activeTypes.size === 0
                  ? 'bg-ink text-bright'
                  : 'border border-ink/25 text-body hover:bg-ink hover:text-bright'
              }`}
            >
              All · <span className="font-numeral text-[12px]">{events.length}</span>
            </button>
            {presentTypes.map((type) => {
              const active = activeTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold transition-colors ${
                    active
                      ? 'bg-brand text-bright'
                      : 'border border-ink/25 text-body hover:bg-brand hover:text-bright'
                  }`}
                >
                  <Icon name={TYPE_META[type].icon} className="text-[14px]" />
                  {TYPE_META[type].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Views ── */}
        {view === 'timeline' ? (
          <TimelineView groups={groups} />
        ) : (
          <CalendarView events={filtered} today={today} />
        )}
      </main>
    </div>
  );
}

/* ── Timeline view (handoff 6c) ────────────────────────────────────── */

function TimelineView({ groups }: { groups: Group[] }) {
  if (groups.length === 0) {
    return (
      <div className="mt-5 border border-line bg-panel px-6 py-10 text-center text-sm text-body">
        Nothing matches these filters.
      </div>
    );
  }
  let entryIndex = 0;
  return (
    <div className="mt-5 border border-line bg-panel px-6 py-6">
      {groups.map((group, gi) => (
        <section key={group.label} aria-label={group.label} className={gi > 0 ? 'mt-7' : ''}>
          <GroupRule label={group.label} count={group.events.length} isToday={group.isToday} />
          <ol className="relative mt-4 flex flex-col gap-[18px] pl-11">
            <span aria-hidden className="absolute bottom-1.5 left-[13px] top-1.5 w-px bg-ink/20" />
            {group.events.map((event) => {
              const delay = Math.min(entryIndex++ * 0.04, 0.5);
              const inEarlier = group.label === 'Earlier';
              return (
                <motion.li
                  key={event.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut', delay }}
                  className="relative min-w-0"
                >
                  <span
                    aria-hidden
                    className={`absolute -left-11 top-0 flex h-[27px] w-[27px] items-center justify-center ${event.dotCls}`}
                  >
                    <Icon name={event.icon} className="text-[16px]" />
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {dayLabelOf(event, inEarlier) && (
                      <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-faint">
                        {dayLabelOf(event, inEarlier)}
                      </span>
                    )}
                    <span className="text-[15px] font-bold leading-snug text-ink">{event.title}</span>
                    {event.chip && (
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] ${event.chip.cls}`}>
                        {event.chip.label}
                      </span>
                    )}
                    {event.link && <EventLink link={event.link} />}
                  </div>
                  {event.detail && (
                    <p className="mt-1 text-[13px] leading-normal text-body">{event.detail}</p>
                  )}
                </motion.li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/* ── Calendar view (handoff 6d) ────────────────────────────────────── */

function CalendarView({ events, today }: { events: ChartEvent[]; today: DateParts }) {
  const [viewY, setViewY] = useState(today.y);
  const [viewM, setViewM] = useState(today.m);
  const [selected, setSelected] = useState<DateParts | null>({ ...today });

  const byDay = useMemo(() => {
    const map = new Map<string, ChartEvent[]>();
    for (const event of events) {
      if (event.y === null || event.m === null) continue;
      const key = `${event.y}-${event.m}-${event.d ?? 1}`;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const moveMonth = useCallback((delta: number) => {
    const next = new Date(viewY, viewM + delta, 1);
    setViewY(next.getFullYear());
    setViewM(next.getMonth());
  }, [viewY, viewM]);

  const selectDay = useCallback((y: number, m: number, d: number) => {
    setSelected({ y, m, d });
    setViewY(y);
    setViewM(m);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const delta = deltas[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const base = selected ?? today;
    const next = new Date(base.y, base.m, (base.d ?? 1) + delta);
    selectDay(next.getFullYear(), next.getMonth(), next.getDate());
  }, [selected, today, selectDay]);

  const firstDow = new Date(viewY, viewM, 1).getDay();
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const cellCount = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const date = new Date(viewY, viewM, i - firstDow + 1);
    return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
  });

  const selEvents = selected ? byDay.get(`${selected.y}-${selected.m}-${selected.d}`) ?? [] : [];
  const selIsToday = selected && selected.y === today.y && selected.m === today.m && selected.d === today.d;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <MicroLabel>Chart calendar</MicroLabel>
        <div className="flex items-center gap-2.5">
          <button
            aria-label="Previous month"
            onClick={() => moveMonth(-1)}
            className="flex h-9 w-9 items-center justify-center border border-ink/25 text-ink transition-colors hover:bg-ink hover:text-bright"
          >
            <Icon name="chevron_left" className="text-[18px]" />
          </button>
          <span className="min-w-[150px] text-center text-lg font-extrabold tracking-tight text-ink">
            {MONTHS[viewM]} <span className="font-numeral font-light">{viewY}</span>
          </span>
          <button
            aria-label="Next month"
            onClick={() => moveMonth(1)}
            className="flex h-9 w-9 items-center justify-center border border-ink/25 text-ink transition-colors hover:bg-ink hover:text-bright"
          >
            <Icon name="chevron_right" className="text-[18px]" />
          </button>
          <button
            onClick={() => selectDay(today.y, today.m, today.d ?? 1)}
            className="flex items-center gap-1.5 border border-ink/25 px-3.5 py-2.5 text-[10.5px] font-bold text-ink transition-colors hover:bg-ink hover:text-bright"
          >
            <Icon name="today" className="text-[16px]" />
            Today
          </button>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1fr_310px]">
        {/* Month grid */}
        <div
          tabIndex={0}
          role="grid"
          aria-label={`${MONTHS[viewM]} ${viewY}`}
          onKeyDown={onKeyDown}
          className="border border-line bg-panel outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <div className="grid grid-cols-7 border-b border-line bg-surface">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-2 text-center text-[9px] font-semibold uppercase tracking-[.18em] text-faint">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-ink/10">
            {cells.map((cell) => {
              const inMonth = cell.m === viewM;
              const isToday = cell.y === today.y && cell.m === today.m && cell.d === today.d;
              const isSelected = selected && cell.y === selected.y && cell.m === selected.m && cell.d === selected.d;
              const dayEvents = byDay.get(`${cell.y}-${cell.m}-${cell.d}`) ?? [];
              const shown = dayEvents.slice(0, 3);
              return (
                <button
                  key={`${cell.y}-${cell.m}-${cell.d}`}
                  role="gridcell"
                  tabIndex={-1}
                  aria-label={`${MONTHS[cell.m]} ${cell.d}${dayEvents.length > 0 ? `, ${dayEvents.length} events` : ''}`}
                  onClick={() => selectDay(cell.y, cell.m, cell.d)}
                  className={`flex min-h-[84px] flex-col items-start gap-1.5 p-2 text-left transition-colors ${
                    isToday
                      ? 'bg-ink'
                      : inMonth
                        ? 'bg-panel hover:bg-bright'
                        : 'bg-surface'
                  } ${isSelected && !isToday ? 'ring-2 ring-inset ring-brand' : ''} ${
                    isSelected && isToday ? 'ring-2 ring-inset ring-caution' : ''
                  }`}
                >
                  <span className="flex w-full items-center justify-between">
                    <span
                      className={`font-numeral text-[13px] leading-none ${
                        isToday ? 'font-normal text-bright' : inMonth ? 'text-ink' : 'text-ink/30'
                      }`}
                    >
                      {cell.d}
                    </span>
                    {isToday && (
                      <span className="text-[8px] font-semibold uppercase tracking-[.14em] text-bright/70">Today</span>
                    )}
                  </span>
                  {shown.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      {shown.map((event) => (
                        <span
                          key={event.key}
                          aria-hidden
                          className={`h-[7px] w-[7px] ${isToday ? 'bg-bright' : event.calCls}`}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className={`text-[9px] font-bold ${isToday ? 'text-bright/75' : 'text-body'}`}>
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                  {dayEvents.length > 0 && (
                    <span className={`text-[9px] font-semibold ${isToday ? 'text-bright/75' : 'text-faint'}`}>
                      {dayEvents.length === 1
                        ? dayEvents[0].title.length > 18
                          ? `${dayEvents[0].title.slice(0, 18)}…`
                          : dayEvents[0].title
                        : `${dayEvents.length} events`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3.5">
            <div>
              <div className="text-[15px] font-extrabold text-ink">
                {selected
                  ? `${WEEKDAYS_FULL[new Date(selected.y, selected.m, selected.d ?? 1).getDay()]}, ${MONTHS_SHORT[selected.m]} ${selected.d}`
                  : 'Pick a day'}
              </div>
              <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.16em] text-faint">
                {selected
                  ? `${selEvents.length} ${selEvents.length === 1 ? 'event' : 'events'}${selIsToday ? ' · today' : ''}`
                  : 'Click a day in the grid'}
              </div>
            </div>
            {selected && (
              <button
                aria-label="Clear selected day"
                onClick={() => setSelected(null)}
                className="flex h-7 w-7 items-center justify-center border border-ink/20 text-body transition-colors hover:border-ink hover:bg-ink hover:text-bright"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            )}
          </div>
          <div className="flex flex-col px-4 py-4">
            {selected && selEvents.length === 0 && (
              <p className="text-[13px] text-body">Nothing charted on this day.</p>
            )}
            {selEvents.map((event, i) => (
              <div
                key={event.key}
                className={`grid grid-cols-[27px_1fr] gap-3 ${i > 0 ? 'mt-3.5 border-t border-ink/10 pt-3.5' : ''}`}
              >
                <span aria-hidden className={`flex h-[27px] w-[27px] items-center justify-center ${event.dotCls}`}>
                  <Icon name={event.icon} className="text-[16px]" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-ink">{event.title}</span>
                    {event.chip && (
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] ${event.chip.cls}`}>
                        {event.chip.label}
                      </span>
                    )}
                  </div>
                  {event.detail && (
                    <p className="mt-1 text-[12.5px] leading-normal text-body">{event.detail}</p>
                  )}
                  {event.link && (
                    <div className="mt-1.5">
                      <EventLink link={event.link} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
            <Icon name="keyboard" className="text-[16px] text-faint" />
            <span className="text-[9px] font-medium uppercase tracking-[.14em] text-faint">
              Arrow keys move days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
