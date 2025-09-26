// Initial prompt interface

import { useEffect, useState, useCallback } from 'react';
import { Waypoints, FolderOpen, Zap, Settings } from 'lucide-react';
import ModelSelector from './ModelSelector';

const CenteredPrompt = ({
  showPromptCenter,
  setShowPromptCenter,
  llmConnected,
  onSubmit,
  onShowSaveLoad,
  onShowInstallationGuide,
  currentModel,
  onModelChange,
  onTestConnection,
  onShowSetupWizard,
  webllmLoadingProgress,
  webllmLoadState,
}) => {
  const [inputPrompt, setInputPrompt] = useState(
    'I want to understand the transformer architecture.'
  );
  const [isTyping, setIsTyping] = useState(false);

  const defaultText = 'I want to understand the transformer architecture.';

  // Calculate how much the user has deviated from default text
  const getTypingProgress = useCallback(() => {
    // If they have the exact default text, no progress
    if (inputPrompt === defaultText) return 0;

    const textLength = inputPrompt.length;
    const defaultLength = defaultText.length;

    // If they've cleared the text entirely and haven't started typing yet
    if (textLength === 0) return 0;

    // Check if current text is a prefix of default (user is deleting from default)
    const isDeleteFromDefault = defaultText.startsWith(inputPrompt) && textLength < defaultLength;

    // Check if current text starts with default (user is adding to default)
    const isAddingToDefault = inputPrompt.startsWith(defaultText) && textLength > defaultLength;

    // If they're deleting from default text, start showing progress once they've deleted some
    if (isDeleteFromDefault) {
      const deletedChars = defaultLength - textLength;
      return Math.min(deletedChars / 20, 0.3); // Show some effect when deleting
    }

    // If they're adding to default text
    if (isAddingToDefault) {
      const additionalChars = textLength - defaultLength;
      return Math.min(additionalChars / 30, 1);
    }

    // If they've completely replaced or are typing from scratch
    if (textLength > 0) {
      return Math.min(textLength / 50, 1); // Max out at 50 characters for full effect
    }

    return 0;
  }, [inputPrompt, defaultText]);

  // Global typing listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't interfere if user is typing in any input, textarea, or select element
      if (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.tagName === 'SELECT' ||
          e.target.isContentEditable) {
        return;
      }

      // Handle single character input to start new prompt
      if (e.key.length === 1 && e.key.match(/^[a-z0-9 ]$/i)) {
        setInputPrompt(e.key);
        setIsTyping(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [setInputPrompt]);


  const handleSubmit = useCallback(() => {
    onSubmit(inputPrompt);
    setShowPromptCenter(false);
  }, [onSubmit, inputPrompt, setShowPromptCenter]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleInputChange = useCallback((e) => {
    setInputPrompt(e.target.value);
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsTyping(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsTyping(false);
  }, []);

  if (!showPromptCenter) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center z-20 bg-gradient-to-br from-slate-50 to-slate-100 font-inter">
      {/* Model Selector - positioned same as in main interface */}
      <div className="absolute top-6 left-6 z-30">
        <ModelSelector
          currentModel={currentModel}
          onModelChange={onModelChange}
          connectionStatus={llmConnected}
          onTestConnection={onTestConnection}
          webllmLoadingProgress={webllmLoadingProgress}
          webllmLoadState={webllmLoadState}
        />
      </div>

      <div className={`text-center max-w-2xl mx-4 transition-all duration-700 ease-out`}
           style={{
             transform: `translateY(${getTypingProgress() * -32}px)`
           }}>
        <div className="mb-8 transition-all duration-700 ease-out"
             style={{
               opacity: Math.max(0.3, 1 - getTypingProgress() * 0.7),
               transform: `scale(${Math.max(0.9, 1 - getTypingProgress() * 0.1)})`,
               filter: `blur(${getTypingProgress() * 3}px) saturate(${Math.max(0.5, 1 - getTypingProgress() * 0.5)})`
             }}>
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl shadow-sm flex items-center justify-center transition-all duration-500"
               style={{
                 opacity: Math.max(0.2, 1 - getTypingProgress() * 0.8),
                 filter: `blur(${getTypingProgress() * 2}px)`
               }}>
            <Waypoints className="text-slate-600" size={40} />
          </div>
          <h1 className="text-5xl font-medium text-slate-800 mb-4 tracking-tight transition-all duration-700 ease-out"
              style={{
                opacity: Math.max(0.1, 1 - getTypingProgress() * 0.9),
                filter: `blur(${getTypingProgress() * 4}px) contrast(${Math.max(0.3, 1 - getTypingProgress() * 0.7)})`,
                textShadow: getTypingProgress() > 0.5 ? '0 0 20px rgba(148, 163, 184, 0.3)' : 'none'
              }}>graph.ible</h1>
          <p className="text-slate-600 text-lg transition-all duration-500"
             style={{
               opacity: Math.max(0.2, 1 - getTypingProgress() * 0.8),
               filter: `blur(${getTypingProgress() * 2}px)`
             }}>Follow what makes you curious.</p>
        </div>

        <div className={`w-full bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-slate-200/50 shadow-lg transition-all duration-500 ${isTyping ? 'shadow-xl bg-white/90 border-slate-300/70' : ''}`}>
          <div className="mb-6">
            <textarea
              id="main-prompt"
              onChange={handleInputChange}
              value={inputPrompt}
              placeholder="Enter your new prompt here..."
              className={`w-full px-6 bg-white/80 border border-slate-200/50 rounded-xl text-slate-800 placeholder-slate-500 text-lg focus:border-slate-400 focus:outline-none shadow-sm transition-all duration-300 font-inter resize-none overflow-hidden ${isTyping ? 'bg-white/95 border-slate-300/80' : ''}`}
              autoFocus
              onKeyUp={handleKeyPress}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              rows={Math.max(1, Math.ceil(inputPrompt.length / 80))}
              style={{
                minHeight: '60px',
                maxHeight: '200px',
                height: 'auto',
                paddingTop: '16px',
                paddingBottom: '24px',
                lineHeight: '1.5'
              }}
            />
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => onSubmit(inputPrompt)}
              className="flex-1 px-8 py-4 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all duration-200 font-medium flex items-center justify-center gap-3 shadow-lg font-inter"
            >
              <Zap size={20} />
              Start Exploring
            </button>
            <button
              onClick={onShowSaveLoad}
              className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 flex items-center gap-3 transition-all duration-200 shadow-sm font-inter"
            >
              <FolderOpen size={18} />
              Load
            </button>
            <button
              onClick={onShowSetupWizard}
              className="px-6 py-4 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-100 hover:border-indigo-300 flex items-center gap-3 transition-all duration-200 shadow-sm font-inter"
              title="Setup Wizard"
            >
              <Settings size={18} />
              Setup
            </button>
          </div>

          {/* Connection Status */}
          {llmConnected === 'disconnected' && (
            <div className="bg-rose-50/50 backdrop-blur-sm rounded-xl p-4 border border-rose-200/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 bg-rose-500 rounded-full shadow-rose-500/50 shadow-sm"></div>
                <span className="text-rose-700 font-medium text-sm">No model connected</span>
              </div>

              <div className="text-sm text-slate-600">
                <div className="mb-2">You can still try to generate content, or configure a model first:</div>
                <button
                  onClick={onShowInstallationGuide}
                  className="text-indigo-600 hover:text-indigo-500 underline text-sm font-medium inline-block"
                >
                  View setup guide →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CenteredPrompt;