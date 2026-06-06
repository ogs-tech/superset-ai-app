import type { LucideIcon, LucideProps } from 'lucide-react';

interface IconProps extends Omit<LucideProps, 'ref'> {
  glyph: LucideIcon;
  size?: number;
}

/** Standardizes Lucide size (18) and stroke (1.75); colour inherits currentColor. */
export function Icon({ glyph: Glyph, size = 18, ...rest }: IconProps): React.ReactElement {
  return <Glyph size={size} strokeWidth={1.75} {...rest} />;
}
