// User feedback collection and analysis

import { useState } from 'react';
import { LLM_CONFIG } from '../constants/graphConstants';
import { extractJsonFromLlmResponse, createFeedbackAnalysisPrompt } from '../utils/llmUtils';

export const useFeedback = () => {
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackCategories, setFeedbackCategories] = useState({
    content: { positive: [], negative: [] },
    visual: { positive: [], negative: [] },
    layout: { positive: [], negative: [] },
    interaction: { positive: [], negative: [] }
  });
  const [showFeedbackModal, setShowFeedbackModal] = useState(null);

  const analyzeFeedback = async (nodeId, isPositive, userInput) => {
    try {
      const response = await fetch(`${LLM_CONFIG.BASE_URL}${LLM_CONFIG.GENERATE_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LLM_CONFIG.MODEL,
          prompt: createFeedbackAnalysisPrompt(userInput, isPositive),
          stream: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        try {
          return extractJsonFromLlmResponse(data.response);
        } catch (e) {
          console.error("Failed to parse feedback analysis JSON:", e);
          return [null, null];
        }
      }
    } catch (error) {
      console.log('Feedback analysis error:', error);
    }
    return [null, null];
  };

  const submitFeedback = async (feedbackText, quickOption = null) => {
    const { nodeId, isPositive } = showFeedbackModal;
    const inputText = quickOption || feedbackText;

    if (!inputText.trim()) {
      setShowFeedbackModal(null);
      return;
    }

    try {
      const [analysis, _] = await analyzeFeedback(nodeId, isPositive, inputText);

      const feedback = {
        nodeId,
        isPositive,
        text: inputText,
        analysis,
        timestamp: Date.now()
      };

      setFeedbackHistory(prev => [...prev, feedback]);

      if (analysis && analysis.category) {
        const category = analysis.category;
        const sentiment = isPositive ? 'positive' : 'negative';

        setFeedbackCategories(prev => ({
          ...prev,
          [category]: {
            ...prev[category],
            [sentiment]: [...(prev[category]?.[sentiment] || []), {
              concern: analysis.concern,
              suggestion: analysis.suggestion,
              count: 1
            }]
          }
        }));
      }

      console.log('Feedback submitted:', feedback);

    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setShowFeedbackModal(null);
    }
  };

  const getQuickFeedbackOptions = (isPositive) => {
    const hasHistory = feedbackHistory.length > 2;
    if (!hasHistory) return [];

    if (isPositive) {
      return [
        'Content was helpful and clear',
        'Visual design looks great',
        'Layout and positioning work well',
        'Interaction feels smooth'
      ];
    } else {
      return [
        'Content needs more detail',
        'Colors or design need improvement',
        'Layout is confusing',
        'Navigation is difficult'
      ];
    }
  };

  return {
    feedbackHistory,
    feedbackCategories,
    showFeedbackModal,
    setShowFeedbackModal,
    submitFeedback,
    getQuickFeedbackOptions
  };
};