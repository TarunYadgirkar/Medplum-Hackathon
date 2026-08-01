// Domain types. Extends the shapes from klarity-voicenote with the
// care-navigation layer from carepath (care level + cost + coverage).

export interface PatientRow {
  id: string;
  name: string;
  age_range?: string;
  appointment_type?: string;
  provider_name?: string;
  created_at?: string;
  call_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  note_id?: string;
  note_status?: NoteStatus;
  risk_level?: RiskLevel;
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';
export type NoteStatus = 'ai_draft' | 'reviewed' | 'urgent_review';
export type CareLevel = 'self_care' | 'telehealth' | 'primary_care' | 'urgent_care' | 'emergency_room';

export interface CareRecommendation {
  care_level: CareLevel;
  confidence: number; // 0-1
  reasoning: string;
  red_flags_to_watch: string[];
}

export interface CoverageSummary {
  source: 'stedi' | 'synthetic';
  payer: string;
  plan_status: string;
  copay?: number;
  coinsurance_percent?: number;
  deductible_remaining?: number;
  estimated_visit_cost: { min: number; max: number };
  spoken_summary: string;
}

export interface NoteGenerationResult {
  patient_summary: string;
  chief_concern: string;
  symptoms_reported: string[];
  history_of_present_illness: string;
  medication_mentions: string;
  prior_care: string;
  patient_goals: string[];
  soap_note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  risk: {
    level: RiskLevel;
    flags: string[];
    urgent_provider_review: boolean;
    reason: string;
  };
  care_recommendation: CareRecommendation;
  suggested_provider_questions: string[];
  follow_up_actions: string[];
  missing_information: string[];
}

// Flat note shape consumed by the provider dashboard (klarity contract).
export interface Note {
  id: string;
  patient_id: string;
  call_id: string; // Encounter id
  ai_summary?: string;
  soap_subjective?: string;
  soap_objective?: string;
  soap_assessment?: string;
  soap_plan?: string;
  risk_level: RiskLevel;
  risk_flags: string[];
  suggested_questions: string[];
  follow_up_actions: string[];
  chief_concern?: string;
  symptoms_reported: string[];
  patient_goals: string[];
  status: NoteStatus;
  provider_edited_note?: string;
  reviewed_at?: string;
  created_at?: string;
  care_recommendation?: CareRecommendation;
  coverage?: CoverageSummary;
}

export interface TranscriptUtterance {
  role: 'agent' | 'user';
  content: string;
}
