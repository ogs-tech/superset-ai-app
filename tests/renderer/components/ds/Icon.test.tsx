import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { House } from 'lucide-react';
import { Icon } from '../../../../src/renderer/components/ds/Icon.js';

describe('Icon', () => {
  it('renders the given Lucide glyph with default stroke + size', () => {
    const { container } = render(<Icon glyph={House} aria-label="início" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('stroke-width', '1.75');
  });
});
