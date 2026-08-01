// Server-side Medplum client using OAuth2 client credentials.
// Create a ClientApplication in your Medplum project (Project → Clients)
// and put its id/secret in .env.
import { MedplumClient } from '@medplum/core';

let client: MedplumClient | null = null;
let loginPromise: Promise<unknown> | null = null;

export function medplumConfigured(): boolean {
  return Boolean(process.env.MEDPLUM_CLIENT_ID && process.env.MEDPLUM_CLIENT_SECRET);
}

export async function getMedplum(): Promise<MedplumClient> {
  if (!client) {
    client = new MedplumClient({
      baseUrl: process.env.MEDPLUM_BASE_URL || 'https://api.medplum.com/',
      clientId: process.env.MEDPLUM_CLIENT_ID,
    });
    loginPromise = client.startClientLogin(
      process.env.MEDPLUM_CLIENT_ID as string,
      process.env.MEDPLUM_CLIENT_SECRET as string
    );
  }
  await loginPromise;
  return client;
}

export const NOTE_JSON_EXT = 'https://prelude-health.dev/fhir/StructureDefinition/note-json';
export const NOTE_STATUS_EXT = 'https://prelude-health.dev/fhir/StructureDefinition/review-status';
export const PROVIDER_NOTE_EXT = 'https://prelude-health.dev/fhir/StructureDefinition/provider-edited-note';
export const AGE_RANGE_EXT = 'https://prelude-health.dev/fhir/StructureDefinition/age-range';
