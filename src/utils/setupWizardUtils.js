// Shared utility functions for the Setup Wizard

import { CONNECTION_STATUS, MODEL_TYPES } from '../constants/setupWizardConstants';

// Detection utilities with abort signal support
export const detectAvailableModels = async (abortSignal) => {
    const results = {
        local: { status: CONNECTION_STATUS.IDLE, models: [], error: null },
        external: { status: CONNECTION_STATUS.IDLE, available: true }
    };

    // Test local Ollama connection with proper abort handling
    try {
        if (abortSignal?.aborted) return results;

        results.local.status = CONNECTION_STATUS.DETECTING;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

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
            results.local.error = 'Ollama server not responding';
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Detection cancelled');
            results.local.status = CONNECTION_STATUS.IDLE;
            results.local.error = 'Detection cancelled';
        } else {
            results.local.status = CONNECTION_STATUS.ERROR;
            results.local.error = error.name === 'TimeoutError' ?
                'Connection timeout - is Ollama running?' :
                'Could not connect to Ollama';
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
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

            // Chain abort signals
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
                const data = await response.json();
                return {
                    success: true,
                    response: data.response?.trim() || 'Connected successfully'
                };
            } else {
                return {
                    success: false,
                    error: `Server error: ${response.status}`,
                    suggestion: 'Check if the model is downloaded and Ollama is running'
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
    } catch (error) {
        console.log('Model test error (controlled):', error.message);

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
                suggestion: 'Check your connection and try again'
            };
        } else {
            return {
                success: false,
                error: error.message || 'Connection failed',
                suggestion: 'Please check your configuration and try again'
            };
        }
    }

    return {
        success: false,
        error: 'Unsupported configuration',
        suggestion: 'Please check your model configuration'
    };
};

// Validation utilities (unchanged)
export const validateApiKey = (key, provider = 'google') => {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'API key is required' };
    }

    const trimmed = key.trim();

    if (provider === 'google') {
        if (trimmed.length < 20) {
            return { valid: false, error: 'API key appears too short' };
        }

        if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
            return { valid: false, error: 'API key contains invalid characters' };
        }
    }

    return { valid: true, key: trimmed };
};

export const validateLocalConfig = (config) => {
    if (!config.address || typeof config.address !== 'string') {
        return { valid: false, error: 'Server address is required' };
    }

    if (!config.model || typeof config.model !== 'string') {
        return { valid: false, error: 'Model name is required' };
    }

    try {
        new URL(config.address);
    } catch {
        return { valid: false, error: 'Invalid server address format' };
    }

    return { valid: true };
};

// Storage utilities (unchanged)
export const saveSetupConfig = (config) => {
    try {
        localStorage.setItem('graphible-setup-complete', 'true');
        localStorage.setItem('graphible-model-config', JSON.stringify(config));

        // Save API key separately if it's an external config
        if (config.type === MODEL_TYPES.EXTERNAL && config.apiKey) {
            localStorage.setItem(`graphible-${config.provider}-api-key`, config.apiKey);
        }

        return true;
    } catch (error) {
        console.error('Failed to save setup config:', error);
        return false;
    }
};

export const loadSetupConfig = () => {
    try {
        const isComplete = localStorage.getItem('graphible-setup-complete') === 'true';
        const config = localStorage.getItem('graphible-model-config');

        if (isComplete && config) {
            return {
                isComplete: true,
                config: JSON.parse(config)
            };
        }
    } catch (error) {
        console.error('Failed to load setup config:', error);
    }

    return { isComplete: false, config: null };
};

export const clearSetupConfig = () => {
    try {
        localStorage.removeItem('graphible-setup-complete');
        localStorage.removeItem('graphible-model-config');
        localStorage.removeItem('graphible-google-api-key');
        return true;
    } catch (error) {
        console.error('Failed to clear setup config:', error);
        return false;
    }
};

// Animation and UI utilities (unchanged)
export const getStepProgress = (currentStep, steps) => {
    const stepIndex = steps.indexOf(currentStep);
    return stepIndex >= 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;
};

export const formatLatency = (ms) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};

export const formatModelSize = (bytes) => {
    if (!bytes) return 'Unknown size';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

// Clipboard utilities (unchanged)
export const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return { success: true };
    } catch (error) {
        console.log('copyToClipboard', error);
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
            console.log('copyToClipboard', fallbackError);
            return { success: false, error: 'Could not copy to clipboard' };
        }
    }
};

// Step navigation utilities (unchanged)
export const getNextStep = (currentStep, detectionResults) => {
    switch (currentStep) {
        case 'welcome':
            return 'detection';
        case 'detection':
            if (detectionResults?.local?.status === CONNECTION_STATUS.SUCCESS && detectionResults.local.models.length > 0) {
                return 'success';
            }
            return 'model_choice';
        case 'model_choice':
            return null;
        case 'local_setup':
            return 'testing';
        case 'api_setup':
            return 'testing';
        case 'testing':
            return 'success';
        default:
            return null;
    }
};

export const getPreviousStep = (currentStep) => {
    switch (currentStep) {
        case 'detection':
            return 'welcome';
        case 'model_choice':
            return 'detection';
        case 'local_setup':
        case 'api_setup':
        case 'demo_mode':
            return 'model_choice';
        case 'testing':
            return null;
        case 'success':
            return null;
        default:
            return 'welcome';
    }
};