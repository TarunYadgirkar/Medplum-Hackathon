// Moss (moss.dev) — sub-10ms semantic retrieval over the patient's history.
// The voice agent calls lookup_patient_history mid-conversation; Moss answers
// fast enough that the agent never has to stall ("let me look that up...").
// Falls back to keyword search when MOSS_PROJECT_ID/KEY are not set.

interface HistoryDoc {
  id: string;
  text: string;
  metadata?: Record<string, string>;
}

// In-memory copy of every indexed doc, used both for the keyword fallback
// and so the demo works with zero keys configured.
const globalDocs = globalThis as unknown as { __prelude_history?: Map<string, HistoryDoc[]> };
if (!globalDocs.__prelude_history) globalDocs.__prelude_history = new Map();

function mossConfigured(): boolean {
  return Boolean(process.env.MOSS_PROJECT_ID && process.env.MOSS_PROJECT_KEY);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let mossClient: any = null;
async function getMoss(): Promise<any> {
  if (!mossClient) {
    const { MossClient } = await import('@moss-dev/moss');
    mossClient = new MossClient(process.env.MOSS_PROJECT_ID as string, process.env.MOSS_PROJECT_KEY as string);
  }
  return mossClient;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const indexName = (patientId: string) => `patient-${patientId.replace(/[^a-zA-Z0-9-]/g, '')}`.slice(0, 60);

export async function indexPatientHistory(patientId: string, docs: HistoryDoc[]): Promise<void> {
  globalDocs.__prelude_history!.set(patientId, docs);
  if (!mossConfigured()) return;
  try {
    const client = await getMoss();
    await client.createIndex(indexName(patientId), docs, { modelId: 'moss-minilm' });
    await client.loadIndex(indexName(patientId));
  } catch (err) {
    console.error('Moss indexing failed (fallback search will be used):', err);
  }
}

export async function queryPatientHistory(
  patientId: string,
  query: string,
  topK = 3
): Promise<{ source: 'moss' | 'fallback'; results: { text: string; score?: number }[] }> {
  if (mossConfigured()) {
    try {
      const client = await getMoss();
      const results = await client.query(indexName(patientId), query, { topK });
      return {
        source: 'moss',
        results: (results || []).map((r: { text: string; score?: number }) => ({ text: r.text, score: r.score })),
      };
    } catch (err) {
      console.error('Moss query failed, using keyword fallback:', err);
    }
  }
  // Keyword fallback
  const docs = globalDocs.__prelude_history!.get(patientId) || [];
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
  const scored = docs
    .map((d) => ({
      text: d.text,
      score: terms.filter((t) => d.text.toLowerCase().includes(t)).length,
    }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return { source: 'fallback', results: scored.length ? scored : docs.slice(0, topK).map((d) => ({ text: d.text })) };
}

// Demo history seeded for every new intake so the agent always has something
// to retrieve. In a real deployment this would be built from the patient's
// FHIR record (prior Compositions, MedicationRequests, AllergyIntolerances).
export function demoHistoryDocs(patientName: string): HistoryDoc[] {
  return [
    { id: 'h1', text: `${patientName} — Visit 2025-11-03: Presented with an itchy raised rash on the left forearm after hiking. Assessed as probable contact dermatitis. Prescribed triamcinolone 0.1% cream. Resolved in two weeks.` },
    { id: 'h2', text: `${patientName} — Allergy list: Penicillin (hives, documented 2019). No food allergies on record.` },
    { id: 'h3', text: `${patientName} — Active medications: Loratadine 10mg daily as needed for seasonal allergies. Melatonin occasionally for sleep.` },
    { id: 'h4', text: `${patientName} — Visit 2026-02-14: Annual physical. BP 118/76, BMI 23.4. Labs unremarkable. Patient mentioned intermittent trouble sleeping during exam periods.` },
    { id: 'h5', text: `${patientName} — Family history: Father with type 2 diabetes. Mother with hypothyroidism.` },
  ];
}
