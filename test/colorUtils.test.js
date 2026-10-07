import { describe, it, expect } from 'vitest';
import { withAlpha } from '../src/utils/colorUtils';
import { colorSchemes, darkColorSchemes } from '../src/constants/graphConstants';

describe('withAlpha', () => {
  it('converts rgb() and rgba() colors', () => {
    expect(withAlpha('rgb(59, 130, 246)', 0.3)).toBe('rgba(59, 130, 246, 0.3)');
    expect(withAlpha('rgba(59,130,246,1)', 0.5)).toBe('rgba(59, 130, 246, 0.5)');
  });

  it('converts six-digit hex colors', () => {
    expect(withAlpha('#3B82F6', 0.25)).toBe('rgba(59, 130, 246, 0.25)');
  });

  it('refuses colors it cannot convert rather than emit invalid CSS', () => {
    expect(() => withAlpha('white', 0.5)).toThrow(/unsupported/);
  });

  // NodeComponent builds the root and current glows from these two colors.
  it('handles every scheme color the node glows use', () => {
    for (const scheme of [...Object.values(colorSchemes), ...Object.values(darkColorSchemes)]) {
      expect(() => withAlpha(scheme.primary, 0.3)).not.toThrow();
      expect(() => withAlpha(scheme.rootBorder, 0.3)).not.toThrow();
      expect(scheme.glow).toEqual(expect.objectContaining({ rest: expect.any(Number), halo: expect.any(Number), ring: expect.any(Number) }));
    }
  });
});
