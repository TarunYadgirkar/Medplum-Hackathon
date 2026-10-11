import type { CareLevel } from '@/types';

export interface CareLevelMeta {
  key: CareLevel;
  label: string;
  icon: string;
  activeBg: string;
  tint: string;
}

export const CARE_LEVELS: CareLevelMeta[] = [
  { key: 'self_care',      label: 'Self care',    icon: 'self_improvement', activeBg: 'bg-positive', tint: 'bg-positive/15' },
  { key: 'telehealth',     label: 'Telehealth',   icon: 'videocam',         activeBg: 'bg-positive', tint: 'bg-positive/10' },
  { key: 'primary_care',   label: 'Primary care', icon: 'stethoscope',      activeBg: 'bg-brand',    tint: 'bg-brand/10' },
  { key: 'urgent_care',    label: 'Urgent care',  icon: 'local_hospital',   activeBg: 'bg-caution',  tint: 'bg-caution/12' },
  { key: 'emergency_room', label: 'Emergency',    icon: 'emergency',        activeBg: 'bg-danger',   tint: 'bg-danger/12' },
];

export function careLevelMeta(level: CareLevel): CareLevelMeta {
  return CARE_LEVELS.find((l) => l.key === level) ?? CARE_LEVELS[2];
}
