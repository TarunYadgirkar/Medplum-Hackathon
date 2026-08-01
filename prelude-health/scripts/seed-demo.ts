// Seeds 3 realistic demo patients through the real HTTP API so the provider
// dashboard has live-looking data for the demo video. Run: npx tsx scripts/seed-demo.ts

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface DemoPatient {
  name: string;
  ageRange: string;
  appointmentType: string;
  transcript: string;
  targetStatus: 'urgent_review' | 'ai_draft' | 'reviewed';
  targetRisk: 'high' | 'low' | 'medium';
}

const PATIENTS: DemoPatient[] = [
  {
    name: 'Marcus Whitfield',
    ageRange: '55-64',
    appointmentType: 'Urgent visit',
    targetStatus: 'urgent_review',
    targetRisk: 'high',
    transcript: `Agent: Hi Marcus, thanks for calling in. What brings you in today?
Patient: I've had this tightness in my chest since yesterday afternoon, and I'm getting short of breath walking up stairs.
Agent: I'm sorry to hear that. Can you describe the chest tightness — is it a pressure, a sharp pain, or something else?
Patient: It's more like pressure, kind of a squeezing feeling, right in the center of my chest.
Agent: Does it radiate anywhere, like to your arm, jaw, or back?
Patient: Yeah, actually, a little into my left arm now that you mention it.
Agent: Have you had any sweating, nausea, or dizziness along with this?
Patient: I broke into a cold sweat this morning and felt a little lightheaded.
Agent: Any history of heart problems, high blood pressure, or high cholesterol?
Patient: I have high blood pressure, been on lisinopril for about five years. My dad had a heart attack at 60.
Agent: Are you currently taking your blood pressure medication as prescribed?
Patient: Yes, every morning.
Agent: On a scale of 1 to 10, how would you rate the chest tightness right now?
Patient: Right now maybe a 6, but it spiked to an 8 a couple hours ago.
Agent: Have you taken any aspirin or nitroglycerin?
Patient: No, I don't have any nitroglycerin. I haven't taken anything.
Agent: Are you experiencing any shortness of breath right now, even at rest?
Patient: A little, yeah, it's hard to take a full deep breath.
Agent: Given what you're describing — chest pressure radiating to your arm, sweating, shortness of breath, and a family history of heart disease — this needs urgent in-person evaluation right away, not a routine visit. Have you considered calling 911 or going to the ER?
Patient: I was hoping to avoid that but I understand if that's what's needed.
Agent: I strongly recommend you or someone with you call 911 now or go directly to the nearest emergency room. I'm flagging this for immediate provider review.
Patient: Okay, my wife can drive me, we'll head to the ER now.
Agent: Please do that immediately. I'm documenting everything you've told me for the provider and the ER team.`,
  },
  {
    name: 'Priya Anand',
    ageRange: '25-34',
    appointmentType: 'Annual physical',
    targetStatus: 'ai_draft',
    targetRisk: 'low',
    transcript: `Agent: Hi Priya, welcome in. What's the reason for today's visit?
Patient: Just my annual physical, keeping up with my yearly checkup.
Agent: Great, any specific concerns you want to bring up while we're at it?
Patient: My seasonal allergies have been a bit worse this spring, some sneezing and itchy eyes, but nothing major.
Agent: How long has that been going on?
Patient: About three weeks, pretty typical for this time of year for me.
Agent: Are you taking anything for it?
Patient: Just over-the-counter Zyrtec when it gets bad, maybe twice a week.
Agent: Any other medications or supplements you're currently taking?
Patient: Just a daily multivitamin.
Agent: Any changes in weight, appetite, sleep, or energy levels since your last visit?
Patient: No, everything's been pretty stable. I've actually been sleeping better since I started exercising more.
Agent: That's great to hear. Any chest pain, shortness of breath, or heart palpitations?
Patient: No, none of that.
Agent: Any digestive issues, headaches, or other new symptoms?
Patient: Nope, feeling pretty good overall.
Agent: Do you have any known allergies to medications?
Patient: No known drug allergies.
Agent: Family history of any major conditions we should note?
Patient: My mom has type 2 diabetes, and my grandfather had high blood pressure.
Agent: Good to know, we'll keep that in mind for preventive screening. Are you due for any vaccinations, like a flu shot or Tdap booster?
Patient: I think my Tdap might be due soon, not sure exactly when I got my last one.
Agent: We'll check that during the visit and update as needed. Anything else on your mind before we wrap up?
Patient: No, I think that covers it. Thanks!
Agent: Perfect, this all sounds routine and low risk. We'll get your vitals and labs done at the visit.`,
  },
  {
    name: 'Robert Alan Chen',
    ageRange: '45-54',
    appointmentType: 'Follow-up visit',
    targetStatus: 'reviewed',
    targetRisk: 'medium',
    transcript: `Agent: Hi Robert, good to see you're checking in. What's today's follow-up about?
Patient: Following up on my type 2 diabetes, and I need a refill on my metformin.
Agent: How have your blood sugar readings been since your last visit?
Patient: Mostly in range, fasting readings around 130 to 145, but I had a couple spikes over 200 after some big meals.
Agent: Have you been taking your metformin consistently?
Patient: Yes, 1000 milligrams twice a day, though I ran out about four days ago.
Agent: Have you noticed any symptoms since running out — increased thirst, frequent urination, fatigue?
Patient: A bit more tired than usual and definitely thirstier this past week.
Agent: Any numbness or tingling in your hands or feet?
Patient: Occasionally in my feet, mostly at night, been going on a couple months.
Agent: Have you had your feet checked recently, or any wounds that aren't healing?
Patient: No open wounds, just the tingling.
Agent: Are you monitoring your blood pressure at home as well?
Patient: Yes, it's been running around 135 over 85.
Agent: Any changes to your diet or exercise routine recently?
Patient: I've been trying to walk more, about 20 minutes a day, but diet's been inconsistent with work travel.
Agent: Any chest pain, vision changes, or dizziness?
Patient: No chest pain or dizziness, vision's been fine.
Agent: When was your last A1C check?
Patient: About three months ago, it was 7.8.
Agent: Any other medications currently, besides the metformin?
Patient: Just lisinopril for blood pressure, 10 milligrams daily.
Agent: Understood. We'll get your metformin refilled and flag the foot tingling and elevated readings for the provider to review at this visit, along with scheduling a repeat A1C.
Patient: Sounds good, thank you.`,
  },
];

