// Data layer. Everything is stored as FHIR resources in Medplum:
//   patient        → Patient
//   intake call    → Encounter (+ DocumentReference holding the transcript)
//   AI note        → Composition (SOAP sections) + RiskAssessment
// The full structured note JSON rides on a Composition extension so the
// dashboard can rehydrate it without re-parsing narratives.
// Falls back to an in-memory store when Medplum credentials are absent,
// so `npm run dev` demos with zero configuration.

import type { Composition, DocumentReference, Encounter, Patient } from '@medplum/fhirtypes';
import { AGE_RANGE_EXT, NOTE_JSON_EXT, NOTE_STATUS_EXT, PROVIDER_NOTE_EXT, getMedplum, medplumConfigured } from './medplum';
import type { Note, NoteGenerationResult, NoteStatus, PatientRow, RiskLevel } from '@/types';

// ── In-memory fallback ──────────────────────────────────────────────
interface MemNote extends Note { }
const mem = globalThis as unknown as {
  __mem?: {
    patients: Map<string, { id: string; name: string; age_range?: string; appointment_type?: string; created_at: string; call_status: string }>;
    transcripts: Map<string, string>; // encounterId → transcript
    notes: Map<string, MemNote>;
  };
};
if (!mem.__mem) mem.__mem = { patients: new Map(), transcripts: new Map(), notes: new Map() };
const memdb = mem.__mem!;
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ── Create patient + encounter at intake start ──────────────────────
export async function createIntake(args: {
  name: string;
  ageRange?: string;
  appointmentType?: string;
}): Promise<{ patientId: string; encounterId: string }> {
  if (!medplumConfigured()) {
    const patientId = rid();
    memdb.patients.set(patientId, {
      id: patientId,
      name: args.name,
      age_range: args.ageRange,
      appointment_type: args.appointmentType,
      created_at: new Date().toISOString(),
      call_status: 'in_progress',
    });
    const encounterId = rid();
    return { patientId, encounterId };
  }

  const medplum = await getMedplum();
  const [family, ...givenParts] = args.name.trim().split(/\s+/).reverse();
  const patient = await medplum.createResource<Patient>({
    resourceType: 'Patient',
    name: [{ text: args.name, family, given: givenParts.reverse() }],
    extension: args.ageRange ? [{ url: AGE_RANGE_EXT, valueString: args.ageRange }] : undefined,
  });
  const encounter = await medplum.createResource<Encounter>({
    resourceType: 'Encounter',
    status: 'in-progress',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
    type: [{ text: args.appointmentType || 'Pre-visit voice intake' }],
    subject: { reference: `Patient/${patient.id}`, display: args.name },
    period: { start: new Date().toISOString() },
  });
  return { patientId: patient.id as string, encounterId: encounter.id as string };
}

