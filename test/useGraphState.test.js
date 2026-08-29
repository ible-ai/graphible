import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGraphState } from '../src/hooks/useGraphState';
import { RESPONSE_MODES } from '../src/constants/graphConstants';

const NODE_FIELDS = {
  type: 'concept',
  description: 'A description long enough to pass validation',
  content: 'Body content',
};

// Stands in for useLLMConnection: emits the newline-delimited
// {"response": "..."} envelope every backend produces.
const streamOf = (chunks) => ({
  ok: true,
  status: 200,
  body: new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(JSON.stringify({ response: chunk })));
      }
      controller.close();
    },
  }),
});

const nodesAsText = (labels) =>
  labels.map((label) => JSON.stringify({ label, ...NODE_FIELDS })).join('\n\n\n\n');

const renderGraph = (generate) => renderHook(() => useGraphState(generate));

describe('useGraphState generation', () => {
  it('turns a streamed response into nodes', async () => {
    const generate = vi.fn(async () => streamOf([nodesAsText(['One', 'Two', 'Three'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('a topic', null, null, { type: 'demo' }, null);
    });

    await waitFor(() => expect(result.current.nodes).toHaveLength(3));
    expect(result.current.nodes.map((n) => n.label)).toEqual(['One', 'Two', 'Three']);
  });

  it('assembles nodes split across chunk boundaries', async () => {
    const whole = nodesAsText(['Split']);
    const generate = vi.fn(async () =>
      streamOf([whole.slice(0, 12), whole.slice(12, 30), whole.slice(30)])
    );
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('a topic', null, null, { type: 'demo' }, null);
    });

    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect(result.current.nodes[0].label).toBe('Split');
  });

  it('flushes nodes still buffered when the stream ends', async () => {
    // The final node arrives with no trailing separator, so it is only
    // recovered by the end-of-stream sweep. That sweep was broken by the
    // surplus-brace bug in cleanJsonString.
    const generate = vi.fn(async () => streamOf([nodesAsText(['First', 'Last'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('a topic', null, null, { type: 'demo' }, null);
    });

    await waitFor(() => expect(result.current.nodes.map((n) => n.label)).toContain('Last'));
  });

  it('chains connections, linking the first node to the node prompted from', async () => {
    const generate = vi.fn(async () => streamOf([nodesAsText(['A', 'B', 'C'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('topic', null, null, { type: 'demo' }, null);
    });
    await waitFor(() => expect(result.current.nodes).toHaveLength(3));

    // First node has no source on a fresh graph; the rest chain to the previous.
    expect(result.current.connections).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ]);
  });

  it('records parentNodeId as the node each edge actually comes from', async () => {
    const generate = vi.fn(async () => streamOf([nodesAsText(['A', 'B'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('topic', null, null, { type: 'demo' }, null);
    });
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));

    // Regression: the guard was `previousNodeId > 0`, so node 1 recorded a
    // null parent even though edge 0 -> 1 exists.
    expect(result.current.nodes[1].parentNodeId).toBe(0);
  });

  it('attaches a follow-up batch to the node it was prompted from', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(streamOf([nodesAsText(['Root', 'Second'])]))
      .mockResolvedValueOnce(streamOf([nodesAsText(['Follow'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('topic', null, null, { type: 'demo' }, null);
    });
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));

    await act(async () => {
      await result.current.generateWithLLM('more', 0, 0, { type: 'demo' }, 0);
    });
    await waitFor(() => expect(result.current.nodes).toHaveLength(3));

    expect(result.current.connections).toContainEqual({ from: 0, to: 2 });
    expect(result.current.nodes[2].parentNodeId).toBe(0);
  });

  it('picks the context-aware prompt template only when the marker is present', async () => {
    const generate = vi.fn(async () => streamOf([nodesAsText(['X'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('plain topic', null, null, { type: 'demo' }, null);
    });
    expect(generate.mock.calls[0][0]).toContain('First node must have type "root"');

    await act(async () => {
      await result.current.generateWithLLM(
        'CONTEXT: we covered X\n\nNEW REQUEST: more', null, null, { type: 'demo' }, null
      );
    });
    // Changing these markers breaks the handshake with NewPromptBox.
    expect(generate.mock.calls[1][0]).toContain('Do not duplicate or recreate');
  });

  it('marks generation finished and reports tokens', async () => {
    const generate = vi.fn(async () => streamOf([nodesAsText(['A'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('topic', null, null, { type: 'demo' }, null);
    });

    await waitFor(() => expect(result.current.generationStatus.isGenerating).toBe(false));
    expect(result.current.generationStatus.tokensGenerated).toBeGreaterThan(0);
  });

  it('falls back to a node built from prose rather than losing the response', async () => {
    const generate = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ response: 'x' })));
          controller.error(new Error('connection lost'));
        },
      }),
    }));
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('topic', null, null, { type: 'demo' }, null);
    });

    await waitFor(() => expect(result.current.generationStatus.isGenerating).toBe(false));
  });
});

