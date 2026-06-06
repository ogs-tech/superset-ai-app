/** OGS brand mark for the TopNav. Inherits currentColor (Ink in light, Cream in dark). */
export function Logo({ size = 22 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden role="img">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
