// Severity reads as size plus colour, never a "7/10" label.
const MIN_PX = 9;
const MAX_PX = 26;

function severityColor(severity: number): string {
  if (severity >= 7) return 'var(--color-danger)';
  if (severity >= 4) return 'var(--color-caution)';
  return 'var(--color-positive)';
}

export function SeverityMark({ severity, title }: { severity: number; title?: string }) {
  const size = MIN_PX + ((Math.min(10, Math.max(1, severity)) - 1) / 9) * (MAX_PX - MIN_PX);
  return (
    <span
      role="img"
      aria-label={title ?? `Severity ${severity} out of 10`}
      className="inline-block shrink-0 transition-all duration-200"
      style={{ width: size, height: size, background: severityColor(severity) }}
    />
  );
}
