import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { textFromChunk, sseToEnvelope, modelsFromQuota } from '../src/utils/codeAssist';
import { buildCodeAssistModelList, titleForModelId, CODE_ASSIST_MODEL_LIST, CODE_ASSIST_MODELS } from '../src/constants/graphConstants';
import { extractAuthCode, emailFromIdToken, describeTokenError, beginSignIn } from '../src/utils/codeAssistAuth';

const drain = async (stream) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (line.trim()) text += JSON.parse(line).response ?? '';
    }
  }
  return text;
};

const sseBody = (chunks, { splitAt } = {}) => {
  const body = chunks
    .map((c) => `data: ${JSON.stringify(c)}\n\n`)
    .join('');
  const encoder = new TextEncoder();
  const pieces = splitAt ? [body.slice(0, splitAt), body.slice(splitAt)] : [body];
  return new ReadableStream({
    start(controller) {
      for (const p of pieces) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
};

const wrapped = (text) => ({ response: { candidates: [{ content: { parts: [{ text }] } }] } });

describe('Code Assist response shape', () => {
  it('reads candidates from under `response`, where this API puts them', () => {
    // The Developer API returns {candidates}; Code Assist returns
    // {response:{candidates}}. Reading the wrong level yields empty text and a
    // graph that silently never grows.
    expect(textFromChunk(wrapped('hello'))).toBe('hello');
  });

  it('still reads an unwrapped chunk, so one shape change does not break it', () => {
    expect(textFromChunk({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] })).toBe('hi');
  });

  it('joins every part of every candidate', () => {
    const chunk = { response: { candidates: [
      { content: { parts: [{ text: 'a' }, { text: 'b' }] } },
      { content: { parts: [{ text: 'c' }] } },
    ] } };
    expect(textFromChunk(chunk)).toBe('abc');
  });

  it('survives a chunk with no candidates at all', () => {
    expect(textFromChunk({})).toBe('');
    expect(textFromChunk({ response: {} })).toBe('');
  });
});

describe('Code Assist stream, into the app envelope', () => {
  it('emits one {"response": "..."} line per chunk', async () => {
    const text = await drain(sseToEnvelope(sseBody([wrapped('one '), wrapped('two')])));
    expect(text).toBe('one two');
  });

  it('reassembles a chunk split mid-line by the network', async () => {
    const text = await drain(sseToEnvelope(sseBody(
      [wrapped('Hello '), wrapped('from '), wrapped('Code Assist')],
      { splitAt: 47 },
    )));
    expect(text).toBe('Hello from Code Assist');
  });

  it('ignores keepalives and the terminator rather than emitting empties', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(': keepalive\n\ndata: [DONE]\n\n'));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(wrapped('x'))}\n\n`));
        controller.close();
      },
    });
    expect(await drain(sseToEnvelope(body))).toBe('x');
  });
});

describe('pasted authorization code', () => {
  // Users paste whatever they managed to select, so all three forms are taken.
  it('accepts a bare code', () => {
    expect(extractAuthCode('4/0AVMBsJ-abc_def')).toBe('4/0AVMBsJ-abc_def');
  });

  it('accepts a full redirect URL', () => {
    expect(extractAuthCode('https://codeassist.google.com/authcode?code=4%2F0abc&scope=x'))
      .toBe('4/0abc');
  });

  it('accepts a code=... fragment', () => {
    expect(extractAuthCode('code=4/0abc')).toBe('4/0abc');
  });

  it('trims incidental whitespace', () => {
    expect(extractAuthCode('  4/0abc \n')).toBe('4/0abc');
  });

  it('rejects prose rather than sending it as a code', () => {
    expect(extractAuthCode('I could not find it')).toBe('');
    expect(extractAuthCode('')).toBe('');
    expect(extractAuthCode(null)).toBe('');
  });
});

describe('sign-in error wording', () => {
  it('explains a reused or stale code, which is the common failure', () => {
    const message = describeTokenError({ error: 'invalid_grant' });
    expect(message).toMatch(/work once and expire/i);
    // invalid_grant is what Google returns for a mismatched verifier too, so
    // the wording has to point at the fix rather than diagnose.
    expect(message).toMatch(/Sign in again/i);
  });

  it('falls back to Google wording rather than swallowing it', () => {
    expect(describeTokenError({ error_description: 'Something specific' })).toBe('Something specific');
  });
});

describe('account identification', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads the email from an id_token without verifying it', () => {
    const payload = btoa(JSON.stringify({ email: 'someone@example.com' }));
    expect(emailFromIdToken(`header.${payload}.signature`)).toBe('someone@example.com');
  });

  it('returns null for a malformed or absent token instead of throwing', () => {
    expect(emailFromIdToken(null)).toBe(null);
    expect(emailFromIdToken('not.a.jwt')).toBe(null);
  });
});

describe('pasted code, awkward real-world forms', () => {
  it('decodes a percent-encoded bare code', () => {
    // Some surfaces show the code already escaped. Sent back as-is Google
    // answers invalid_grant, which reads identically to an expired code.
    expect(extractAuthCode('4%2F0AVMBsJ-abc')).toBe('4/0AVMBsJ-abc');
  });

  it('strips quotes picked up by a careless selection', () => {
    expect(extractAuthCode('"4/0abc"')).toBe('4/0abc');
    expect(extractAuthCode('`4/0abc`')).toBe('4/0abc');
  });

  it('leaves a code containing a literal percent alone', () => {
    expect(extractAuthCode('4/0ab%zz')).toBe('4/0ab%zz');
  });
});

describe('sign-in restarts', () => {
  beforeEach(() => localStorage.clear());

  it('keeps one verifier across repeated clicks', async () => {
    // A fresh verifier per click invalidates the code from a page the user
    // already has open - click, miss the popup, click again, paste the first
    // code, invalid_grant.
    const first = await beginSignIn();
    const second = await beginSignIn();

    const challengeOf = (url) => new URL(url).searchParams.get('code_challenge');
    expect(challengeOf(first)).toBe(challengeOf(second));
  });

  it('asks for the scopes Code Assist needs, with S256', async () => {
    const params = new URL(await beginSignIn()).searchParams;
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('scope')).toContain('cloud-platform');
    expect(params.get('redirect_uri')).toBe('https://codeassist.google.com/authcode');
  });
});

describe('model discovery, instead of guessing the catalog', () => {
  // retrieveUserQuota returns one bucket per model the account has an
  // allowance for. gemini-cli reads preview access out of the same field, so
  // this is the backend telling us what it will accept rather than a list
  // copied from a changelog.
  it('reads the model ids out of the quota buckets', () => {
    const quota = { buckets: [
      { modelId: 'gemini-3.1-flash-lite', remainingFraction: 0.9 },
      { modelId: 'gemini-3.1-pro-preview', remainingFraction: 0.5 },
    ] };
    expect(modelsFromQuota(quota)).toEqual(['gemini-3.1-flash-lite', 'gemini-3.1-pro-preview']);
  });

  it('drops internal variants that are not models to talk to', () => {
    const quota = { buckets: [
      { modelId: 'gemini-3.1-pro-preview-customtools' },
      { modelId: 'gemini-embedding-001' },
      { modelId: 'gemini-2.5-pro' },
    ] };
    expect(modelsFromQuota(quota)).toEqual(['gemini-2.5-pro']);
  });

  it('survives a response with no buckets rather than emptying the menu', () => {
    expect(modelsFromQuota({})).toEqual([]);
    expect(modelsFromQuota(null)).toEqual([]);
    expect(modelsFromQuota({ buckets: [{ remainingFraction: 1 }] })).toEqual([]);
  });

  it('does not repeat a model listed in more than one bucket', () => {
    const quota = { buckets: [{ modelId: 'gemini-2.5-pro' }, { modelId: 'gemini-2.5-pro' }] };
    expect(modelsFromQuota(quota)).toEqual(['gemini-2.5-pro']);
  });
});

describe('the menu built from what was discovered', () => {
  it('keeps the static catalog when discovery found nothing', () => {
    // The failure path: no sign-in yet, or the call failed. Falling back to an
    // empty menu would be worse than the guess it replaces.
    expect(buildCodeAssistModelList([])).toBe(CODE_ASSIST_MODEL_LIST);
    expect(buildCodeAssistModelList(null)).toBe(CODE_ASSIST_MODEL_LIST);
  });

  it('offers a preview model when the account actually has one', () => {
    // The whole point: gemini-3.1-pro-preview is unofferable as a guess and
    // perfectly usable by an account with preview access.
    const list = buildCodeAssistModelList(['gemini-3.1-flash-lite', 'gemini-3.1-pro-preview']);
    expect(list.map((m) => m.id)).toContain('gemini-3.1-pro-preview');
    expect(list.find((m) => m.id === 'gemini-3.1-pro-preview').name).toBe('Gemini 3.1 Pro Preview');
  });

  it('keeps the catalog wording for ids it already names', () => {
    const list = buildCodeAssistModelList(['gemini-3.1-flash-lite']);
    expect(list[0].name).toBe(CODE_ASSIST_MODELS['gemini-3.1-flash-lite'].name);
    expect(list[0].description).toBeTruthy();
  });

  it('always recommends exactly one, whatever came back', () => {
    for (const ids of [['gemini-2.5-pro'], ['gemini-3.5-flash', 'gemini-2.5-pro'],
      ['gemini-3.1-flash-lite', 'gemini-3.1-pro-preview']]) {
      expect(buildCodeAssistModelList(ids).filter((m) => m.recommended)).toHaveLength(1);
    }
  });

  it('titles an id nobody has named yet', () => {
    expect(titleForModelId('gemini-4-ultra-preview')).toBe('Gemini 4 Ultra Preview');
    expect(titleForModelId('gemini-3.5-flash')).toBe('Gemini 3.5 Flash');
  });
});
