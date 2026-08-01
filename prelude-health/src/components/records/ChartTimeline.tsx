'use client';

// Restyled per the design handoff (§6c chart language): sharp corners,
// token colors only, square event dots, micro-label month headers.

import type { EpicImportResult } from '@/data/epic-mock';

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
  encounter: 'bg-brand',
  medication: 'bg-panel border border-brand',
  allergy: 'bg-danger',
  condition: 'bg-caution',
  labNormal: 'bg-positive',
  labWarn: 'bg-caution',
  labAlert: 'bg-danger',
  immunization: 'bg-panel border border-positive',
  upcoming: 'bg-bright border border-brand',
} as const;

const LAB_CHIP: Record<string, string> = {
  NORMAL: 'bg-positive/10 text-positive',
  HIGH: 'bg-danger/10 text-danger',
  LOW: 'bg-danger/10 text-danger',
};
const LAB_CHIP_WARN = 'bg-caution/15 text-caution';

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
        cls: LAB_CHIP[lab.flag] ?? LAB_CHIP_WARN,
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
    <div className="bg-panel border border-line p-5">
      <h2 className="font-extrabold text-ink">Chart Timeline</h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-faint">
            <span aria-hidden="true" className={`h-2 w-2 ${item.dotClass}`} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <div className="flex items-center gap-3.5">
              <p className="text-[9.5px] font-bold uppercase tracking-[.22em] text-faint">{group.label}</p>
              <div aria-hidden="true" className="h-px flex-1 bg-ink/20" />
              <span className="border border-ink/20 px-2 py-0.5 text-[10px] font-semibold text-body font-numeral">
                {group.events.length}
              </span>
            </div>
            <ol className="relative mt-3 flex flex-col gap-4 pl-5">
              <span aria-hidden="true" className="absolute bottom-1 left-1 top-1 w-px bg-ink/20" />
              {group.events.map((event) => (
                <li key={event.key} className="relative min-w-0">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[19px] top-1 h-2.5 w-2.5 ${event.dotClass}`}
                  />
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {event.dayLabel && (
                      <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-faint">
                        {event.dayLabel}
                      </span>
                    )}
                    <p className="text-sm font-bold leading-snug text-ink">{event.title}</p>
                    {event.chip && (
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] ${event.chip.cls}`}
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
