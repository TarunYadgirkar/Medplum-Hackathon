'use client';

import { useState } from 'react';
import { Btn } from '@/components/primitives';
import { ConnectHealthRecordsModal } from './ConnectHealthRecordsModal';

type Props = {
  patientName?: string;
};

export function ConnectHealthRecordsButton({ patientName }: Props = {}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Btn
        variant="secondary"
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm"
        onClick={() => setIsOpen(true)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
          <path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="13" cy="13" r="2.5" className="fill-brand" />
          <path d="M13 12v2M12 13h2" stroke="white" strokeWidth="1" strokeLinecap="round" />
        </svg>
        Import from Epic MyChart
      </Btn>
      {isOpen && <ConnectHealthRecordsModal patientName={patientName} onClose={() => setIsOpen(false)} />}
    </>
  );
}
