// LLM connection status management

import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { WEBLLM_STATE, DEFAULT_WEBLLM_MODEL_INFO, LLM_CONFIG, ERROR_MESSAGES, migrateModelConfig } from '../constants/graphConstants';
import { BrowserLLMEngine } from './useBrowserLLMEngine';
import { getModelConsent, setModelConsent, clearModelConsent, isModelCached } from '../utils/modelConsent';
import { getAccessToken, clearSession, isSignedIn } from '../utils/googleAuth';
import * as codeAssistAuth from '../utils/codeAssistAuth';
import { loadCodeAssist, streamGenerateContent, generateContent, sseToEnvelope } from '../utils/codeAssist';

const GEMINI_REST = 'https://generativelanguage.googleapis.com/v1beta';

// Google answers a retired model id with 404 and an empty body, and an
// out-of-scope token with a 403 whose useful part is a header. Neither says
// anything a user can act on, so they are translated here.
const describeGeminiError = async (response) => {
  const raw = await response.text().catch(() => '');
  let message = '';
  try {
    message = JSON.parse(raw)?.error?.message ?? '';
  } catch {
    message = raw.slice(0, 200);
  }

  if (response.status === 404) {
    return 'That Gemini model is no longer available. Pick another in the model menu.';
  }
  if (response.status === 401) {
    return 'Your Google sign-in expired. Sign in again to continue.';
  }
  if (response.status === 403 && /quota project|x-goog-user-project/i.test(message)) {
    return 'Google needs a Cloud project to bill this request to. Add one in the model menu.';
  }
  if (response.status === 429) {
    return "You've hit Google's rate limit for this account. Try again in a minute.";
  }
  return message || `Gemini request failed: ${response.status}`;
};

// The REST API takes generation settings as `generationConfig`. Note this is
// the opposite of the @google/genai SDK, which ignores that field and reads
// `config` - the two paths are not interchangeable.
const geminiRequestBody = (prompt) => JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: LLM_CONFIG.EXTERNAL.GOOGLE.DEFAULT_CONFIG,
});

// Without x-goog-user-project, Google bills the project that owns the OAuth
// client - which is whoever deployed Graphible, not the person prompting. That
// default is wrong in the expensive direction, so a request without a project
// is refused rather than sent.
const requireQuotaProject = (config) => {
  const projectId = config?.projectId?.trim();
  if (!projectId) {
    throw new Error(
      'Add your Google Cloud project ID in the model menu. Google bills Gemini '
      + 'usage to a project, and without one it would charge this site rather '
      + 'than your own account.'
    );
  }
  return projectId;
};

const geminiHeaders = (token, config) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'x-goog-user-project': requireQuotaProject(config),
});

// Flattens one Gemini response chunk to text, across every candidate and part.
const textFromChunk = (chunk) =>
  (chunk?.candidates ?? [])
    .flatMap((candidate) => candidate?.content?.parts ?? [])
    .map((part) => part?.text ?? '')
    .join('');



