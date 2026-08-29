import { describe, it, expect } from 'vitest';
import {
  composePrompt,
  hasAssembledContext,
  CONTEXT_MARKER,
  SELECTION_MARKER,
  buildContextUpToNode,
  buildContextString,
  buildContextSummaryString,
  buildSelectedNodesContext,
} from '../src/utils/contextUtils';

// id is the index into the array, which the whole app relies on.
const mk = (id, label, type = 'concept', batchId = 0) => ({
  id,
  label,
  type,
  batchId,
  description: `${label} description`,
  content: `${label} content`,
});

//   0 Root
//   |-- 1 Alpha -- 3 Deep
//   `-- 2 Beta
const nodes = [
  mk(0, 'Root', 'root'),
  mk(1, 'Alpha'),
  mk(2, 'Beta'),
  mk(3, 'Deep', 'detail', 1),
];
const connections = [
  { from: 0, to: 1 },
  { from: 0, to: 2 },
  { from: 1, to: 3 },
];

describe('buildContextUpToNode', () => {
  it('includes the root when asked for node 0', () => {
    // Regression: the guard was `!targetNodeId`, and 0 is falsy, so the root
    // node - the one every conversation starts from - returned no context.
    expect(buildContextUpToNode(0, nodes, connections).map((n) => n.label)).toEqual(['Root']);
  });

  it('walks ancestors back to the root, in conversation order', () => {
    expect(buildContextUpToNode(3, nodes, connections).map((n) => n.label))
      .toEqual(['Root', 'Alpha', 'Deep']);
  });

  it('excludes siblings and anything downstream of the target', () => {
    const labels = buildContextUpToNode(1, nodes, connections).map((n) => n.label);
    expect(labels).toEqual(['Root', 'Alpha']);
    expect(labels).not.toContain('Beta');
    expect(labels).not.toContain('Deep');
  });

  it('orders by batch first, then id', () => {
    expect(buildContextUpToNode(3, nodes, connections).map((n) => n.id)).toEqual([0, 1, 3]);
  });

  it('returns empty for null, undefined, and an empty graph', () => {
    expect(buildContextUpToNode(null, nodes, connections)).toEqual([]);
    expect(buildContextUpToNode(undefined, nodes, connections)).toEqual([]);
    expect(buildContextUpToNode(0, [], connections)).toEqual([]);
  });

  it('resolves nodes by id when ids no longer match array indices', () => {
    // After a delete the array is filtered without reindexing, so id and
    // position diverge. Anything indexing by id then reads the wrong node.
    const afterDelete = [nodes[0], nodes[2], nodes[3]]; // ids 0, 2, 3
    const edges = [{ from: 0, to: 2 }, { from: 2, to: 3 }];

    expect(buildContextUpToNode(3, afterDelete, edges).map((n) => n.id)).toEqual([0, 2, 3]);
    expect(buildContextUpToNode(2, afterDelete, edges).map((n) => n.id)).toEqual([0, 2]);
  });

  it('does not hang on a cycle', () => {
    const cyclic = [{ from: 0, to: 1 }, { from: 1, to: 0 }];
    const labels = buildContextUpToNode(1, nodes.slice(0, 2), cyclic).map((n) => n.label);
    expect(labels.sort()).toEqual(['Alpha', 'Root']);
  });
});

describe('buildContextString', () => {
  it('marks the target as the current focus and the root as the initial topic', () => {
    const out = buildContextString(3, nodes, connections);
    expect(out).toContain('Initial topic: "Root"');
    expect(out).toContain('Current focus: "Deep"');
  });

  it('respects maxContextLength', () => {
    const out = buildContextString(3, nodes, connections, { maxContextLength: 120 });
    expect(out.length).toBeLessThanOrEqual(120);
  });

  it('omits body content when includeFullContent is false', () => {
    const out = buildContextString(3, nodes, connections, { includeFullContent: false });
    expect(out).not.toContain('Deep content');
  });
});

describe('buildContextSummaryString', () => {
  it('groups the covered ground by node type', () => {
    const out = buildContextSummaryString(3, nodes, connections);
    expect(out).toContain('Main Topics Covered');
    expect(out).toContain('Concepts Explained');
    expect(out).toContain('Details Covered');
  });
});

describe('buildSelectedNodesContext', () => {
  it('summarises the selected nodes and reports the count', () => {
    const out = buildSelectedNodesContext(new Set([1, 2]), nodes);
    expect(out).toContain('Selected Nodes (2)');
    expect(out).toContain('Alpha');
    expect(out).toContain('Beta');
  });

  it('returns empty for an empty or missing selection', () => {
    expect(buildSelectedNodesContext(new Set(), nodes)).toBe('');
    expect(buildSelectedNodesContext(null, nodes)).toBe('');
  });
});

describe('composePrompt', () => {
  it('returns the request untouched when there is nothing to add', () => {
    expect(composePrompt({ request: 'plain question', nodes, connections })).toBe('plain question');
  });

  it('writes the markers useGraphState routes on', () => {
    const out = composePrompt({
      request: 'more please',
      targetNodeId: 3,
      nodes,
      connections,
    });

    // Both halves of this handshake now live in one file, so they cannot drift.
    expect(hasAssembledContext(out)).toBe(true);
    expect(out).toContain(CONTEXT_MARKER);
    expect(out).toContain('NEW REQUEST: more please');
  });

  it('lists what has already been covered, so it is not repeated', () => {
    const out = composePrompt({ request: 'go on', targetNodeId: 3, nodes, connections });

    expect(out).toContain('"Root"');
    expect(out).toContain('"Alpha"');
    expect(out).not.toContain('"Beta"');
  });

  it('adds the selected nodes as background, separately from the path', () => {
    const out = composePrompt({
      request: 'compare these',
      targetNodeId: 3,
      nodes,
      connections,
      selectedNodeIds: new Set([1, 2]),
    });

    expect(out).toContain(SELECTION_MARKER);
    expect(out).toContain('Beta');
    expect(out).toContain('BACKGROUND CONTEXT');
  });

  it('honours the include flags', () => {
    const noContext = composePrompt({
      request: 'q', targetNodeId: 3, nodes, connections, includeContext: false,
    });
    expect(noContext).toBe('q');

    const noSelection = composePrompt({
      request: 'q',
      targetNodeId: null,
      nodes,
      connections,
      selectedNodeIds: new Set([1]),
      includeSelection: false,
    });
    expect(noSelection).toBe('q');
  });

  it('treats a plain request as carrying no context', () => {
    expect(hasAssembledContext('just a question')).toBe(false);
  });
});
