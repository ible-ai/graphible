// LLM connection status management

import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { LLM_CONFIG } from '../constants/graphConstants';
import { MLCEngine } from "@mlc-ai/web-llm";

export const useLLMConnection = () => {
  const [llmConnected, setLlmConnected] = useState('pending');
  const [currentModel, setCurrentModel] = useState({
    type: 'local',
    address: 'http://localhost:11434',
    model: LLM_CONFIG.MODEL
  });
  const [testingInProgress, setTestingInProgress] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [hasTestedInitially, setHasTestedInitially] = useState(false);
  const [webllmEngine, setWebllmEngine] = useState(null);
  const [webllmLoadingProgress, setWebllmLoadingProgress] = useState(null);

  const lastTestTime = useRef(0);
  const maxFailures = 3;
  const cooldownPeriod = 5000; // 5 seconds

  const testLocalConnection = async (config) => {
    try {
      const response = await fetch(`${config.address}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('Local LLM connection test failed:', error);
      return false;
    }
  };

  const testExternalConnection = async (config) => {
    try {
      // Test Google AI API connection using the official SDK
      if (config.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey: `${config.apiKey}` });
        console.log(ai);
        console.log(ai.apiKey);


        // Simple test request using the correct API structure
        const response = await ai.models.generateContent({
          model: config.model,
          contents: "test"
        });
        console.log("External response", response);

        // If we get here without error, connection is successful
        return true;
      }
      return false;
    } catch (error) {
      console.error('External API connection test failed:', error);
      // Check for specific error types
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('401')) {
        throw new Error('Invalid API key');
      }
      return false;
    }
  };

  const testWebLLMConnection = useCallback(async (config) => {
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
      console.log('Initializing WebLLM engine with model:', config.model);

      const initProgressCallback = (progress) => {
        console.log('WebLLM loading progress:', progress);
        setWebllmLoadingProgress(progress);
      };

      const engine = new MLCEngine({
        initProgressCallback: initProgressCallback
      });
      await engine.reload(config.model);

      setWebllmEngine(engine);
      setWebllmLoadingProgress(null);
      console.log('WebLLM engine initialized successfully');

      return true;
    } catch (error) {
      console.error('WebLLM connection test failed:', error);
      setWebllmLoadingProgress(null);
      setWebllmEngine(null);
      throw error;
    }
  }, [webllmEngine]);

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
      }

      if (isConnected) {
        setLlmConnected('connected');
        setFailureCount(0); // Reset failure count on success
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

    if (modelToUse.type === 'local') {
      return generateWithLocalLLM(prompt, stream, modelToUse);
    } else if (modelToUse.type === 'external') {
      return generateWithExternalLLM(prompt, stream, modelToUse);
    } else if (modelToUse.type === 'webllm') {
      return generateWithWebLLM(prompt, stream);
    }
    throw new Error('Unknown model type');
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
        // Use streaming generation with the correct API structure
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

        // Create a ReadableStream to match the expected interface
        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of response) {
                if (chunk) {
                  // Format the response to match expected structure
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

        // Return response object with the stream
        return {
          ok: true,
          body: readableStream,
          status: 200
        };
      } else {
        // Non-streaming generation
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

        // Create a response that matches the expected format
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

        // WebLLM streaming using async generator
        const asyncChunkGenerator = await webllmEngine.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        });

        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of asyncChunkGenerator) {
                if (chunk.choices[0]?.delta?.content) {
                  const text = chunk.choices[0].delta.content;
                  const formattedChunk = JSON.stringify({ response: text });
                  controller.enqueue(new TextEncoder().encode(formattedChunk + '\n'));
                }
              }
              controller.close();
            } catch (error) {
              console.error('WebLLM streaming error:', error);
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
        const response = await webllmEngine.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2048,
        });

        const text = response.choices[0]?.message?.content || '';

        return {
          ok: true,
          json: async () => ({ response: text }),
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

    // Also save API key separately for external models
    if (newConfig.type === 'external' && newConfig.apiKey) {
      localStorage.setItem('graphible-google-api-key', newConfig.apiKey);
    }

    // Reset WebLLM engine if switching away from WebLLM
    if (newConfig.type !== 'webllm' && webllmEngine) {
      setWebllmEngine(null);
      setWebllmLoadingProgress(null);
    }
  }, [webllmEngine]);

  // Load saved model config on initialization
  const loadSavedConfig = useCallback(() => {
    try {
      const saved = localStorage.getItem('graphible-model-config');
      if (saved) {
        const config = JSON.parse(saved);
        setCurrentModel(config);
        return config;
      }
    } catch (error) {
      console.error('Failed to load saved model config:', error);
    }
    // Return the default local config
    return {
      type: 'local',
      address: 'http://localhost:11434',
      model: LLM_CONFIG.MODEL
    };
  }, []);

  return {
    llmConnected,
    currentModel,
    testLLMConnection,
    generateWithLLM,
    handleModelChange,
    loadSavedConfig,
    hasTestedInitially,
    webllmEngine,
    webllmLoadingProgress,
  };
};