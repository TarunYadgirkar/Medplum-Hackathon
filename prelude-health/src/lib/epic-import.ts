import { EPIC_FHIR_MOCK, type EpicImportResult } from '@/data/epic-mock';

export interface EpicImportState {
  connected: boolean;
  systemId: string;
  systemName: string;
  importedAt: string;
  record: EpicImportResult;
}

const EPIC_IMPORT_KEY = 'prelude-epic-import';

const FIELD_MAX_LEN = 200;
// Defuse role markers so imported text can't steer the voice prompt.
const ROLE_MARKER_RE = /\b(system|user|assistant|ignore\s+previous)\s*:/gi;

function sanitizeField(value: string): string {
  return value
    .replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ')
    .replace(ROLE_MARKER_RE, (m) => m.replace(':', '​:'))
    .trim()
    .slice(0, FIELD_MAX_LEN);
}

export const RECORDS_CHANGED_EVENT = 'prelude:records-changed';

function notifyRecordsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(RECORDS_CHANGED_EVENT));
  }
}

export function getEpicImport(): EpicImportState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(EPIC_IMPORT_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== 'object' || parsed === null ||
      !('record' in parsed) || typeof (parsed as { record: unknown }).record !== 'object' ||
      !Array.isArray((parsed as EpicImportState).record?.medications) ||
      !Array.isArray((parsed as EpicImportState).record?.allergies)
    ) {
      return null;
    }
    return parsed as EpicImportState;
  } catch {
    return null;
  }
}

export function saveEpicImport(systemId: string, systemName: string): EpicImportState {
  const state: EpicImportState = {
    connected: true,
    systemId,
    systemName,
    importedAt: new Date().toISOString(),
    record: EPIC_FHIR_MOCK,
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(EPIC_IMPORT_KEY, JSON.stringify(state));
    notifyRecordsChanged();
  }
  return state;
}

export function clearEpicImport(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(EPIC_IMPORT_KEY);
  notifyRecordsChanged();
}

export function buildEpicContext(): string | null {
  // try/catch: a stale localStorage entry from an older build can have a
  // different shape — a throw here would kill the voice-call start path.
  try {
    const state = getEpicImport();
    if (!state) return null;
    const { record } = state;
    const systemName = sanitizeField(state.systemName);
    const meds = record.medications
      .map((m) => `${sanitizeField(m.name)} (${sanitizeField(m.frequency)})`)
      .join(', ');
    const allergies = record.allergies
      .map((a) => `${sanitizeField(a.substance)} (${sanitizeField(a.reaction)}, ${sanitizeField(a.severity)})`)
      .join(', ');
    const conditions = record.conditions
      .map((c) => `${sanitizeField(c.name)} (${sanitizeField(c.status)})`)
      .join(', ');
    const labs = record.labResults
      .map((l) => `${sanitizeField(l.name)}: ${sanitizeField(l.value)} (${sanitizeField(l.flag)})`)
      .join(', ');
    return `\n\nThe patient connected their health records from ${systemName}. On file: Medications: ${meds}. Allergies: ${allergies}. Conditions: ${conditions}. Recent labs: ${labs}. Use this context — they don't need to repeat themselves.`;
  } catch {
    return null;
  }
}

export function getImportedHistoryDocs(): { text: string }[] | null {
  try {
    const state = getEpicImport();
    if (!state) return null;
    const { record } = state;
    const name = sanitizeField(record.patient.name);
    const docs: { text: string }[] = [
      {
        text: `${name} — Active medications: ${record.medications
          .map((m) => `${sanitizeField(m.name)}, ${sanitizeField(m.frequency)} (started ${sanitizeField(m.started)})`)
          .join('; ')}.`,
      },
      {
        text: `${name} — Allergy list: ${record.allergies
          .map((a) => `${sanitizeField(a.substance)} (${sanitizeField(a.reaction)}, ${sanitizeField(a.severity)}, recorded ${sanitizeField(a.recorded)})`)
          .join('; ')}.`,
      },
      {
        text: `${name} — Active conditions: ${record.conditions
          .map((c) => `${sanitizeField(c.name)} (${sanitizeField(c.icd10)}, ${sanitizeField(c.status)}, diagnosed ${sanitizeField(c.diagnosed)})`)
          .join('; ')}.`,
      },
      {
        text: `${name} — Recent labs: ${record.labResults
          .map((l) => `${sanitizeField(l.name)} ${sanitizeField(l.value)} on ${sanitizeField(l.date)} (${sanitizeField(l.flag)})`)
          .join('; ')}.`,
      },
      ...record.recentEncounters.map((e) => ({
        text: `${name} — Visit ${sanitizeField(e.date)}: ${sanitizeField(e.type)} with ${sanitizeField(e.provider)} at ${sanitizeField(e.facility)}.`,
      })),
    ];
    return docs;
  } catch {
    return null;
  }
}
