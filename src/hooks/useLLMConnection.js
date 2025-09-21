// LLM connection status management

import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { WEBLLM_STATE } from '../constants/graphConstants';
import { BrowserLLMEngine } from './useBrowserLLMEngine';



export const useLLMConnection = () => {
  const [llmConnected, setLlmConnected] = useState('pending');
  const [currentModel, setCurrentModel] = useState({ type: 'demo' });
  const [testingInProgress, setTestingInProgress] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [hasTestedInitially, setHasTestedInitially] = useState(false);
  const [webllmEngine, setWebllmEngine] = useState(null);
  const [webllmLoadingProgress, setWebllmLoadingProgress] = useState(null);
  const [webllmLoadState, setWebllmLoadState] = useState(WEBLLM_STATE.NULL);
  const [hasUserConsent, setHasUserConsent] = useState(false);
  const [consentRequested, setConsentRequested] = useState(false);

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

  const initializeWebLLMWithConsent = useCallback(async (config) => {
    // Check if user has given consent
    if (!hasUserConsent) {
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

      setWebllmEngine(engine);
      setWebllmLoadingProgress(null);
      setWebllmLoadState(WEBLLM_STATE.DONE);
      return true;
    } catch (error) {
      console.error('WebLLM connection test failed:', error);
      setWebllmLoadingProgress(null);
      setWebllmEngine(null);
      setWebllmLoadState(WEBLLM_STATE.NULL);
      throw error;
    }
  }, [webllmEngine, hasUserConsent]);

  // Request consent for WebLLM download
  const requestWebLLMConsent = useCallback(async () => {
    if (consentRequested) return hasUserConsent;

    setConsentRequested(true);

    // Show consent dialog (this would be handled by the setup wizard or a dedicated component)
    const userConsented = await new Promise((resolve) => {
      // This would typically be handled by a modal component
      // For now, using a confirm dialog
      const consent = window.confirm(
        'This will download a 2GB AI model to your browser for private, offline use. ' +
        'The model will be stored locally and never shared. Continue?'
      );
      resolve(consent);
    });

    setHasUserConsent(userConsented);

    // Store consent decision
    if (userConsented) {
      localStorage.setItem('graphible-webllm-consent', 'granted');
    } else {
      localStorage.setItem('graphible-webllm-consent', 'denied');
    }

    return userConsented;
  }, [consentRequested, hasUserConsent]);

  // Load saved consent on initialization
  useEffect(() => {
    const savedConsent = localStorage.getItem('graphible-webllm-consent');
    if (savedConsent === 'granted') {
      setHasUserConsent(true);
    } else if (savedConsent === 'denied') {
      setHasUserConsent(false);
    }
    setConsentRequested(savedConsent !== null);
  }, []);

  const testWebLLMConnection = useCallback(async (config) => {
    try {
      // Check WebGPU support first (no consent needed for capability check)
      if (!navigator.gpu) {
        throw new Error('WebGPU not supported - please use Chrome/Edge 113+ or Firefox 141+');
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('WebGPU adapter not available');
      }

      // If we already have an engine, we're good
      if (webllmEngine && webllmEngine.modelId === config.model) {
        return true;
      }

      // For actual initialization, we need consent
      if (!hasUserConsent) {
        const consentGranted = await requestWebLLMConsent();
        if (!consentGranted) {
          throw new Error('User declined model download');
        }
      }

      // Now initialize with consent
      return await initializeWebLLMWithConsent(config);
    } catch (error) {
      console.error('WebLLM connection test failed:', error);
      throw error;
    }
  }, [webllmEngine, hasUserConsent, requestWebLLMConsent, initializeWebLLMWithConsent]);

  const testLLMConnection = useCallback(async (config = currentModel) => {
    const now = Date.now();
    if (testingInProgress || (now - lastTestTime.current < cooldownPeriod && failureCount >= maxFailures)) {
      console.log('Connection test throttled - too many recent failures or test in progress');
      return llmConnected === 'connected';
    }

    setTestingInProgress(true);
    setLlmConnected('pending');
    lastTestTime.current = now;

    try {
      let isConnected = false;
      if (config.type === 'local') {
        isConnected = await testLocalConnection(config);
      } else if (config.type === 'external') {
        isConnected = await testExternalConnection(config);
      } else if (config.type === 'webllm') {
        isConnected = await testWebLLMConnection(config);
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
    } else if (modelToUse.type === 'webllm') {
      return generateWithWebLLM(prompt, stream);
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
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
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
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
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

  const generateWithWebLLM = async (prompt, stream = true) => {
    if (!webllmEngine) {
      throw new Error('WebLLM engine not initialized. Please wait for model loading to complete.');
    }

    try {
      if (stream) {
        const readableStream = await webllmEngine.stream(prompt);

        return {
          ok: true,
          body: readableStream,
          status: 200
        };
      } else {
        const response = await webllmEngine.generate(prompt);

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

  const handleModelChange = useCallback((newConfig) => {
    console.log('handleModelChange called with:', newConfig);
    setCurrentModel(newConfig);

    // Save to localStorage for persistence
    localStorage.setItem('graphible-model-config', JSON.stringify(newConfig));

    // Save API key separately for external models
    if (newConfig.type === 'external' && newConfig.apiKey) {
      localStorage.setItem('graphible-google-api-key', newConfig.apiKey);
    }

    // Reset WebLLM engine if switching away from WebLLM
    if (newConfig.type !== 'webllm' && webllmEngine) {
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
        config = JSON.parse(saved);
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
  };
};