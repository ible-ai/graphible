// User feedback collection interface with UI adaptation

import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { extractJsonFromLlmResponse } from '../utils/llmUtils';
import { LLM_CONFIG } from '../constants/graphConstants';

const FeedbackModal = ({
  showFeedbackModal,
  onClose,
  onSubmit,
  getQuickFeedbackOptions,
  uiPersonality,
  setUiPersonality,
  adaptivePrompts,
  setAdaptivePrompts
}) => {
  const [feedbackText, setFeedbackText] = useState('');

  // Function to analyze user input for UI adaptation cues
  const analyzeForUIAdaptation = async (userInput) => {
    try {
      const existingOptions = JSON.stringify(uiPersonality);
      console.log(`ExistingUiOptions: ${existingOptions}`)

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LLM_CONFIG.LW_MODEL,
          prompt: `Analyze this user input for UI/visual style preferences.

          Look for mentions of:
          - Colors (red, blue, dark, bright, neon, pastel, etc.)
          - Styles (gothic, minimalist, retro, cyberpunk, elegant, playful, etc.)
          - Fonts (serif, sans-serif, monospace, handwritten, bubble letters, etc.)
          - Layout preferences (compact, spacious, grid, organic, etc.)
          - Animation preferences (fast, slow, bouncy, smooth, static, etc.)
          - Visual themes (corporate, creative, academic, gaming, etc.)

          Current options are: "${JSON.stringify(existingOptions)}"

          Respond with a modified version of the current options. Your response must be in JSON ONLY.

          Here are a few examples of how you should operate:
          
          1.
          USER: "I want a red background"
          \`\`\`json
          {
            "hasUIPreferences": true,
            "changes": {
              "colors": {
                "backgroundColor": "red",
              },
            },
            "reasoning": "The user requested a red background so I requested a change to colors.backgroundColor."
          }
          \`\`\`

          2.
          USER: "I want the font to be grey and shadows to be red"
          \`\`\`json
          {
            "hasUIPreferences": true,
            "changes": {
              "colors": {
                "color": "grey",
                "boxShadow":"0 4px 6px rgba(255, 0, 0, 0.3)"
              },
            },
            "reasoning": "The user requested grey text with a red shadow so I requested changes to colors.color and colors.boxShadow."
          }
          \`\`\`

          USER: "${userInput}"
          `,
          stream: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`FeedbackModal data.response: ${JSON.stringify(data.response)}`)
        const [analysis] = extractJsonFromLlmResponse(data.response);
        console.log(`FeedbackModal analysis: ${JSON.stringify(analysis)}`)

        if (analysis && analysis.hasUIPreferences) {
          return analysis;
        }
      }
    } catch (error) {
      console.log('UI adaptation analysis failed:', error);
    }
    return null;
  };

  // Function to apply UI adaptations
  const applyUIAdaptations = async (adaptations) => {
    if (!adaptations || !adaptations.changes) return;
    console.log("Entered applyUIAdaptations successfully");
    let newPersonality = JSON.parse(JSON.stringify(uiPersonality));
    console.log(`Parsed newPersonality in applyUIAdaptations successfully: ${JSON.stringify(newPersonality)}`);

    // Apply changes by merging deeply
    // if (adaptations.changes.theme) {
    //   newPersonality.theme = adaptations.changes.theme;
    // }

    // Deep merge color changes
    if (adaptations.changes.colors) {
      newPersonality.colors = {
        ...newPersonality.colors,
        ...adaptations.changes.colors
      };
    }

    // Deep merge typography changes
    if (adaptations.changes.typography) {
      newPersonality.typography = {
        ...newPersonality.typography,
        ...adaptations.changes.typography
      };
    }

    // Deep merge layout changes
    if (adaptations.changes.layout) {
      newPersonality.layout = {
        ...newPersonality.layout,
        ...adaptations.changes.layout
      };
    }

    // Deep merge effects
    if (adaptations.changes.effects) {
      newPersonality.effects = {
        ...newPersonality.effects,
        ...adaptations.changes.effects
      };
    }

    // Deep merge animations
    if (adaptations.changes.animations) {
      newPersonality.animations = {
        ...newPersonality.animations,
        ...adaptations.changes.animations
      };
    }

    // Merge custom properties
    if (adaptations.changes.customProperties) {
      newPersonality.customProperties = {
        ...newPersonality.customProperties,
        ...adaptations.changes.customProperties
      };
    }

    // Update other properties
    if (adaptations.changes.customCSS) {
      newPersonality.customCSS = adaptations.changes.customCSS;
    }

    if (adaptations.changes.decorativeElements) {
      newPersonality.decorativeElements = adaptations.changes.decorativeElements;
    }

    // Store the reasoning for this adaptation
    if (adaptations) {
      setAdaptivePrompts(prev => [...prev, {
        userInput: adaptations.reasoning,
        adaptations: adaptations.changes,
        timestamp: Date.now()
      }]);
    }
    console.log('newPersonality:', JSON.stringify(newPersonality))
    setUiPersonality(JSON.parse(JSON.stringify(newPersonality)));

    console.log('Applied UI adaptations:', adaptations);
  };

  const handleClose = useCallback(() => {
    onClose();
    setFeedbackText('');
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    // Enhanced feedback submission with UI learning
    const inputText = feedbackText;

    // Check if feedback contains UI preferences
    if (inputText && setUiPersonality) {
      setFeedbackText('');
      handleClose();
      const uiAnalysis = await analyzeForUIAdaptation(inputText);
      if (uiAnalysis) {
        await applyUIAdaptations(uiAnalysis);
      }
    }

    // Continue with normal feedback processing
    onSubmit(feedbackText);
    setFeedbackText('');
  }, [feedbackText, onSubmit, uiPersonality, setUiPersonality, setAdaptivePrompts]);

  const handleQuickSubmit = useCallback(async (option) => {
    // Enhanced quick feedback with UI learning
    if (option && setUiPersonality) {
      const uiAnalysis = await analyzeForUIAdaptation(option);
      if (uiAnalysis) {
        await applyUIAdaptations(uiAnalysis);
      }
    }

    onSubmit('', option);
    setFeedbackText('');
  }, [onSubmit, uiPersonality, setUiPersonality, setAdaptivePrompts]);

  // Handle escape key - always register the effect, but only act when modal is shown
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showFeedbackModal) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showFeedbackModal, handleClose]);

  // Reset feedback text when modal closes
  useEffect(() => {
    if (!showFeedbackModal) {
      setFeedbackText('');
    }
  }, [showFeedbackModal]);

  if (!showFeedbackModal) return null;

  const { isPositive } = showFeedbackModal;
  const quickOptions = getQuickFeedbackOptions(isPositive);

  // Apply adaptive styling based on UI personality
  const getAdaptiveModalStyles = () => {
    let styles = {};

    if (uiPersonality?.theme?.includes('goth')) {
      styles.backgroundColor = '#0a0a0a';
      styles.borderColor = '#333';
      styles.boxShadow = '0 0 30px rgba(255, 0, 0, 0.3)';
    }

    return styles;
  };

  const getAdaptiveFontStyles = () => {
    let styles = {};

    if (uiPersonality?.fontFamily?.includes('bubble')) {
      styles.fontFamily = '"Comic Sans MS", cursive, sans-serif';
      styles.fontWeight = 'bold';
    } else if (uiPersonality?.fontFamily?.includes('mono')) {
      styles.fontFamily = '"Courier New", monospace';
    } else if (uiPersonality?.fontFamily?.includes('serif')) {
      styles.fontFamily = 'Georgia, serif';
    }

    return styles;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600"
        style={{ ...getAdaptiveModalStyles(), ...getAdaptiveFontStyles() }}
      >
        {/* Inject custom CSS if needed */}
        {uiPersonality?.customCSS && (
          <style jsx>{uiPersonality.customCSS}</style>
        )}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">
            {isPositive ? 'What worked well?' : 'What needs improvement?'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {quickOptions.length > 0 && (
          <div className="mb-4">
            <p className="text-gray-300 text-sm mb-2">Quick options:</p>
            <div className="space-y-2">
              {quickOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickSubmit(option)}
                  className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-white transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-2">
            Or describe specifically (try mentioning visual preferences like "make it more gothic" or "use red colors"):
          </label>
          <input
            type="text"
            id="feedback-text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder={isPositive ? "What did you like? Any style preferences?" : "What should be improved? Any visual changes?"}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            style={getAdaptiveFontStyles()}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              } else if (e.key === 'Escape') {
                handleClose();
              }
            }}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!feedbackText.trim() && quickOptions.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Submit Feedback
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Show current UI personality if available */}
        {uiPersonality && (
          <div className="mt-4 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400">
              Current Style: {uiPersonality.theme || 'default'} • {uiPersonality.colorScheme || 'blue'}
              {adaptivePrompts?.length > 0 && ` • ${adaptivePrompts.length} adaptations`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;