describe('useGraphState graph operations', () => {
  it('clears everything on reset', async () => {
    const generate = vi.fn(async () => streamOf([nodesAsText(['A', 'B'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('topic', null, null, { type: 'demo' }, null);
    });
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));

    act(() => result.current.resetGraph());

    expect(result.current.nodes).toEqual([]);
    expect(result.current.connections).toEqual([]);
    expect(result.current.currentNodeId).toBeNull();
    expect(result.current.generationStatus.isGenerating).toBe(false);
  });

  it('refuses to add the same node id twice', async () => {
    const { result } = renderGraph(vi.fn());
    const node = { id: 7, label: 'Once', ...NODE_FIELDS, worldX: 0, worldY: 0 };

    act(() => {
      result.current.addNode(node);
      result.current.addNode(node);
    });

    expect(result.current.nodes).toHaveLength(1);
  });

  it('keys nodeMap by id so lookups survive a filtered array', async () => {
    const { result } = renderGraph(vi.fn());

    act(() => {
      result.current.addNode({ id: 0, label: 'Zero', ...NODE_FIELDS });
      result.current.addNode({ id: 5, label: 'Five', ...NODE_FIELDS });
    });

    expect(result.current.nodeMap.get(0).label).toBe('Zero');
    expect(result.current.nodeMap.get(5).label).toBe('Five');
    expect(result.current.getNodeById(5).label).toBe('Five');
    expect(result.current.getNodeById(99)).toBeNull();
  });

  it('drops connections whose endpoints no longer exist', async () => {
    const { result } = renderGraph(vi.fn());

    act(() => {
      result.current.addNode({ id: 0, label: 'Kept', ...NODE_FIELDS });
      result.current.setConnections([{ from: 0, to: 1 }, { from: 0, to: 99 }]);
    });

    await waitFor(() => expect(result.current.connections).toEqual([]));
  });
});

describe('single-response mode', () => {
  const answer = '# Transformer attention\n\nAttention lets each token weigh every other token. ' +
    'It is the core of the architecture.';

  const single = (chunks) =>
    vi.fn(async () => streamOf(chunks));

  it('keeps a whole reply in one node instead of splitting it', async () => {
    const generate = single([answer]);
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM(
        'explain attention', null, null, { type: 'demo' }, null, RESPONSE_MODES.SINGLE
      );
    });

    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect(result.current.nodes[0].content).toBe(answer);
  });

  it('asks the model for a normal answer, not for JSON node objects', async () => {
    const generate = single([answer]);
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM(
        'explain attention', null, null, { type: 'demo' }, null, RESPONSE_MODES.SINGLE
      );
    });

    const sent = generate.mock.calls[0][0];
    expect(sent).toContain('explain attention');
    expect(sent).not.toContain('Separate each JSON object');
    expect(sent).toMatch(/Markdown/i);
  });

  it('titles the node from the reply\'s heading', async () => {
    const generate = single([answer]);
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM(
        'explain attention', null, null, { type: 'demo' }, null, RESPONSE_MODES.SINGLE
      );
    });

    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect(result.current.nodes[0].label).toBe('Transformer attention');
    expect(result.current.nodes[0].description).toContain('Attention lets each token');
  });

  it('grows the node as chunks arrive, rather than waiting for the end', async () => {
    const generate = single(['# Part\n\nfirst ', 'second ', 'third']);
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM(
        'q', null, null, { type: 'demo' }, null, RESPONSE_MODES.SINGLE
      );
    });

    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect(result.current.nodes[0].content).toBe('# Part\n\nfirst second third');
  });

  it('marks the first node root, and later ones concept', async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce(streamOf([answer]))
      .mockResolvedValueOnce(streamOf(['A follow-up answer.']));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM(
        'first', null, null, { type: 'demo' }, null, RESPONSE_MODES.SINGLE
      );
    });
    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect(result.current.nodes[0].type).toBe('root');

    await act(async () => {
      await result.current.generateWithLLM(
        'second', 0, 0, { type: 'demo' }, 0, RESPONSE_MODES.SINGLE
      );
    });
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
    expect(result.current.nodes[1].type).toBe('concept');
    // Branching is the whole point of this mode: the reply hangs off its parent.
    expect(result.current.connections).toContainEqual({ from: 0, to: 1 });
  });

  it('still splits into several nodes in graph mode', async () => {
    const generate = vi.fn(async () => streamOf([nodesAsText(['A', 'B', 'C'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM(
        'topic', null, null, { type: 'demo' }, null, RESPONSE_MODES.GRAPH
      );
    });

    await waitFor(() => expect(result.current.nodes).toHaveLength(3));
  });

  it('defaults to graph mode when no mode is passed', async () => {
    const generate = vi.fn(async () => streamOf([nodesAsText(['A', 'B'])]));
    const { result } = renderGraph(generate);

    await act(async () => {
      await result.current.generateWithLLM('topic', null, null, { type: 'demo' }, null);
    });

    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
  });
});
