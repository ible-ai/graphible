import { describe, it, expect } from 'vitest';
import {
  worldToScreen,
  screenToWorld,
  getViewportBounds,
  isWorldPointVisible,
  depthToScalar,
  calculateNodePosition,
  getMinimapBounds,
  applyForceDirectedLayout,
} from '../src/utils/coordinateUtils';
import { RAD_PER_DEPTH } from '../src/constants/graphConstants';

// test/setup.js pins jsdom to 1024x768.
const CENTER = { x: 512, y: 384 };

describe('world <-> screen', () => {
  it('maps the world origin to the viewport centre at the identity camera', () => {
    expect(worldToScreen(0, 0)).toEqual(CENTER);
  });

  it('round-trips through every camera it is given', () => {
    const cameras = [
      { x: 0, y: 0, zoom: 1 },
      { x: 120, y: -80, zoom: 1 },
      { x: 0, y: 0, zoom: 2.5 },
      { x: -300, y: 210, zoom: 0.35 },
    ];

    for (const camera of cameras) {
      for (const point of [[0, 0], [640, -480], [-1234.5, 987.25]]) {
        const screen = worldToScreen(point[0], point[1], camera);
        const back = screenToWorld(screen.x, screen.y, camera);
        expect(back.x).toBeCloseTo(point[0], 6);
        expect(back.y).toBeCloseTo(point[1], 6);
      }
    }
  });

  it('scales distances by zoom', () => {
    const near = worldToScreen(100, 0, { x: 0, y: 0, zoom: 1 });
    const far = worldToScreen(100, 0, { x: 0, y: 0, zoom: 2 });
    expect(near.x - CENTER.x).toBe(100);
    expect(far.x - CENTER.x).toBe(200);
  });
});

describe('viewport helpers', () => {
  it('reports a viewport that shrinks in world units as zoom increases', () => {
    const wide = getViewportBounds({ x: 0, y: 0, zoom: 0.5 });
    const tight = getViewportBounds({ x: 0, y: 0, zoom: 2 });
    expect(wide.width).toBeGreaterThan(tight.width);
    expect(wide.width).toBe(1024 / 0.5);
  });

  it('decides visibility against those bounds, honouring the margin', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    expect(isWorldPointVisible(0, 0, camera)).toBe(true);
    expect(isWorldPointVisible(10_000, 0, camera)).toBe(false);
    expect(isWorldPointVisible(520, 0, camera)).toBe(false);
    expect(isWorldPointVisible(520, 0, camera, 100)).toBe(true);
  });
});

describe('depthToScalar', () => {
  it('rotates by RAD_PER_DEPTH per level and returns a unit vector', () => {
    for (let depth = 0; depth < 8; depth++) {
      const { x, y } = depthToScalar(depth);
      expect(Math.hypot(x, y)).toBeCloseTo(1, 10);
      expect(x).toBeCloseTo(Math.sin(depth * RAD_PER_DEPTH + Math.PI), 10);
    }
  });

  it('comes full circle after six levels, which is what makes branches distinct', () => {
    expect(RAD_PER_DEPTH * 6).toBeCloseTo(2 * Math.PI, 10);
    const start = depthToScalar(0);
    const wrapped = depthToScalar(6);
    expect(wrapped.x).toBeCloseTo(start.x, 10);
    expect(wrapped.y).toBeCloseTo(start.y, 10);
  });

  it('sends successive depths in different directions', () => {
    const a = depthToScalar(0);
    const b = depthToScalar(1);
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeGreaterThan(0.1);
  });
});

describe('calculateNodePosition', () => {
  it('places the first node of depth 0 at the world origin', () => {
    expect(calculateNodePosition('content', 'description', [], 0)).toEqual({ worldX: 0, worldY: 0 });
  });

  it('returns finite coordinates for every depth', () => {
    for (let depth = 0; depth < 6; depth++) {
      const pos = calculateNodePosition('content', 'description', [], depth);
      expect(Number.isFinite(pos.worldX)).toBe(true);
      expect(Number.isFinite(pos.worldY)).toBe(true);
    }
  });

  it('offsets each sibling from the first, so they do not stack', () => {
    const first = { id: 0, worldX: 0, worldY: 0 };
    const a = calculateNodePosition('c', 'd', [first], 1);
    const b = calculateNodePosition('c', 'd', [first, { id: 1, ...a }], 1);
    expect(a).not.toEqual(b);
  });
});

describe('getMinimapBounds', () => {
  it('falls back to a fixed frame when there are no nodes', () => {
    expect(getMinimapBounds([])).toEqual({ minX: -400, maxX: 400, minY: -300, maxY: 300 });
  });

  it('encloses every node with padding', () => {
    const bounds = getMinimapBounds([
      { worldX: -100, worldY: -50 },
      { worldX: 300, worldY: 250 },
    ]);
    expect(bounds.minX).toBeLessThan(-100);
    expect(bounds.maxX).toBeGreaterThan(300);
    expect(bounds.minY).toBeLessThan(-50);
    expect(bounds.maxY).toBeGreaterThan(250);
  });
});

describe('applyForceDirectedLayout', () => {
  const nodes = [
    { id: 0, worldX: 0, worldY: 0, label: 'a' },
    { id: 1, worldX: 10, worldY: 10, label: 'b' },
    { id: 2, worldX: -10, worldY: 5, label: 'c' },
  ];
  const connections = [{ from: 0, to: 1 }, { from: 0, to: 2 }];

  it('returns one finite, non-overlapping position per node', () => {
    const out = applyForceDirectedLayout(nodes, connections, { iterations: 50 });
    expect(out).toHaveLength(3);
    for (const n of out) {
      expect(Number.isFinite(n.worldX)).toBe(true);
      expect(Number.isFinite(n.worldY)).toBe(true);
    }
    const seen = new Set(out.map((n) => `${n.worldX},${n.worldY}`));
    expect(seen.size).toBe(3);
  });

  it('preserves node identity and every other field', () => {
    const out = applyForceDirectedLayout(nodes, connections, { iterations: 10 });
    expect(out.map((n) => n.id)).toEqual([0, 1, 2]);
    expect(out.map((n) => n.label)).toEqual(['a', 'b', 'c']);
  });

  it('handles an empty graph', () => {
    expect(applyForceDirectedLayout([], [])).toEqual([]);
  });
});