export const useLLMConnection = () => {
  const [llmConnected, setLlmConnected] = useState('pending');
  const [currentModel, setCurrentModel] = useState({ type: 'demo' });
  const [testingInProgress, setTestingInProgress] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [hasTestedInitially, setHasTestedInitially] = useState(false);
  const [webllmEngine, setWebllmEngine] = useState(null);
  // State updates are not visible to the async caller that just triggered the
  // load, so the engine is mirrored into a ref.
  const engineRef = useRef(null);
  const [webllmLoadingProgress, setWebllmLoadingProgress] = useState(null);
  const [webllmLoadState, setWebllmLoadState] = useState(WEBLLM_STATE.NULL);
  const [hasUserConsent, setHasUserConsent] = useState(false);

  // A pending download request, surfaced as a modal. Held as a promise so the
  // caller that needs the model can await the user's decision.
  const [consentRequest, setConsentRequest] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const consentResolverRef = useRef(null);

  const lastTestTime = useRef(0);
  const maxFailures = 3;
  const cooldownPeriod = 5000;

  const testLocalConnection = async (config) => {
    try {
      const response = await fetch(`${config.address}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('Local LLM connection (@', config.address, ') test failed:', error);
      return false;
    }
  };

  const testExternalConnection = async (config) => {
    try {
      if (config.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey: `${config.apiKey}` });
        const response = await ai.models.generateContent({
          model: config.model,
          contents: "test"
        });
        console.log("External response", response);
        return true;
      }
      return false;
    } catch (error) {
      console.error('External API connection test failed:', error);
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('401')) {
        throw new Error('Invalid API key');
      }
      return false;
    }
  };

  // Confirms the signed-in user can actually reach the model. ListModels costs
  // no tokens, so a passing test does not consume anyone's quota.
  const testGoogleOAuthConnection = async (config, { interactive = false } = {}) => {
    // A background check must never open a sign-in popup; only a deliberate
    // action gets to do that.
    if (!interactive && !isSignedIn()) return false;

    const token = await getAccessToken();
    const response = await fetch(`${GEMINI_REST}/models/${config.model}`, {
      headers: geminiHeaders(token, config),
    });

    if (!response.ok) throw new Error(await describeGeminiError(response));
    return true;
  };

  // Resolves the account's project and tier, which doubles as proof the token
  // works. Costs no tokens, so testing does not spend the user's allowance.
  const testCodeAssistConnection = async () => {
    if (!codeAssistAuth.isSignedIn() && !codeAssistAuth.hasStoredGrant()) return false;

    const { project, tier } = await loadCodeAssist();
    // Cached onto the live config so generation does not repeat the lookup.
    setCurrentModel((prev) => (prev.type === 'code-assist' ? { ...prev, project, tier } : prev));
    return true;
  };

  const initializeWebLLMWithConsent = useCallback(async (config, granted = hasUserConsent) => {
    // setHasUserConsent has not necessarily re-rendered by the time the
    // awaiting caller resumes, so the decision is passed in explicitly.
    if (!granted) {
      console.log('WebLLM initialization blocked - no user consent');
      return false;
    }

    try {
      // Check WebGPU support
      if (!navigator.gpu) {
        throw new Error('WebGPU not supported - please use Chrome/Edge 113+ or Firefox 141+');
      }

      // Test adapter availability
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('WebGPU adapter not available');
      }

      // If we already have an engine with the same model, use it
      if (webllmEngine && webllmEngine.modelId === config.model) {
        return true;
      }

      // Initialize WebLLM engine with progress tracking
      const engine = new BrowserLLMEngine({ config, setWebllmLoadState, setWebllmLoadingProgress });
      await engine.load();
      console.log('Successfully loaded BrowserLLMEngine.');

      engineRef.current = engine;
      setWebllmEngine(engine);
      setWebllmLoadingProgress(null);
      setWebllmLoadState(WEBLLM_STATE.DONE);
      return true;
    } catch (error) {
      console.error('WebLLM connection test failed:', error);
      setWebllmLoadingProgress(null);
      engineRef.current = null;
      setWebllmEngine(null);
      setWebllmLoadState(WEBLLM_STATE.NULL);
      // Otherwise the recorded grant suppresses the prompt on the next attempt
      // while no model is present, and the user can never get back to it.
      clearModelConsent(config.model);
      throw error;
    }
  }, [webllmEngine, hasUserConsent]);

  // Request consent for a model download, for this specific model.
  // Resolves immediately when this model was already approved, or when its
  // weights are already cached in the browser and there is nothing to fetch.
  const requestWebLLMConsent = useCallback(async (modelId) => {
    if (getModelConsent(modelId) === true) return true;
    if (await isModelCached(modelId)) {
      setModelConsent(modelId, true);
      return true;
    }

    return new Promise((resolve) => {
      consentResolverRef.current = resolve;
      setConsentRequest({ modelId, info: LLM_CONFIG.WEBLLM[modelId] });
    });
  }, []);

  const resolveConsentRequest = useCallback((granted) => {
    setConsentRequest(prev => {
      if (prev) setModelConsent(prev.modelId, granted);
      return null;
    });
    setHasUserConsent(granted);

    consentResolverRef.current?.(granted);
    consentResolverRef.current = null;
  }, []);

  // Reports whether the browser *could* run a model. Never downloads and never
  // prompts: startup calls this, and a page load must not trigger either.
  const checkWebGPUSupport = useCallback(async () => {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported - please use Chrome/Edge 113+ or Firefox 141+');
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('WebGPU adapter not available');
    }
    return true;
  }, []);

  const testWebLLMConnection = useCallback(async (config, { interactive = false } = {}) => {
    await checkWebGPUSupport();

    // Already loaded for this model.
    if (webllmEngine && webllmEngine.modelId === config.model) return true;

    // Startup and background checks stop here: the browser can run a model, but
    // nothing is downloaded until the user asks for something that needs it.
    if (!interactive) return false;

    const granted = await requestWebLLMConsent(config.model);
    if (!granted) {
      throw new Error(ERROR_MESSAGES.USER_DECLINED_DOWNLOAD);
    }

    return await initializeWebLLMWithConsent(config, granted);
  }, [webllmEngine, checkWebGPUSupport, requestWebLLMConsent, initializeWebLLMWithConsent]);

  const testLLMConnection = useCallback(async (config = currentModel, { interactive = false } = {}) => {
    const now = Date.now();
    // The cooldown exists to stop background retries hammering a dead endpoint.
    // A user-initiated attempt is never throttled, or a deliberate retry after
    // three failures would do nothing at all.
    const throttled = !interactive
      && (testingInProgress || (now - lastTestTime.current < cooldownPeriod && failureCount >= maxFailures));

    if (throttled) {
      console.log('Connection test throttled - too many recent failures or test in progress');
      return llmConnected === 'connected';
    }

    setTestingInProgress(true);
    setConnectionError(null);
    setLlmConnected('pending');
    lastTestTime.current = now;

    try {
      let isConnected = false;
      if (config.type === 'local') {
        isConnected = await testLocalConnection(config);
      } else if (config.type === 'external') {
        isConnected = await testExternalConnection(config);
      } else if (config.type === 'google-oauth') {
        isConnected = await testGoogleOAuthConnection(config, { interactive });
      } else if (config.type === 'code-assist') {
        isConnected = await testCodeAssistConnection();
      } else if (config.type === 'webllm') {
        isConnected = await testWebLLMConnection(config, { interactive });
      } else if (config.type === 'demo') {
        // Demo mode is always "connected"
        isConnected = true;
      }

      if (isConnected) {
        setLlmConnected('connected');
        setFailureCount(0);
      } else {
        setLlmConnected('disconnected');
        setFailureCount(prev => prev + 1);
      }

      setHasTestedInitially(true);
      setTestingInProgress(false);
      return isConnected;
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionError(error?.message || String(error));
      setLlmConnected('disconnected');
      setFailureCount(prev => prev + 1);
      setHasTestedInitially(true);
      setTestingInProgress(false);
      return false;
    }
  }, [currentModel, testingInProgress, failureCount, llmConnected, testWebLLMConnection]);

  const generateWithLLM = async (prompt, stream = true, config = null) => {
    const modelToUse = config || currentModel;
    console.log('generateWithLLM called with config:', modelToUse);

    // Demo mode - return mock response
    if (modelToUse.type === 'demo') {
      return generateDemoResponse(prompt, stream);
    }

    if (modelToUse.type === 'local') {
      return generateWithLocalLLM(prompt, stream, modelToUse);
    } else if (modelToUse.type === 'external') {
      return generateWithExternalLLM(prompt, stream, modelToUse);
    } else if (modelToUse.type === 'google-oauth') {
      return generateWithGoogleOAuth(prompt, stream, modelToUse);
    } else if (modelToUse.type === 'code-assist') {
      return generateWithCodeAssist(prompt, stream, modelToUse);
    } else if (modelToUse.type === 'webllm') {
      return generateWithWebLLM(prompt, stream, modelToUse);
    }
    throw new Error('Unknown model type');
  };

  // Demo mode response generator
  const generateDemoResponse = async (prompt, stream = true) => {
    const demoResponses = [
      {
        label: "Demo Node",
        type: "concept",
        description: "This is a demonstration node showing how Graphible works",
        content: "This is demo content. Connect a real AI model to generate actual responses to your prompts."
      }
    ];

    if (stream) {
      const readableStream = new ReadableStream({
        start(controller) {
          const response = JSON.stringify(demoResponses[0]);
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ response })));
          controller.close();
        }
      });

      return {
        ok: true,
        body: readableStream,
        status: 200
      };
    } else {
      return {
        ok: true,
        json: async () => ({ response: JSON.stringify(demoResponses[0]) }),
        status: 200
      };
    }
  };

  const generateWithLocalLLM = async (prompt, stream = true, config = currentModel) => {
    console.log('generateWithLocalLLM using config:', config);
    const response = await fetch(`${config.address}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: prompt,
        stream: stream
      })
    });

    if (!response.ok) {
      throw new Error(`Local LLM request failed: ${response.status}`);
    }

    return response;
  };

  const generateWithExternalLLM = async (prompt, stream = true, config = currentModel) => {
    console.log('generateWithExternalLLM using config:', config);

    if (config.provider === 'google') {
      if (!config.apiKey || config.apiKey.trim() === '') {
        throw new Error('Google AI API key is required but not provided');
      }

      const ai = new GoogleGenAI({ apiKey: `${config.apiKey}` });

      if (stream) {
        console.log('Starting Google AI streaming generation...');
        const response = await ai.models.generateContentStream({
          model: config.model,
          contents: prompt,
          config: LLM_CONFIG.EXTERNAL.GOOGLE.DEFAULT_CONFIG
        });

        const processChunk = (chunk) => {
          let text = '';
          for (let candIdx = 0; candIdx < chunk.candidates.length; candIdx++) {
            const parts = chunk.candidates[candIdx].content.parts;
            for (let partIdx = 0; partIdx < parts.length; partIdx++) {
              text += parts[partIdx].text;
            }
          }
          return text;
        };

        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of response) {
                if (chunk) {
                  const text = processChunk(chunk);
                  const formattedChunk = JSON.stringify({ response: text });
                  controller.enqueue(new TextEncoder().encode(formattedChunk + '\n'));
                }
              }
              controller.close();
            } catch (error) {
              console.error('External AI streaming error:', error);
              controller.error(error);
            }
          }
        });

        return {
          ok: true,
          body: readableStream,
          status: 200
        };
      } else {
        console.log('Starting External AI non-streaming generation...');
        const response = await ai.models.generateContent({
          model: config.model,
          contents: prompt,
          config: LLM_CONFIG.EXTERNAL.GOOGLE.DEFAULT_CONFIG
        });

        if (response === null) {
          return {
            ok: false,
            json: async () => ({ response: '' }),
            status: 200
          };
        }

        return {
          ok: true,
          json: async () => ({ response: response.text }),
          status: 200
        };
      }
    }
    throw new Error('Unsupported external provider');
  };

  // Gemini as the signed-in Google user, over REST rather than @google/genai:
  // the SDK takes an API key, and there is no browser-side way to hand it a
  // bearer token. Both shapes are re-wrapped into the app's standard envelope.
  const generateWithGoogleOAuth = async (prompt, stream = true, config = currentModel) => {
    const token = await getAccessToken();

    if (!stream) {
      const response = await fetch(`${GEMINI_REST}/models/${config.model}:generateContent`, {
        method: 'POST',
        headers: geminiHeaders(token, config),
        body: geminiRequestBody(prompt),
      });
      if (!response.ok) throw new Error(await describeGeminiError(response));

      const data = await response.json();
      return { ok: true, status: 200, json: async () => ({ response: textFromChunk(data) }) };
    }

    // alt=sse gives one JSON object per `data:` line. Without it the endpoint
    // streams a single growing JSON array, which cannot be parsed incrementally.
    const response = await fetch(
      `${GEMINI_REST}/models/${config.model}:streamGenerateContent?alt=sse`,
      { method: 'POST', headers: geminiHeaders(token, config), body: geminiRequestBody(prompt) }
    );
    if (!response.ok) throw new Error(await describeGeminiError(response));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // A chunk can split mid-line, so the trailing partial is kept back.
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;

              const text = textFromChunk(JSON.parse(payload));
              if (text) controller.enqueue(encoder.encode(JSON.stringify({ response: text }) + '\n'));
            }
          }
          controller.close();
        } catch (error) {
          console.error('Gemini OAuth streaming error:', error);
          controller.error(error);
        }
      },
    });

    return { ok: true, status: 200, body: readableStream };
  };

  // Gemini on the signed-in user's own Code Assist allowance. Unlike every
  // other cloud path here, nothing is billed to whoever deployed Graphible.
  const generateWithCodeAssist = async (prompt, stream = true, config = currentModel) => {
    // The project comes back from loadCodeAssist and is cached on the config by
    // the connection test; re-resolving it per prompt would double the requests.
    const project = config.project ?? (await loadCodeAssist()).project;
    const settings = {
      model: config.model,
      project,
      generationConfig: LLM_CONFIG.EXTERNAL.GOOGLE.DEFAULT_CONFIG,
    };

    if (!stream) {
      const text = await generateContent(prompt, settings);
      return { ok: true, status: 200, json: async () => ({ response: text }) };
    }

    return { ok: true, status: 200, body: sseToEnvelope(await streamGenerateContent(prompt, settings)) };
  };

  const generateWithWebLLM = async (prompt, stream = true, config = currentModel) => {
    // The user has asked for something that needs the model, so this is the
    // right moment to ask for the download - not on page load, and not by
    // refusing the request and leaving them with an empty graph.
    let engine = webllmEngine;
    if (!engine || engine.modelId !== config.model) {
      await testWebLLMConnection(config, { interactive: true });
      engine = engineRef.current;
    }

    if (!engine) {
      throw new Error('Browser model is not ready. Choose another model or try again.');
    }

    try {
      if (stream) {
        const readableStream = await engine.stream(prompt);

        return {
          ok: true,
          body: readableStream,
          status: 200
        };
      } else {
        const response = await engine.generate(prompt);

        return {
          ok: true,
          json: async () => ({ response: response }),
          status: 200
        };
      }
    } catch (error) {
      console.error('WebLLM generation error:', error);
      throw error;
    }
  };

  const handleModelChange = useCallback((incomingConfig) => {
    // Every path that adopts a config - the wizard, the selector, the saved
    // blob restored at startup - funnels through here, so this is the one
    // place a retired model id has to be caught.
    const newConfig = migrateModelConfig(incomingConfig);
    console.log('handleModelChange called with:', newConfig);
    setCurrentModel(newConfig);

    // Save to localStorage for persistence
    localStorage.setItem('graphible-model-config', JSON.stringify(newConfig));

    // Save API key separately for external models
    if (newConfig.type === 'external' && newConfig.apiKey) {
      localStorage.setItem('graphible-google-api-key', newConfig.apiKey);
    }

    // Drop the Google token when leaving that backend, so the next sign-in is
    // a deliberate act rather than a token quietly outliving its use.
    if (newConfig.type !== 'google-oauth') {
      clearSession();
    }

    // Reset WebLLM engine if switching away from WebLLM
    if (newConfig.type !== 'webllm' && webllmEngine) {
      engineRef.current = null;
      setWebllmEngine(null);
      setWebllmLoadingProgress(null);
      setWebllmLoadState(WEBLLM_STATE.NULL);
    }
  }, [webllmEngine]);

  // Load saved model config on initialization
  const loadSavedConfig = useCallback(() => {
    let config = { type: 'demo' }; // DEFAULT TO DEMO MODE
    try {
      const saved = localStorage.getItem('graphible-model-config');
      if (saved) {
        config = migrateModelConfig(JSON.parse(saved));
        setCurrentModel(config);
      }
    } catch (error) {
      console.error('Failed to load saved model config:', error);
    }
    return config;
  }, []);

  return {
    llmConnected,
    currentModel,
    testLLMConnection,
    generateWithLLM,
    handleModelChange,
    loadSavedConfig,
    hasTestedInitially,
    webllmLoadingProgress,
    webllmLoadState,
    hasUserConsent,
    requestWebLLMConsent,
    consentRequest,
    resolveConsentRequest,
    connectionError,
  };
};