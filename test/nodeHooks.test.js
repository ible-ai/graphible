import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeSelection } from '../src/hooks/useNodeSelection';
import { useNodeManipulation } from '../src/hooks/useNodeManipulation';

const mk = (id, over = {}) => ({
  id,
  label: `Node ${id}`,
  description: 'd',
  content: 'c',
  type: 'concept',
  batchId: 0,
  worldX: 0,
  worldY: 0,
  ...over,
});

//   0 -- 1 -- 3
//     `- 2
const nodes = [mk(0, { type: 'root' }), mk(1), mk(2), mk(3, { batchId: 1 })];
const connections = [{ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 1, to: 3 }];

describe('useNodeSelection', () => {
  it('starts in auto and cycles through every mode, back to the start', () => {
    const { result } = renderHook(() => useNodeSelection());
    expect(result.current.contextMode).toBe('auto');

    const seen = [result.current.contextMode];
    for (let i = 0; i < 4; i++) {
      act(() => result.current.toggleContextMode());
      seen.push(result.current.contextMode);
    }

    // App.jsx renders a label per mode; a new mode added here needs one there.
    expect(seen).toEqual(['auto', 'manual', 'branch', 'batch', 'auto']);
  });

  it('jumps straight to a mode via setContextMode', () => {
    const { result } = renderHook(() => useNodeSelection());
    act(() => result.current.setContextMode('branch'));
    expect(result.current.contextMode).toBe('branch');
  });

  it('selects a whole subtree in branch mode', () => {
    const { result } = renderHook(() => useNodeSelection());
    act(() => result.current.setContextMode('branch'));
    act(() => result.current.handleNodeSelection(1, nodes, connections));

    expect([...result.current.selectedNodeIds].sort()).toEqual([1, 3]);
  });

  it('selects a whole generation in batch mode', () => {
    const { result } = renderHook(() => useNodeSelection());
    act(() => result.current.setContextMode('batch'));
    act(() => result.current.handleNodeSelection(0, nodes, connections));

    expect([...result.current.selectedNodeIds].sort()).toEqual([0, 1, 2]);
  });

  it('toggles a single node in manual mode', () => {
    const { result } = renderHook(() => useNodeSelection());
    act(() => result.current.setContextMode('manual'));

    act(() => result.current.handleNodeSelection(2, nodes, connections));
    expect(result.current.isNodeSelected(2)).toBe(true);

    act(() => result.current.handleNodeSelection(2, nodes, connections));
    expect(result.current.isNodeSelected(2)).toBe(false);
  });

  it('auto-selects the current node plus its neighbours, capped at 8', () => {
    const many = Array.from({ length: 30 }, (_, i) => mk(i));
    const chain = many.slice(1).map((n) => ({ from: n.id - 1, to: n.id }));
    const { result } = renderHook(() => useNodeSelection());

    act(() => result.current.updateAutoContext(many, 15, chain));

    expect(result.current.selectedNodeIds.has(15)).toBe(true);
    expect(result.current.selectedCount).toBeLessThanOrEqual(8);
  });

  it('clears selections', () => {
    const { result } = renderHook(() => useNodeSelection());
    act(() => result.current.selectNodes([0, 1, 2]));
    expect(result.current.selectedCount).toBe(3);

    act(() => result.current.clearSelections());
    expect(result.current.selectedCount).toBe(0);
  });

  it('drops selections pointing at nodes that no longer exist', () => {
    const { result } = renderHook(() => useNodeSelection());
    act(() => result.current.selectNodes([0, 1, 99]));
    act(() => result.current.cleanupInvalidSelections([0, 1]));

    expect([...result.current.selectedNodeIds].sort()).toEqual([0, 1]);
  });
});

// Drives the hook with real state, the way App.jsx wires it.
const renderManipulation = (initialNodes, initialConnections) => {
  const state = { nodes: [...initialNodes], connections: [...initialConnections] };
  const setNodes = vi.fn((update) => {
    state.nodes = typeof update === 'function' ? update(state.nodes) : update;
  });
  const setConnections = vi.fn((update) => {
    state.connections = typeof update === 'function' ? update(state.connections) : update;
  });

  const hook = renderHook(
    ({ n, c }) => useNodeManipulation(n, setNodes, c, setConnections),
    { initialProps: { n: state.nodes, c: state.connections } }
  );
  return { hook, state };
};

describe('useNodeManipulation', () => {
  it('moves a deleted node and its edges into the deletion store', () => {
    const { hook, state } = renderManipulation(nodes, connections);

    act(() => hook.result.current.deleteNode(1));

    expect(state.nodes.map((n) => n.id)).toEqual([0, 2, 3]);
    expect(state.connections).toEqual([{ from: 0, to: 2 }]);
    expect(hook.result.current.deletedNodes.get(1).connections).toHaveLength(2);
  });

  it('deletes the root, whose id is 0', () => {
    const { hook, state } = renderManipulation(nodes, connections);

    // Regression: the lookup read `n && n.id && ...`, and 0 is falsy.
    act(() => hook.result.current.deleteNode(0));
    expect(state.nodes.map((n) => n.id)).toEqual([1, 2, 3]);
  });

  it('warns and does nothing for a node that is not there', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { hook, state } = renderManipulation(nodes, connections);

    act(() => hook.result.current.deleteNode(404));

    expect(state.nodes).toHaveLength(4);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('restores a node, keeping only edges whose other end still exists', () => {
    const { hook, state } = renderManipulation(nodes, connections);

    act(() => hook.result.current.deleteNode(3)); // edge 1 -> 3
    act(() => hook.result.current.deleteNode(1)); // edge 0 -> 1

    hook.rerender({ n: state.nodes, c: state.connections });
    act(() => hook.result.current.restoreNode(3));

    // Node 1 is still deleted, so edge 1 -> 3 must not come back.
    expect(state.nodes.map((n) => n.id).sort()).toEqual([0, 2, 3]);
    expect(state.connections).not.toContainEqual({ from: 1, to: 3 });
  });

  it('forgets a node permanently deleted from the store', () => {
    const { hook } = renderManipulation(nodes, connections);

    act(() => hook.result.current.deleteNode(2));
    expect(hook.result.current.deletedNodes.has(2)).toBe(true);

    act(() => hook.result.current.permanentlyDeleteNode(2));
    expect(hook.result.current.deletedNodes.has(2)).toBe(false);
  });

  it('adds a connection once, in either direction', () => {
    const { hook, state } = renderManipulation(nodes, []);

    let added;
    act(() => { added = hook.result.current.addConnection(0, 2); });
    expect(added).toBe(true);
    expect(state.connections).toEqual([{ from: 0, to: 2 }]);

    hook.rerender({ n: state.nodes, c: state.connections });
    let again;
    act(() => { again = hook.result.current.addConnection(2, 0); });
    expect(again).toBe(false);
    expect(state.connections).toHaveLength(1);
  });

  it('refuses a connection to a node that does not exist', () => {
    const { hook, state } = renderManipulation(nodes, []);

    let added;
    act(() => { added = hook.result.current.addConnection(0, 404); });
    expect(added).toBe(false);
    expect(state.connections).toEqual([]);
  });

  it('removes a connection given either direction', () => {
    const { hook, state } = renderManipulation(nodes, [{ from: 0, to: 1 }]);

    act(() => hook.result.current.removeConnection(1, 0));
    expect(state.connections).toEqual([]);
  });
});
