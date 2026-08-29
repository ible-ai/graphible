import { describe, it, expect } from 'vitest';
import { applyClustering, getClusterColor, clusteringLogic } from '../src/utils/clusteringUtils';

// Only the algorithms that need no embedding model are exercised here;
// `semantic` downloads MiniLM on first use and belongs in an integration run.
const mk = (id, over = {}) => ({
  id,
  label: `Node ${id}`,
  description: 'd',
  content: 'c',
  type: 'concept',
  worldX: 0,
  worldY: 0,
  depth: 0,
  batchId: 0,
  createdAt: Date.now(),
  ...over,
});

describe('applyClustering', () => {
  it('exposes exactly the four algorithms the minimap dropdown offers', () => {
    expect(Object.keys(clusteringLogic).sort()).toEqual(
      ['hierarchical', 'semantic', 'spatial', 'temporal']
    );
  });

  it('returns nothing for "none" or an empty graph', async () => {
    expect(await applyClustering([mk(0)], [], 'none')).toEqual({ clusters: [], showClusters: false });
    expect(await applyClustering([], [], 'temporal')).toEqual({ clusters: [], showClusters: false });
  });

  it('falls back rather than throwing on an unknown algorithm', async () => {
    const out = await applyClustering([mk(0)], [], 'nonsense');
    expect(out).toEqual({ clusters: [], showClusters: false });
  });

  it('groups by batchId under "temporal", covering every node exactly once', async () => {
    const nodes = [mk(0), mk(1), mk(2, { batchId: 1 }), mk(3, { batchId: 1 }), mk(4, { batchId: 2 })];
    const { clusters } = await applyClustering(nodes, [], 'temporal');

    expect(clusters).toHaveLength(3);
    const ids = clusters.flatMap((c) => c.nodes.map((n) => n.id)).sort((a, b) => a - b);
    expect(ids).toEqual([0, 1, 2, 3, 4]);
    for (const c of clusters) expect(typeof c.label).toBe('string');
  });

  it('groups by proximity under "spatial" and drops lone nodes', async () => {
    const nodes = [
      mk(0, { worldX: 0, worldY: 0 }),
      mk(1, { worldX: 50, worldY: 50 }),
      mk(2, { worldX: 9000, worldY: 9000 }), // far away, and alone
    ];
    const { clusters } = await applyClustering(nodes, [], 'spatial');

    const clustered = clusters.flatMap((c) => c.nodes.map((n) => n.id));
    expect(clustered).toContain(0);
    expect(clustered).toContain(1);
    // spatial sets showSingleNodes: false, so the isolated node is filtered out
    expect(clustered).not.toContain(2);
  });

  it('groups by depth under "hierarchical"', async () => {
    const nodes = [mk(0, { depth: 0 }), mk(1, { depth: 1 }), mk(2, { depth: 1 })];
    const { clusters } = await applyClustering(nodes, [], 'hierarchical');

    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const ids = clusters.flatMap((c) => c.nodes.map((n) => n.id)).sort((a, b) => a - b);
    expect(ids).toEqual([0, 1, 2]);
  });

  it('splits an overcrowded depth by parentNodeId', async () => {
    // >4 nodes at one depth triggers the parent subdivision path, which is why
    // parentNodeId has to name the node the edge actually points from.
    const nodes = [
      ...[1, 2, 3].map((id) => mk(id, { depth: 1, parentNodeId: 0 })),
      ...[4, 5, 6].map((id) => mk(id, { depth: 1, parentNodeId: 9 })),
    ];
    const { clusters } = await applyClustering(nodes, [], 'hierarchical');

    expect(clusters.length).toBe(2);
    for (const c of clusters) {
      const parents = new Set(c.nodes.map((n) => n.parentNodeId));
      expect(parents.size).toBe(1);
    }
  });

  it('gives every cluster a centroid at the mean of its members', async () => {
    const nodes = [
      mk(0, { worldX: 0, worldY: 0 }),
      mk(1, { worldX: 100, worldY: 200 }),
    ];
    const { clusters } = await applyClustering(nodes, [], 'temporal');

    expect(clusters[0].centroid).toEqual({ x: 50, y: 100 });
  });
});

describe('getClusterColor', () => {
  it('returns a colour for each cluster type and cycles by index', () => {
    for (const type of ['semantic', 'temporal', 'spatial', 'hierarchical']) {
      expect(getClusterColor(type, 0)).toMatch(/^rgba\(/);
    }
    expect(getClusterColor('semantic', 0)).toBe(getClusterColor('semantic', 3));
  });

  it('falls back to the semantic palette for an unknown type', () => {
    expect(getClusterColor('made-up', 0)).toBe(getClusterColor('semantic', 0));
  });
});
