import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSaveLoad } from '../src/hooks/useSaveLoad';

const nodes = [{ id: 0, label: 'Root', type: 'root', description: 'd', content: 'c' }];
const connections = [{ from: 0, to: 1 }];

const render = (n = nodes, c = connections) =>
  renderHook(() => useSaveLoad(n, c, 0, 'A prompt'));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('saving graphs', () => {
  it('persists to localStorage, so graphs survive a restart', async () => {
    const { result } = render();
    act(() => { result.current.saveCurrentGraph(); });

    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(1));
    // sessionStorage is cleared when the browser closes, which is exactly what
    // made saved graphs disappear.
    expect(localStorage.getItem('graphible-graphs')).toBeTruthy();
    expect(sessionStorage.getItem('graphible')).toBeNull();
  });

  it('reloads what a previous session saved', async () => {
    const { result, unmount } = render();
    act(() => { result.current.saveCurrentGraph('Kept'); });
    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(1));
    unmount();

    const { result: fresh } = render();
    await waitFor(() => expect(fresh.current.savedGraphs).toHaveLength(1));
    expect(fresh.current.savedGraphs[0].name).toBe('Kept');
  });

  it('stores the connections alongside the nodes', async () => {
    const { result } = render();
    act(() => { result.current.saveCurrentGraph(); });

    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(1));
    expect(result.current.savedGraphs[0].connections).toEqual(connections);
  });

  it('refuses to save an empty graph', () => {
    const { result } = render([], []);
    let saved;
    act(() => { saved = result.current.saveCurrentGraph(); });

    expect(saved).toBeNull();
    expect(result.current.savedGraphs).toHaveLength(0);
  });

  it('deletes a graph and forgets it', async () => {
    const { result } = render();
    act(() => { result.current.saveCurrentGraph(); });
    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(1));

    const id = result.current.savedGraphs[0].id;
    act(() => { result.current.deleteGraph(id); });

    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(0));
    expect(JSON.parse(localStorage.getItem('graphible-graphs'))).toEqual([]);
  });

  it('rescues graphs left in the old sessionStorage location', async () => {
    sessionStorage.setItem(
      'graphible',
      JSON.stringify([{ id: 1, name: 'From the old store', nodes, connections }])
    );

    const { result } = render();
    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(1));
    expect(result.current.savedGraphs[0].name).toBe('From the old store');
    // Migrated, then cleared so it cannot be imported twice.
    expect(sessionStorage.getItem('graphible')).toBeNull();
  });

  it('survives corrupt storage rather than losing the session', async () => {
    localStorage.setItem('graphible-graphs', 'not json');
    const { result } = render();

    await waitFor(() => expect(result.current.savedGraphs).toEqual([]));
    expect(() => act(() => { result.current.saveCurrentGraph(); })).not.toThrow();
  });
});

describe('export and import', () => {
  it('exports a versioned payload containing the graph', () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    const { result } = render();

    let payload;
    act(() => { payload = result.current.exportGraph(); });

    expect(payload.version).toBe(1);
    expect(payload.graph.nodes).toEqual(nodes);
    expect(payload.graph.connections).toEqual(connections);
    vi.unstubAllGlobals();
  });

  it('imports a previously exported file', async () => {
    const { result } = render();
    const file = JSON.stringify({
      version: 1,
      graph: { name: 'Round trip', nodes, connections, currentNodeId: 0 },
    });

    await act(async () => { await result.current.importGraph(file); });

    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(1));
    expect(result.current.savedGraphs[0].name).toBe('Round trip');
    expect(result.current.savedGraphs[0].nodes).toEqual(nodes);
  });

  it('accepts a bare graph object as well as a wrapped export', async () => {
    const { result } = render();
    await act(async () => {
      await result.current.importGraph(JSON.stringify({ name: 'Bare', nodes, connections }));
    });

    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(1));
  });

  it('rejects a file that is not a graph, with a readable message', async () => {
    const { result } = render();
    await expect(
      result.current.importGraph(JSON.stringify({ unrelated: true }))
    ).rejects.toThrow(/does not contain a Graphible graph/i);
  });

  it('gives an imported graph its own id, so it cannot overwrite one', async () => {
    const { result } = render();
    act(() => { result.current.saveCurrentGraph('Existing'); });
    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(1));

    const existingId = result.current.savedGraphs[0].id;
    await act(async () => {
      await result.current.importGraph(
        JSON.stringify({ graph: { id: existingId, name: 'Imported', nodes, connections } })
      );
    });

    await waitFor(() => expect(result.current.savedGraphs).toHaveLength(2));
    const ids = result.current.savedGraphs.map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
  });
});
