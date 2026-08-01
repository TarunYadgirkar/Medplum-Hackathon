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
// and so the demo works with zero keys configured. Also tracks the in-flight
// Moss index build per patient so queries can tell "building" from "missing".
const g = globalThis as unknown as {
  __prelude_history?: Map<string, HistoryDoc[]>;
  __prelude_moss_jobs?: Map<string, Promise<boolean>>;
};
if (!g.__prelude_history) g.__prelude_history = new Map();
if (!g.__prelude_moss_jobs) g.__prelude_moss_jobs = new Map();

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

// Builds (or rebuilds) the Moss index for a patient. createIndex polls until
// the index is queryable, so when this resolves true the index is live.
// If the index already exists (SDK throws), upsert the docs instead.
async function buildMossIndex(patientId: string, docs: HistoryDoc[]): Promise<boolean> {
  const client = await getMoss();
  const name = indexName(patientId);
  try {
    await client.createIndex(name, docs, { modelId: 'moss-minilm' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists/i.test(msg)) {
      await client.addDocs(name, docs, { upsert: true });
    } else {
      throw err;
    }
  }
  // Load into memory for ~1-10ms local queries (query() would otherwise hit
  // the cloud endpoint — still correct, just slower). Non-fatal if it fails.
  try {
    await client.loadIndex(name);
  } catch (err) {
    console.warn('Moss loadIndex failed (queries fall back to cloud endpoint):', err);
  }
  return true;
}

// Kicks off the index build WITHOUT blocking the caller — intake-session must
// return fast so the voice call can start. The job promise is tracked so
// queryPatientHistory can await a nearly-done build or lazily re-kick a failed one.
export async function indexPatientHistory(patientId: string, docs: HistoryDoc[]): Promise<void> {
  g.__prelude_history!.set(patientId, docs);
  if (!mossConfigured()) return;
  const job = buildMossIndex(patientId, docs).catch((err) => {
    console.error('Moss indexing failed (fallback search will be used):', err);
    // Drop the failed job so a later query lazily re-kicks the build.
    g.__prelude_moss_jobs!.delete(patientId);
    return false;
  });
  g.__prelude_moss_jobs!.set(patientId, job);
}

export async function queryPatientHistory(
  patientId: string,
  query: string,
  topK = 3
): Promise<{ source: 'moss' | 'fallback'; results: { text: string; score?: number }[] }> {
  if (mossConfigured()) {
    try {
      // If the index build is still in flight, give it a moment to finish —
      // but never stall the voice agent for more than ~2.5s.
      const job = g.__prelude_moss_jobs!.get(patientId);
      let ready = true;
      if (job) {
        ready = await Promise.race([job, new Promise<boolean>((r) => setTimeout(() => r(false), 2500))]);
      } else {
        // No tracked job (e.g. server restarted): lazily re-index from the
        // in-memory docs if we have them, then fall back for this query.
        const docs = g.__prelude_history!.get(patientId);
        if (docs?.length) {
          void indexPatientHistory(patientId, docs);
          ready = false;
        }
      }
      if (ready) {
        const client = await getMoss();
        const res = await client.query(indexName(patientId), query, { topK });
        const docs = Array.isArray(res?.docs) ? res.docs : [];
        return {
          source: 'moss',
          results: docs.map((d: { text: string; score?: number }) => ({ text: d.text, score: d.score })),
        };
      }
    } catch (err) {
      console.error('Moss query failed, using keyword fallback:', err);
      // Lazy re-index for the next query if the index vanished server-side.
      const docs = g.__prelude_history!.get(patientId);
      if (docs?.length && !g.__prelude_moss_jobs!.get(patientId)) {
        void indexPatientHistory(patientId, docs);
      }
    }
  }
  // Keyword fallback
  const docs = g.__prelude_history!.get(patientId) || [];
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