function assertOk(res: Response, body: unknown, label: string): void {
  if (!res.ok) {
    console.error(`FAILED ${label}: ${res.status} ${JSON.stringify(body)}`);
    process.exit(1);
  }
}

async function seedPatient(patient: DemoPatient): Promise<void> {
  console.log(`\n--- Seeding ${patient.name} (target: ${patient.targetStatus}/${patient.targetRisk}) ---`);

  const sessionRes = await fetch(`${BASE_URL}/api/intake-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientName: patient.name,
      ageRange: patient.ageRange,
      appointmentType: patient.appointmentType,
    }),
  });
  const session = await sessionRes.json();
  assertOk(sessionRes, session, 'intake-session');
  const { patientId, encounterId } = session;
  console.log(`patientId=${patientId} encounterId=${encounterId}`);

  const noteRes = await fetch(`${BASE_URL}/api/generate-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: patient.transcript,
      patientId,
      encounterId,
      patientName: patient.name,
    }),
  });
  const noteBody = await noteRes.json();
  assertOk(noteRes, noteBody, 'generate-note');
  const noteId: string = noteBody.noteId;
  const generatedRisk = noteBody.result?.risk?.level;
  console.log(`noteId=${noteId} generatedRisk=${generatedRisk}`);

  const patchRes = await fetch(`${BASE_URL}/api/notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: patient.targetStatus, riskLevel: patient.targetRisk }),
  });
  const patchBody = await patchRes.json();
  assertOk(patchRes, patchBody, 'notes PATCH');

  const verifyRes = await fetch(`${BASE_URL}/api/notes/${noteId}`);
  const verifyBody = await verifyRes.json();
  assertOk(verifyRes, verifyBody, 'notes GET verify');
  console.log(
    `FINAL ${patient.name}: patientId=${patientId} noteId=${noteId} status=${verifyBody.status} risk=${verifyBody.risk_level}`
  );
}

async function main(): Promise<void> {
  console.log(`Seeding demo data against ${BASE_URL}`);
  for (const patient of PATIENTS) {
    await seedPatient(patient);
  }

  const patientsRes = await fetch(`${BASE_URL}/api/patients`);
  const rows = await patientsRes.json();
  assertOk(patientsRes, rows, 'patients GET');
  console.log(`\nDashboard now has ${rows.length} total patient rows.`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed script crashed:', err);
  process.exit(1);
});

export {};
