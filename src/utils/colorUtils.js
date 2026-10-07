// Scheme colors are written as rgb() in some places and hex in others.
// Appending a hex alpha ("rgb(59, 130, 246)40") is invalid CSS, and the
// browser drops the whole declaration it appears in, which is how the root
// and current node glows went missing. This converts either notation to rgba.

export const withAlpha = (color, alpha) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;

  throw new Error(`withAlpha: unsupported color "${color}"`);
};
