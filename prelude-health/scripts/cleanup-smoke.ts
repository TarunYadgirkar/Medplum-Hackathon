// Deletes "Smoke Test" patients (created by scripts/smoke.sh) and their related
// resources from Medplum so they don't clutter the dashboard on camera.
// Usage: npx tsx scripts/cleanup-smoke.ts

const BASE = process.env.MEDPLUM_BASE_URL || 'https://api.medplum.com/';

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.MEDPLUM_CLIENT_ID as string,
      client_secret: process.env.MEDPLUM_CLIENT_SECRET as string,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function main() {
  if (!process.env.MEDPLUM_CLIENT_ID) throw new Error('MEDPLUM_CLIENT_ID missing — run with env loaded');
  const token = await getToken();
  const fhir = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${BASE}fhir/R4/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`${init?.method || 'GET'} ${path} → ${res.status}: ${await res.text()}`);
    }
    return res.status === 204 ? null : res.json().catch(() => null);
  };

  const bundle = await fhir(`Patient?name=Smoke&_count=100`);
  const patients = (bundle?.entry || [])
    .map((e: { resource: { id: string; name?: { text?: string }[] } }) => e.resource)
    .filter((p: { name?: { text?: string }[] }) => p.name?.[0]?.text === 'Smoke Test');
  console.log(`Found ${patients.length} Smoke Test patient(s)`);

  for (const p of patients) {
    for (const type of ['RiskAssessment', 'Composition', 'DocumentReference', 'Encounter']) {
      const related = await fhir(`${type}?subject=Patient/${p.id}&_count=100`);
      for (const e of related?.entry || []) {
        await fhir(`${type}/${e.resource.id}`, { method: 'DELETE' });
        console.log(`  deleted ${type}/${e.resource.id}`);
      }
    }
    await fhir(`Patient/${p.id}`, { method: 'DELETE' });
    console.log(`deleted Patient/${p.id} (${p.name?.[0]?.text})`);
  }
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
