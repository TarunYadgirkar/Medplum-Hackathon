// Builds Moss history docs from the patient's real FHIR record in Medplum.
// A new Patient resource is created for every intake, so "history" means the
// most recent PRIOR patient with the same name (returning-patient match):
// their Compositions (past visit notes), AllergyIntolerances, and
// MedicationRequests. Returns [] when Medplum is unconfigured or the patient
// is new — callers fall back to demo docs so keyless mode keeps working.

import type { AllergyIntolerance, Composition, MedicationRequest, Patient } from '@medplum/fhirtypes';
import { NOTE_JSON_EXT, getMedplum, medplumConfigured } from './medplum';
import type { Note } from '@/types';

interface HistoryDoc {
  id: string;
  text: string;
  metadata?: Record<string, string>;
}

export async function buildFhirHistoryDocs(patientName: string, excludePatientId?: string): Promise<HistoryDoc[]> {
  if (!medplumConfigured()) return [];
  try {
    const medplum = await getMedplum();
    const prior = (await medplum.searchResources(
      'Patient',
      `name=${encodeURIComponent(patientName.split(/\s+/)[0])}&_sort=-_lastUpdated&_count=10`
    )) as Patient[];
    const matches = prior.filter(
      (p) => p.id !== excludePatientId && p.name?.[0]?.text?.toLowerCase() === patientName.trim().toLowerCase()
    );
    // Repeat intakes leave empty same-name Patients behind — take the newest one with real history.
    for (const match of matches) {
      const docs = await docsForPatient(match.id as string, patientName);
      if (docs.length) return docs;
    }
    return [];
  } catch (err) {
    console.error('FHIR history build failed (demo docs will be used):', err);
    return [];
  }
}

async function docsForPatient(patientId: string, patientName: string): Promise<HistoryDoc[]> {
  {
    const medplum = await getMedplum();
    const ref = `Patient/${patientId}`;
    const [compositions, allergies, meds] = await Promise.all([
      medplum.searchResources('Composition', `subject=${ref}&_sort=-date&_count=5`) as Promise<Composition[]>,
      medplum.searchResources('AllergyIntolerance', `patient=${ref}&_count=20`) as Promise<AllergyIntolerance[]>,
      medplum.searchResources('MedicationRequest', `subject=${ref}&_count=20`) as Promise<MedicationRequest[]>,
    ]);

    const docs: HistoryDoc[] = [];

    for (const comp of compositions) {
      const noteJson = comp.extension?.find((e) => e.url === NOTE_JSON_EXT)?.valueString;
      const date = comp.date?.slice(0, 10) || 'unknown date';
      if (noteJson) {
        const note = JSON.parse(noteJson) as Note;
        docs.push({
          id: `comp-${comp.id}`,
          text: `${patientName} — Visit ${date} (${note.chief_concern || 'check-in'}): ${note.ai_summary} Assessment: ${note.soap_assessment} Plan: ${note.soap_plan}`,
          metadata: { type: 'visit-note', date },
        });
      } else {
        const sections = (comp.section || [])
          .map((s) => `${s.title}: ${s.text?.div?.replace(/<[^>]+>/g, ' ').trim()}`)
          .join(' ');
        docs.push({ id: `comp-${comp.id}`, text: `${patientName} — Visit ${date}: ${sections}`, metadata: { type: 'visit-note', date } });
      }
    }

    const allergyTexts = allergies
      .map((a) => {
        const name = a.code?.text || a.code?.coding?.[0]?.display;
        const reaction = a.reaction?.[0]?.manifestation?.[0]?.text;
        return name ? `${name}${reaction ? ` (${reaction})` : ''}` : null;
      })
      .filter(Boolean);
    if (allergyTexts.length) {
      docs.push({ id: 'allergies', text: `${patientName} — Allergy list: ${allergyTexts.join('; ')}.`, metadata: { type: 'allergies' } });
    }

    const medTexts = meds
      .filter((m) => m.status === 'active')
      .map((m) => {
        const name = m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display;
        const dose = m.dosageInstruction?.[0]?.text;
        return name ? `${name}${dose ? ` — ${dose}` : ''}` : null;
      })
      .filter(Boolean);
    if (medTexts.length) {
      docs.push({ id: 'medications', text: `${patientName} — Active medications: ${medTexts.join('; ')}.`, metadata: { type: 'medications' } });
    }

    return docs;
  }
}
