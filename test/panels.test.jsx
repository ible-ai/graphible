import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import GenerationStatusBar from '../src/components/GenerationStatusBar';
import NodeDetailsPanel from '../src/components/NodeDetailsPanel';

const generating = {
  isGenerating: true,
  currentNodeId: 0,
  tokensGenerated: 120,
  startTime: Date.now(),
  elapsedTime: 1000,
};

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
});

describe('streaming preview', () => {
  // The reply is Markdown from the first token, so it is rendered as Markdown
  // from the first token. Waiting for the end left a normal generation looking
  // like raw source until it finished.
  it('formats a partial reply mid-stream', () => {
    const partial = '# Attention\n\nIt lets each token **weigh** others.\n\n- queries\n- keys';
    const { container } = render(
      <GenerationStatusBar generationStatus={generating} streamingContent={partial} />
    );

    expect(container.querySelector('h1')).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('formats what it can when Markdown is cut mid-token', () => {
    // Streams land mid-syntax constantly; this must not throw or blank out.
    const cut = '## Heading\n\nSome text with an unclosed **bold';
    const { container } = render(
      <GenerationStatusBar generationStatus={generating} streamingContent={cut} />
    );

    expect(container.querySelector('h2')).toBeInTheDocument();
    expect(container.textContent).toContain('Some text');
  });

  it('shows the tail of a long reply rather than the beginning', () => {
    const long = 'earlier text '.repeat(200) + 'THE NEWEST TOKENS';
    const { container } = render(
      <GenerationStatusBar generationStatus={generating} streamingContent={long} />
    );

    expect(container.textContent).toContain('THE NEWEST TOKENS');
  });

  it('renders nothing at all when no generation is running', () => {
    const { container } = render(
      <GenerationStatusBar
        generationStatus={{ ...generating, isGenerating: false }}
        streamingContent="ignored"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('node details panel', () => {
  const node = {
    id: 1,
    label: 'Attention',
    type: 'concept',
    description: 'd',
    content: '# Attention\n\nSome **markdown** body.\n\n```js\nconst x = 1;\n```',
  };

  it('opens at about half the viewport, not a narrow column', () => {
    render(<NodeDetailsPanel nodeDetails={node} onClose={() => {}} feedbackHistory={[]} />);

    const panel = document.querySelector('.details-panel');
    // Previously a fixed 384px, which is under a third of a normal screen for
    // the one element the user is actually reading.
    expect(parseInt(panel.style.width, 10)).toBe(Math.round(window.innerWidth * 0.5));
  });

  it('never opens wider than the window', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
    render(<NodeDetailsPanel nodeDetails={node} onClose={() => {}} feedbackHistory={[]} />);

    const panel = document.querySelector('.details-panel');
    expect(parseInt(panel.style.width, 10)).toBeLessThanOrEqual(500);
  });

  it('renders the node body as Markdown', () => {
    const { container } = render(
      <NodeDetailsPanel nodeDetails={node} onClose={() => {}} feedbackHistory={[]} />
    );

    expect(container.querySelector('h1')).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeInTheDocument();
    expect(container.querySelector('pre')).toBeInTheDocument();
  });

  it('lays the body out as a block so long text can wrap', () => {
    const { container } = render(
      <NodeDetailsPanel nodeDetails={node} onClose={() => {}} feedbackHistory={[]} />
    );

    // The scroll container was display:flex in row direction, which made the
    // prose a flex item with min-width:auto - so it refused to wrap and the
    // panel scrolled sideways instead.
    const scroller = container.querySelector('.details-panel .overflow-y-auto');
    expect(scroller.className).not.toMatch(/\bflex\b/);
    expect(container.querySelector('.prose').className).toMatch(/break-words/);
  });

  it('shows nothing when no node is selected', () => {
    const { container } = render(
      <NodeDetailsPanel nodeDetails={null} onClose={() => {}} feedbackHistory={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows this node\'s feedback history', () => {
    render(
      <NodeDetailsPanel
        nodeDetails={node}
        onClose={() => {}}
        feedbackHistory={[{ nodeId: 1, isPositive: true, text: 'this helped' }]}
      />
    );
    expect(screen.getByText('this helped')).toBeInTheDocument();
  });
});