// ── Save transcript + close the encounter ───────────────────────────
export async function completeIntake(args: { patientId: string; encounterId: string; transcript: string }): Promise<void> {
  memdb.transcripts.set(args.encounterId, args.transcript);
  if (!medplumConfigured()) {
    const p = memdb.patients.get(args.patientId);
    if (p) p.call_status = 'completed';
    return;
  }
  const medplum = await getMedplum();
  await medplum.createResource<DocumentReference>({
    resourceType: 'DocumentReference',
    status: 'current',
    type: { coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summary of episode note' }], text: 'Voice intake transcript' },
    subject: { reference: `Patient/${args.patientId}` },
    context: { encounter: [{ reference: `Encounter/${args.encounterId}` }] },
    content: [{
      attachment: {
        contentType: 'text/plain',
        data: Buffer.from(args.transcript, 'utf-8').toString('base64'),
        title: 'intake-transcript.txt',
      },
    }],
  });
  const encounter = await medplum.readResource('Encounter', args.encounterId);
  await medplum.updateResource<Encounter>({
    ...(encounter as Encounter),
    status: 'finished',
    period: { ...(encounter as Encounter).period, end: new Date().toISOString() },
  });
}

export async function getTranscript(encounterId: string): Promise<string | undefined> {
  const local = memdb.transcripts.get(encounterId);
  if (local || !medplumConfigured()) return local;
  const medplum = await getMedplum();
  const doc = await medplum.searchOne('DocumentReference', `encounter=Encounter/${encounterId}`);
  const data = doc?.content?.[0]?.attachment?.data;
  return data ? Buffer.from(data, 'base64').toString('utf-8') : undefined;
}

// ── Save the AI note as Composition + RiskAssessment ────────────────
export async function saveNote(args: {
  patientId: string;
  encounterId: string;
  result: NoteGenerationResult;
  coverage?: Note['coverage'];
}): Promise<string> {
  const status: NoteStatus = args.result.risk.urgent_provider_review ? 'urgent_review' : 'ai_draft';
  const noteData: Note = {
    id: '',
    patient_id: args.patientId,
    call_id: args.encounterId,
    ai_summary: args.result.patient_summary,
    soap_subjective: args.result.soap_note.subjective,
    soap_objective: args.result.soap_note.objective,
    soap_assessment: args.result.soap_note.assessment,
    soap_plan: args.result.soap_note.plan,
    risk_level: args.result.risk.level,
    risk_flags: args.result.risk.flags,
    suggested_questions: args.result.suggested_provider_questions,
    follow_up_actions: args.result.follow_up_actions,
    chief_concern: args.result.chief_concern,
    symptoms_reported: args.result.symptoms_reported,
    patient_goals: args.result.patient_goals,
    status,
    created_at: new Date().toISOString(),
    care_recommendation: args.result.care_recommendation,
    coverage: args.coverage,
  };

  if (!medplumConfigured()) {
    const id = rid();
    noteData.id = id;
    memdb.notes.set(id, noteData);
    return id;
  }

  const medplum = await getMedplum();
  const section = (title: string, text: string) => ({
    title,
    text: { status: 'generated' as const, div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escapeHtml(text)}</p></div>` },
  });
  const composition = await medplum.createResource<Composition>({
    resourceType: 'Composition',
    status: 'preliminary',
    type: { coding: [{ system: 'http://loinc.org', code: '11488-4', display: 'Consult note' }], text: 'Pre-visit intake note (AI draft)' },
    date: new Date().toISOString(),
    title: `Pre-visit intake — ${args.result.chief_concern || 'voice check-in'}`,
    author: [{ display: 'Prelude voice intake agent (Deepgram + Gemini)' }],
    subject: { reference: `Patient/${args.patientId}` },
    encounter: { reference: `Encounter/${args.encounterId}` },
    section: [
      section('Subjective', args.result.soap_note.subjective),
      section('Objective', args.result.soap_note.objective),
      section('Assessment', args.result.soap_note.assessment),
      section('Plan', args.result.soap_note.plan),
    ],
    extension: [
      { url: NOTE_JSON_EXT, valueString: JSON.stringify(noteData) },
      { url: NOTE_STATUS_EXT, valueString: status },
    ],
  });
  await medplum.createResource({
    resourceType: 'RiskAssessment',
    status: 'preliminary',
    subject: { reference: `Patient/${args.patientId}` },
    encounter: { reference: `Encounter/${args.encounterId}` },
    prediction: [{ outcome: { text: args.result.risk.reason || 'Intake risk screen' }, qualitativeRisk: { text: args.result.risk.level } }],
    note: args.result.risk.flags.map((f) => ({ text: f })),
  });
  return composition.id as string;
}

// ── Provider dashboard queries ──────────────────────────────────────
export async function listPatients(): Promise<PatientRow[]> {
  if (!medplumConfigured()) {
    return Array.from(memdb.patients.values())
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
      .map((p) => {
        const note = Array.from(memdb.notes.values()).find((n) => n.patient_id === p.id);
        return {
          id: p.id,
          name: p.name,
          age_range: p.age_range,
          appointment_type: p.appointment_type,
          provider_name: 'Dr. Chen',
          created_at: p.created_at,
          call_status: (p.call_status as PatientRow['call_status']) || 'pending',
          note_id: note?.id,
          note_status: note?.status,
          risk_level: note?.risk_level,
        };
      });
  }

  const medplum = await getMedplum();
  const patients = await medplum.searchResources('Patient', '_sort=-_lastUpdated&_count=50');
  const compositions = await medplum.searchResources('Composition', '_sort=-_lastUpdated&_count=100');
  const encounters = await medplum.searchResources('Encounter', '_sort=-_lastUpdated&_count=100');

  return patients.map((p) => {
    const ref = `Patient/${p.id}`;
    const comp = compositions.find((c) => c.subject?.reference === ref);
    const enc = encounters.find((e) => e.subject?.reference === ref);
    const noteJson = comp?.extension?.find((e) => e.url === NOTE_JSON_EXT)?.valueString;
    const note: Note | undefined = noteJson ? (JSON.parse(noteJson) as Note) : undefined;
    const noteStatus = (comp?.extension?.find((e) => e.url === NOTE_STATUS_EXT)?.valueString as NoteStatus) || note?.status;
    return {
      id: p.id as string,
      name: p.name?.[0]?.text || [p.name?.[0]?.given?.join(' '), p.name?.[0]?.family].filter(Boolean).join(' ') || 'Unknown',
      age_range: p.extension?.find((e) => e.url === AGE_RANGE_EXT)?.valueString,
      appointment_type: enc?.type?.[0]?.text,
      provider_name: 'Dr. Chen',
      created_at: p.meta?.lastUpdated,
      call_status: enc?.status === 'finished' ? 'completed' : enc?.status === 'in-progress' ? 'in_progress' : 'pending',
      note_id: comp?.id,
      note_status: noteStatus,
      risk_level: note?.risk_level,
    };
  });
}

export async function getNote(id: string): Promise<Note | undefined> {
  if (!medplumConfigured()) return memdb.notes.get(id);
  const medplum = await getMedplum();
  const comp = (await medplum.readResource('Composition', id)) as Composition;
  const noteJson = comp.extension?.find((e) => e.url === NOTE_JSON_EXT)?.valueString;
  if (!noteJson) return undefined;
  const note = JSON.parse(noteJson) as Note;
  note.id = id;
  note.status = (comp.extension?.find((e) => e.url === NOTE_STATUS_EXT)?.valueString as NoteStatus) || note.status;
  note.provider_edited_note = comp.extension?.find((e) => e.url === PROVIDER_NOTE_EXT)?.valueString;
  return note;
}

export async function updateNote(
  id: string,
  patch: { status: NoteStatus; providerEditedNote?: string; riskLevel?: RiskLevel }
): Promise<Note | undefined> {
  if (!medplumConfigured()) {
    const note = memdb.notes.get(id);
    if (!note) return undefined;
    note.status = patch.status;
    if (patch.providerEditedNote != null) note.provider_edited_note = patch.providerEditedNote;
    if (patch.riskLevel) note.risk_level = patch.riskLevel;
    note.reviewed_at = new Date().toISOString();
    return note;
  }
  const medplum = await getMedplum();
  const comp = (await medplum.readResource('Composition', id)) as Composition;
  const others = (comp.extension || []).filter((e) => ![NOTE_STATUS_EXT, PROVIDER_NOTE_EXT].includes(e.url as string));
  const noteJsonExt = others.find((e) => e.url === NOTE_JSON_EXT);
  if (noteJsonExt?.valueString && patch.riskLevel) {
    const parsed = JSON.parse(noteJsonExt.valueString) as Note;
    parsed.risk_level = patch.riskLevel;
    noteJsonExt.valueString = JSON.stringify(parsed);
  }
  await medplum.updateResource<Composition>({
    ...comp,
    status: patch.status === 'reviewed' ? 'final' : 'preliminary',
    extension: [
      ...others,
      { url: NOTE_STATUS_EXT, valueString: patch.status },
      ...(patch.providerEditedNote != null ? [{ url: PROVIDER_NOTE_EXT, valueString: patch.providerEditedNote }] : []),
    ],
  });
  return getNote(id);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
