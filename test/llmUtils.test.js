import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractJsonFromLlmResponse,
  extractMultipleJsonFromResponse,
  resetStreamingParser,
  validateNodeJson,
  createFallbackNode,
} from '../src/utils/llmUtils';

const node = (label = 'A') => ({
  label,
  type: 'concept',
  description: 'A description long enough to pass validation',
  content: 'Body content',
});

// The parser is a module-level singleton, so every test starts from a known
// state. Forgetting this in app code is itself a documented hazard.
beforeEach(() => resetStreamingParser());

describe('extractJsonFromLlmResponse', () => {
  it('extracts a bare JSON object and returns the remainder', () => {
    const [parsed, rest] = extractJsonFromLlmResponse(JSON.stringify(node()) + 'trailing');
    expect(parsed.label).toBe('A');
    expect(rest).toBe('trailing');
  });

  it('extracts from a ```json fenced block and consumes the fence', () => {
    const raw = 'Sure!\n```json\n' + JSON.stringify(node('Fenced')) + '\n```\nmore';
    const [parsed, rest] = extractJsonFromLlmResponse(raw);

    expect(parsed.label).toBe('Fenced');
    // Regression: patterns carried the /g flag, so match[1] was never the
    // capture group and this strategy silently never fired. Brace matching
    // then picked the object up but left the closing fence in the buffer.
    expect(rest).not.toContain('```');
  });

  it('picks the first block when a response contains two fenced blocks', () => {
    const raw =
      '```json\n' + JSON.stringify(node('First')) + '\n```\n' +
      '```json\n' + JSON.stringify(node('Second')) + '\n```';
    const [parsed] = extractJsonFromLlmResponse(raw);

    // With /g, match[1] was the *second* whole match, so this returned Second.
    expect(parsed.label).toBe('First');
  });

  it('returns null while an object is still incomplete', () => {
    const [parsed] = extractJsonFromLlmResponse('{"label":"Partial","typ');
    expect(parsed).toBeNull();
  });

  it('completes an object across streamed chunks', () => {
    const whole = JSON.stringify(node('Streamed'));
    const split = Math.floor(whole.length / 2);

    expect(extractJsonFromLlmResponse(whole.slice(0, split))[0]).toBeNull();
    const [parsed] = extractJsonFromLlmResponse(whole);
    expect(parsed.label).toBe('Streamed');
  });

  it('does not treat braces inside string values as structure', () => {
    const tricky = {
      ...node('Braces'),
      content: 'a { nested } brace and an escaped \\" quote',
    };
    const [parsed] = extractJsonFromLlmResponse(JSON.stringify(tricky));
    expect(parsed.content).toBe(tricky.content);
  });

  it('repairs unquoted keys and single-quoted strings', () => {
    const sloppy = `{label: 'Sloppy', type: 'concept', description: 'Long enough description', content: 'Body'}`;
    const [parsed] = extractJsonFromLlmResponse(sloppy);
    expect(parsed.label).toBe('Sloppy');
  });

  it('backfills a missing label from title, and coerces an unknown type', () => {
    const aliased = JSON.stringify({
      title: 'From title',
      type: 'not-a-real-type',
      description: 'A description long enough to pass',
      content: 'Body',
    });
    const [parsed] = extractJsonFromLlmResponse(aliased);
    expect(parsed.label).toBe('From title');
    expect(parsed.type).toBe('concept');
  });

  it('tolerates a non-string input instead of throwing', () => {
    expect(extractJsonFromLlmResponse(null)).toEqual([null, '']);
  });
});

describe('extractMultipleJsonFromResponse', () => {
  it('extracts every node from a four-newline separated batch', () => {
    const raw = [node('One'), node('Two'), node('Three')]
      .map((n) => JSON.stringify(n))
      .join('\n\n\n\n');

    const { nodes } = extractMultipleJsonFromResponse(raw);
    expect(nodes.map((n) => n.label)).toEqual(['One', 'Two', 'Three']);
  });

  it('caps the batch at maxNodes', () => {
    const raw = Array.from({ length: 12 }, (_, i) => JSON.stringify(node(`N${i}`))).join('\n\n\n\n');
    expect(extractMultipleJsonFromResponse(raw).nodes).toHaveLength(10);
    expect(extractMultipleJsonFromResponse(raw, 3).nodes).toHaveLength(3);
  });

  it('returns nothing for prose containing no JSON', () => {
    expect(extractMultipleJsonFromResponse('I cannot help with that.').nodes).toEqual([]);
  });
});

describe('resetStreamingParser', () => {
  it('discards a half-read buffer so the next generation starts clean', () => {
    extractJsonFromLlmResponse('{"label":"Abandoned mid-stream');
    resetStreamingParser();

    const [parsed] = extractJsonFromLlmResponse(JSON.stringify(node('Fresh')));
    expect(parsed.label).toBe('Fresh');
  });
});

describe('validateNodeJson', () => {
  it('accepts a well-formed node', () => {
    expect(validateNodeJson(node()).valid).toBe(true);
  });

  it.each([
    ['a missing field', { label: 'x', type: 'concept', description: 'd' }],
    ['a non-string field', { ...node(), description: 42 }],
    ['an invalid type', { ...node(), type: 'banana' }],
    ['a non-object', 'just a string'],
  ])('rejects %s', (_label, input) => {
    expect(validateNodeJson(input).valid).toBe(false);
  });
});

describe('createFallbackNode', () => {
  it('turns unparseable prose into a visible node rather than dropping it', () => {
    const fallback = createFallbackNode('Heading line\nSupporting detail here', 3);
    expect(fallback.label).toBe('Heading line');
    expect(fallback.content).toContain('Supporting detail');
    expect(fallback.type).toBe('concept');
  });

  it('marks node 0 as the root, and truncates an over-long label', () => {
    expect(createFallbackNode('short', 0).type).toBe('root');
    const long = createFallbackNode('x'.repeat(80), 1);
    expect(long.label).toHaveLength(50);
    expect(long.label.endsWith('...')).toBe(true);
  });
});
