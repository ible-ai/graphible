// LLM connection status management

import { useState, useCallback } from 'react';
import { LLM_CONFIG } from '../constants/graphConstants';

export const useLLMConnection = () => {
  const [llmConnected, setLlmConnected] = useState('pending');

  const testLLMConnection = useCallback(async () => {
    setLlmConnected('pending');
    try {
      const response = await fetch(`${LLM_CONFIG.BASE_URL}${LLM_CONFIG.TAGS_ENDPOINT}`);
      if (response.ok) {
        setLlmConnected('connected');
        return true;
      }
    } catch (error) {
      console.error('LLM not connected. Please ensure your local server is running and accessible.', error);
    }
    setLlmConnected('disconnected');
    return false;
  }, []);

  return {
    llmConnected,
    testLLMConnection
  };
};