'use client';

import { LAB_FLAG_STYLES, type EpicImportResult } from '@/data/epic-mock';

interface TimelineEvent {
  key: string;
  sortKey: number | null;
  groupLabel: string;
  dayLabel?: string;
  title: string;
  detail: string;
  dotClass: string;
  chip?: { label: string; cls: string };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const DOT = {
  encounter: 'bg-brand ring-brand-light',
  medication: 'bg-blue-500 ring-blue-100',
  allergy: 'bg-red-500 ring-red-100',
  condition: 'bg-amber-500 ring-amber-100',
  labNormal: 'bg-emerald-500 ring-emerald-100',
  labWarn: 'bg-amber-500 ring-amber-100',
  labAlert: 'bg-red-500 ring-red-100',
  immunization: 'bg-violet-500 ring-violet-100',
  upcoming: 'border-2 border-brand bg-white ring-brand-light',
} as const;

const LEGEND = [
  { label: 'Visits', dotClass: DOT.encounter },
  { label: 'Medications', dotClass: DOT.medication },
  { label: 'Allergies', dotClass: DOT.allergy },
  { label: 'Health Issues', dotClass: DOT.condition },
  { label: 'Test Results', dotClass: DOT.labNormal },
  { label: 'Immunizations', dotClass: DOT.immunization },
] as const;

function labDotClass(flag: string): string {
  if (flag === 'NORMAL') return DOT.labNormal;
  if (flag === 'HIGH' || flag === 'LOW') return DOT.labAlert;
  return DOT.labWarn;
}

interface ParsedDate {
  sortKey: number;
  groupLabel: string;
  dayLabel?: string;
}

function parseDate(raw: string): ParsedDate | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : 0;
  if (month < 1 || month > 12 || day > 31) return null;
  return {
    sortKey: year * 10000 + month * 100 + day,
    groupLabel: `${MONTHS[month - 1]} ${year}`,
    dayLabel: day > 0 ? `${MONTHS_SHORT[month - 1]} ${day}` : undefined,
  };
}

function makeEvent(
  key: string,
  rawDate: string,
  title: string,
  detail: string,
  dotClass: string,
  chip?: TimelineEvent['chip'],
): TimelineEvent {
  const parsed = parseDate(rawDate);
  return {
    key,
    sortKey: parsed?.sortKey ?? null,
    groupLabel: parsed?.groupLabel ?? 'Earlier',
    dayLabel: parsed?.dayLabel,
    title,
    detail,
    dotClass,
    chip,
  };
}

function buildEvents(record: EpicImportResult): TimelineEvent[] {
  const events = [
    ...record.recentEncounters.map((enc, i) =>
      makeEvent(`enc-${i}`, enc.date, enc.type, `${enc.provider} · ${enc.facility}`, DOT.encounter),
    ),
    ...record.labResults.map((lab, i) =>
      makeEvent(`lab-${i}`, lab.date, lab.name, lab.value, labDotClass(lab.flag), {
        label: lab.flag.replace('_', ' '),
        cls: LAB_FLAG_STYLES[lab.flag] ?? 'bg-slate-100 text-slate-500',
      }),
    ),
    ...record.medications.map((med, i) =>
      makeEvent(
        `med-${i}`,
        med.started,
        `Started ${med.name}`,
        `${med.frequency} — ${med.prescriber}`,
        DOT.medication,
      ),
    ),
    ...record.allergies.map((allergy, i) =>
      makeEvent(
        `alg-${i}`,
        allergy.recorded,
        `Allergy recorded: ${allergy.substance}`,
        `${allergy.reaction} — ${allergy.severity}`,
        DOT.allergy,
      ),
    ),
    ...record.conditions.map((cond, i) =>
      makeEvent(
        `cnd-${i}`,
        cond.diagnosed,
        `Diagnosed: ${cond.name}`,
        `${cond.icd10} · ${cond.status}`,
        DOT.condition,
      ),
    ),
    ...record.immunizations.map((imm, i) =>
      makeEvent(`imm-${i}`, imm.date, imm.name, 'Immunization', DOT.immunization),
    ),
  ];

  return [...events].sort((a, b) => {
    if (a.sortKey === null && b.sortKey === null) return 0;
    if (a.sortKey === null) return 1;
    if (b.sortKey === null) return -1;
    return b.sortKey - a.sortKey;
  });
}

interface Group {
  label: string;
  events: TimelineEvent[];
}

function groupEvents(events: TimelineEvent[]): Group[] {
  return events.reduce<Group[]>((groups, event) => {
    const last = groups[groups.length - 1];
    if (last && last.label === event.groupLabel) {
      return [...groups.slice(0, -1), { ...last, events: [...last.events, event] }];
    }
    return [...groups, { label: event.groupLabel, events: [event] }];
  }, []);
}

function buildUpcomingGroup(record: EpicImportResult): Group[] {
  if (record.upcomingVisits.length === 0) return [];
  const events = record.upcomingVisits.map((visit, i) =>
    makeEvent(`up-${i}`, visit.date, visit.type, visit.provider, DOT.upcoming),
  );
  const sorted = [...events].sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0));
  return [{ label: 'Upcoming', events: sorted }];
}

export function ChartTimeline({ record }: { record: EpicImportResult }) {
  const groups = [...buildUpcomingGroup(record), ...groupEvents(buildEvents(record))];
  if (groups.length === 0) return null;

  return (
    <div className="bg-white border border-line rounded-2xl shadow-sm p-5">
      <h2 className="font-bold text-ink">Chart Timeline</h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-faint">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${item.dotClass}`} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <div className="flex items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-faint">{group.label}</p>
              <div aria-hidden="true" className="h-px flex-1 bg-line" />
              <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-medium text-faint">
                {group.events.length}
              </span>
            </div>
            <ol className="relative mt-3 flex flex-col gap-4 pl-5">
              <span aria-hidden="true" className="absolute bottom-1 left-1 top-1 w-px bg-line" />
              {group.events.map((event) => (
                <li key={event.key} className="relative min-w-0">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full ring-[3px] ${event.dotClass}`}
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {event.dayLabel && (
                      <span className="text-xs font-medium tabular-nums text-faint">{event.dayLabel}</span>
                    )}
                    <p className="text-sm font-semibold leading-snug text-ink">{event.title}</p>
                    {event.chip && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${event.chip.cls}`}
                      >
                        {event.chip.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-body">{event.detail}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
