// Shared utility functions for the Setup Wizard

import { CONNECTION_STATUS, MODEL_TYPES } from '../constants/setupWizardConstants';

// Detection utilities with abort signal support
export const detectAvailableModels = async (abortSignal) => {
    const results = {
        local: { status: CONNECTION_STATUS.IDLE, models: [], error: null },
        webllm: { status: CONNECTION_STATUS.SUCCESS, supported: true },
        external: { status: CONNECTION_STATUS.SUCCESS, available: true }
    };

    // Test local Ollama connection
    try {
        if (abortSignal?.aborted) return results;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Chain abort signals
        if (abortSignal) {
            abortSignal.addEventListener('abort', () => controller.abort());
        }

        const response = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            results.local.status = CONNECTION_STATUS.SUCCESS;
            results.local.models = data.models || [];
        } else {
            results.local.status = CONNECTION_STATUS.ERROR;
            results.local.error = 'Not available';
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            results.local.status = CONNECTION_STATUS.IDLE;
            results.local.error = 'Detection cancelled';
        } else {
            results.local.status = CONNECTION_STATUS.ERROR;
            results.local.error = 'Not available';
        }
    }

    return results;
};

export const testModelConnection = async (config, abortSignal) => {
    const testPrompt = 'Test';

    try {
        if (abortSignal?.aborted) {
            return { success: false, error: 'Test cancelled', suggestion: 'Please try again' };
        }

        if (config.type === MODEL_TYPES.LOCAL) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            if (abortSignal) {
                abortSignal.addEventListener('abort', () => controller.abort());
            }

            const response = await fetch(`${config.address}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: config.model,
                    prompt: testPrompt,
                    stream: false
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                return { success: true, message: 'Connected successfully' };
            } else {
                return {
                    success: false,
                    error: 'Connection failed',
                    suggestion: 'Make sure Ollama is running and the model is downloaded'
                };
            }
        } else if (config.type === MODEL_TYPES.EXTERNAL && config.provider === 'google') {
            // Single test with timeout and abort support
            const testWithTimeout = new Promise(async (resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                try {
                    // Import dynamically
                    const { GoogleGenAI } = await import('@google/genai');
                    const ai = new GoogleGenAI({ apiKey: config.apiKey });

                    // Check abort before making request
                    if (abortSignal?.aborted) {
                        clearTimeout(timeoutId);
                        reject(new Error('Test cancelled'));
                        return;
                    }

                    const response = await ai.models.generateContent({
                        model: config.model,
                        contents: testPrompt,
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 5,
                        }
                    });

                    clearTimeout(timeoutId);
                    const text = response?.text || 'Connected successfully';
                    resolve({
                        success: true,
                        response: text.trim()
                    });
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            return await testWithTimeout;
        }

        else if (config.type === MODEL_TYPES.WEBLLM) {
            try {
                // Check WebGPU support
                if (!navigator.gpu) {
                    return {
                        success: false,
                        error: 'WebGPU not supported',
                        suggestion: 'Please use Chrome 113+, Firefox 141+, or Safari 26+'
                    };
                }

                // Check adapter availability
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) {
                    return {
                        success: false,
                        error: 'WebGPU adapter not available',
                        suggestion: 'Please ensure your browser supports WebGPU'
                    };
                }

                return { success: true, message: 'Browser AI ready' };
            } catch (error) {
                console.log('webLLM test failed:', error);
                return {
                    success: false,
                    error: 'Browser compatibility issue',
                    suggestion: 'Please update your browser or try a different browser'
                };
            }
        }

        return {
            success: false,
            error: 'Unsupported configuration',
            suggestion: 'Please check your setup'
        };

    } catch (error) {
        if (error.name === 'AbortError' || error.message === 'Test cancelled') {
            return {
                success: false,
                error: 'Test cancelled',
                suggestion: 'Please try again'
            };
        }

        // Provide specific error messages
        if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('401')) {
            return {
                success: false,
                error: 'Invalid API key',
                suggestion: 'Please check your API key and try again'
            };
        } else if (error.message?.includes('RATE_LIMIT')) {
            return {
                success: false,
                error: 'Rate limit exceeded',
                suggestion: 'Please wait a moment and try again'
            };
        } else if (error.message?.includes('timeout')) {
            return {
                success: false,
                error: 'Connection timeout',
                suggestion: 'Please check your internet connection'
            };
        } else {
            return {
                success: false,
                error: 'Setup failed',
                suggestion: 'Please check your configuration and try again'
            };
        }
    }
};

// Validation utilities
export const validateApiKey = (key, provider = 'google') => {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'API key is required' };
    }

    const trimmed = key.trim();

    if (provider === 'google') {
        if (trimmed.length < 10) {
            return { valid: false, error: 'API key appears too short' };
        }
    }

    return { valid: true, key: trimmed };
};

export const saveSetupConfig = (config) => {
    try {
        // Mark setup as complete
        localStorage.setItem('graphible-setup-complete', 'true');
        localStorage.setItem('graphible-setup-timestamp', Date.now().toString());

        // Save the model configuration
        const configToSave = { ...config };

        // For external configs, save API key separately for security
        if (config.type === MODEL_TYPES.EXTERNAL && config.apiKey) {
            localStorage.setItem(`graphible-${config.provider}-api-key`, config.apiKey);
            // Don't save API key in main config
            delete configToSave.apiKey;
        }

        localStorage.setItem('graphible-model-config', JSON.stringify(configToSave));

        return true;
    } catch (error) {
        console.error('Failed to save setup config:', error);
        return false;
    }
};

export const loadSetupConfig = () => {
    try {
        const isComplete = localStorage.getItem('graphible-setup-complete') === 'true';
        const configStr = localStorage.getItem('graphible-model-config');

        if (isComplete && configStr) {
            const config = JSON.parse(configStr);

            // For external configs, load API key separately
            if (config.type === MODEL_TYPES.EXTERNAL && config.provider) {
                const apiKey = localStorage.getItem(`graphible-${config.provider}-api-key`);
                if (apiKey) {
                    config.apiKey = apiKey;
                }
            }

            return { isComplete: true, config };
        }
    } catch (error) {
        console.error('Failed to load setup config:', error);
    }

    return { isComplete: false, config: null };
};

export const clearSetupConfig = () => {
    try {
        localStorage.removeItem('graphible-setup-complete');
        localStorage.removeItem('graphible-setup-timestamp');
        localStorage.removeItem('graphible-model-config');
        localStorage.removeItem('graphible-google-api-key');
        return true;
    } catch (error) {
        console.error('Failed to clear setup config:', error);
        return false;
    }
};

// Animation and UI utilities
export const getStepProgress = (currentStep, steps) => {
    const stepIndex = steps.indexOf(currentStep);
    return stepIndex >= 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;
};

export const checkBrowserCompatibility = () => {
    const results = {
        webgpu: false,
        modern: false,
        recommended: false
    };

    // Check for WebGPU support
    results.webgpu = !!navigator.gpu;

    // Check for modern browser features
    results.modern = !!(navigator.gpu && window.WebAssembly && window.Worker);

    // Check for recommended browsers
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome\/(\d+)/.test(userAgent);
    const isFirefox = /Firefox\/(\d+)/.test(userAgent);
    const isSafari = /Safari\//.test(userAgent) && !/Chrome/.test(userAgent);

    if (isChrome) {
        const chromeVersion = parseInt(userAgent.match(/Chrome\/(\d+)/)[1]);
        results.recommended = chromeVersion >= 113;
    } else if (isFirefox) {
        const firefoxVersion = parseInt(userAgent.match(/Firefox\/(\d+)/)[1]);
        results.recommended = firefoxVersion >= 141;
    } else if (isSafari) {
        // Safari support is more complex to detect, assume modern versions work
        results.recommended = true;
    }

    return results;
};

// Clipboard utility
export const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return { success: true };
    } catch (error) {
        console.log('copyToClipboard failed:', error);
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            return { success: successful };
        } catch (fallbackError) {
            console.log('copyToClipboard fallback failed:', fallbackError);
            return { success: false, error: 'Could not copy to clipboard' };
        }
    }
};