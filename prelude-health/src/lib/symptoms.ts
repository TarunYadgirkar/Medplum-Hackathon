// Patient-logged symptoms stored as FHIR Observations (category `survey`),
// so the same entries the patient sees on /timeline are what the voice agent
// retrieves through lookup_patient_history.
// Falls back to an in-memory store when Medplum credentials are absent,
// matching the pattern in store.ts so `npm run dev` demos with zero config.

import type { Observation, ObservationComponent } from '@medplum/fhirtypes';
import { getMedplum, medplumConfigured } from './medplum';
import { sanitizeField } from './medcard';
import type { SymptomEntry } from '@/types';

const SURVEY_CATEGORY = 'http://terminology.hl7.org/CodeSystem/observation-category';
const LOINC = 'http://loinc.org';
const SEVERITY_LABEL = 'Symptom severity (0-10)';
const TAG_LABEL = 'Symptom tag';
const SYMPTOM_TEXT_MAX = 400;
const TAG_MAX = 40;
const PAGE_SIZE = 100;

const mem = globalThis as unknown as { __symptoms?: Map<string, SymptomEntry[]> };
if (!mem.__symptoms) mem.__symptoms = new Map();
const memdb = mem.__symptoms;
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export interface LogSymptomArgs {
  patientId: string;
  text: string;
  severity: number;
  onset?: string;
  tags?: string[];
}

function normalize(args: LogSymptomArgs): { text: string; severity: number; onset: string; tags: string[] } {
  return {
    text: sanitizeField(args.text, SYMPTOM_TEXT_MAX),
    severity: Math.min(10, Math.max(1, Math.round(args.severity))),
    onset: args.onset ? new Date(args.onset).toISOString() : new Date().toISOString(),
    tags: (args.tags ?? []).map((t) => sanitizeField(t, TAG_MAX)).filter(Boolean).slice(0, 8),
  };
}

function toComponents(severity: number, tags: string[]): ObservationComponent[] {
  return [
    {
      code: {
        coding: [{ system: LOINC, code: '72514-3', display: 'Pain severity - 0-10 verbal numeric rating [Score] - Reported' }],
        text: SEVERITY_LABEL,
      },
      valueInteger: severity,
    },
    ...tags.map((tag) => ({ code: { text: TAG_LABEL }, valueString: tag })),
  ];
}

function fromObservation(obs: Observation): SymptomEntry {
  const components = obs.component ?? [];
  const severity = components.find((c) => c.code?.text === SEVERITY_LABEL)?.valueInteger;
  return {
    id: obs.id as string,
    text: obs.valueString ?? '',
    severity: severity ?? 1,
    onset: obs.effectiveDateTime ?? obs.issued ?? new Date().toISOString(),
    tags: components.filter((c) => c.code?.text === TAG_LABEL).map((c) => c.valueString as string).filter(Boolean),
    recorded_at: obs.issued ?? obs.meta?.lastUpdated,
  };
}

export async function logSymptom(args: LogSymptomArgs): Promise<SymptomEntry> {
  const { text, severity, onset, tags } = normalize(args);
  if (!text) throw new Error('Symptom text is empty after sanitization');

  if (!medplumConfigured()) {
    const entry: SymptomEntry = { id: rid(), text, severity, onset, tags, recorded_at: new Date().toISOString() };
    memdb.set(args.patientId, [entry, ...(memdb.get(args.patientId) ?? [])]);
    return entry;
  }

  const medplum = await getMedplum();
  const observation = await medplum.createResource<Observation>({
    resourceType: 'Observation',
    status: 'final',
    category: [{ coding: [{ system: SURVEY_CATEGORY, code: 'survey', display: 'Survey' }], text: 'Patient-reported' }],
    code: { coding: [{ system: LOINC, code: '75325-1', display: 'Symptom' }], text: 'Patient-reported symptom' },
    subject: { reference: `Patient/${args.patientId}` },
    effectiveDateTime: onset,
    issued: new Date().toISOString(),
    valueString: text,
    component: toComponents(severity, tags),
  });
  return fromObservation(observation);
}

export async function listSymptoms(patientId: string): Promise<SymptomEntry[]> {
  if (!medplumConfigured()) {
    return [...(memdb.get(patientId) ?? [])].sort((a, b) => (a.onset < b.onset ? 1 : -1));
  }
  const medplum = await getMedplum();
  const results = (await medplum.searchResources(
    'Observation',
    `subject=Patient/${patientId}&category=survey&_sort=-date&_count=${PAGE_SIZE}`
  )) as Observation[];
  return results.filter((o) => o.valueString).map(fromObservation);
}

// patientId is required so one patient's id cannot delete another's entry.
export async function deleteSymptom(id: string, patientId: string): Promise<boolean> {
  if (!medplumConfigured()) {
    const entries = memdb.get(patientId) ?? [];
    const remaining = entries.filter((e) => e.id !== id);
    if (remaining.length === entries.length) return false;
    memdb.set(patientId, remaining);
    return true;
  }
  const medplum = await getMedplum();
  const observation = (await medplum.readResource('Observation', id)) as Observation;
  if (observation.subject?.reference !== `Patient/${patientId}`) return false;
  await medplum.deleteResource('Observation', id);
  return true;
}

export function daysAgoLabel(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
