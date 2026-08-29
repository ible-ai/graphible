import { describe, it, expect } from 'vitest';
import { threadForNode, siblingsOf, childrenOf, buildQuotePrompt } from '../src/utils/threadUtils';

const mk = (id, label) => ({ id, label, type: 'concept', description: 'd', content: `${label} body` });

//        0 Root
//        |-- 1 Alpha -- 3 Deep
//        `-- 2 Beta
const nodes = [mk(0, 'Root'), mk(1, 'Alpha'), mk(2, 'Beta'), mk(3, 'Deep')];
const connections = [{ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 1, to: 3 }];

describe('threadForNode', () => {
  it('reads a path from the root down to the node, oldest first', () => {
    expect(threadForNode(3, nodes, connections).map((n) => n.label))
      .toEqual(['Root', 'Alpha', 'Deep']);
  });

  it('is just the root for the root', () => {
    expect(threadForNode(0, nodes, connections).map((n) => n.id)).toEqual([0]);
  });

  it('excludes the other branch', () => {
    expect(threadForNode(3, nodes, connections).map((n) => n.label)).not.toContain('Beta');
  });

  it('returns nothing for an unknown or missing node', () => {
    expect(threadForNode(99, nodes, connections)).toEqual([]);
    expect(threadForNode(null, nodes, connections)).toEqual([]);
  });

  it('terminates on a cycle', () => {
    const cyclic = [{ from: 0, to: 1 }, { from: 1, to: 0 }];
    expect(threadForNode(1, nodes, cyclic).length).toBeLessThanOrEqual(nodes.length);
  });
});

describe('siblingsOf', () => {
  it('finds the alternatives branching from the same point', () => {
    expect(siblingsOf(1, nodes, connections).map((n) => n.id).sort()).toEqual([1, 2]);
  });

  it('treats roots as siblings of each other', () => {
    const twoRoots = [...nodes, mk(4, 'Another root')];
    expect(siblingsOf(0, twoRoots, connections).map((n) => n.id).sort()).toEqual([0, 4]);
  });

  it('returns just the node when it is an only child', () => {
    expect(siblingsOf(3, nodes, connections).map((n) => n.id)).toEqual([3]);
  });
});

describe('childrenOf', () => {
  it('finds what was asked from a node', () => {
    expect(childrenOf(0, nodes, connections).map((n) => n.id).sort()).toEqual([1, 2]);
    expect(childrenOf(3, nodes, connections)).toEqual([]);
  });
});

describe('buildQuotePrompt', () => {
  it('anchors the question to the quoted passage', () => {
    const out = buildQuotePrompt('attention weighs tokens', 'why does that help?', 'Alpha');

    expect(out).toContain('> attention weighs tokens');
    expect(out).toContain('why does that help?');
    expect(out).toContain('Alpha');
    // useGraphState routes on these markers.
    expect(out).toContain('CONTEXT:');
    expect(out).toContain('NEW REQUEST:');
  });

  it('quotes every line of a multi-line passage', () => {
    const out = buildQuotePrompt('first line\nsecond line', 'explain', 'X');
    expect(out).toContain('> first line');
    expect(out).toContain('> second line');
  });

  it('passes the question through untouched when there is no quote', () => {
    expect(buildQuotePrompt('', 'plain question')).toBe('plain question');
    expect(buildQuotePrompt('   ', 'plain question')).toBe('plain question');
  });
});
