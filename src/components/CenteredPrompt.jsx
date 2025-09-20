// Initial prompt interface

import { useEffect, useState, useCallback } from 'react';
import { Brain, FolderOpen, Zap, Settings } from 'lucide-react';
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

  // Global typing listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {

      // Handle single character input to start new prompt
      if (e.key.length === 1 && e.key.match(/^[a-z0-9 ]$/i)) {
        setInputPrompt(e.target.value);
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

      <div className="text-center max-w-2xl mx-4">
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl shadow-sm flex items-center justify-center">
            <Brain className="text-slate-600" size={40} />
          </div>
          <h1 className="text-5xl font-medium text-slate-800 mb-4 tracking-tight">graph.ible</h1>
          <p className="text-slate-600 text-lg">Follow what makes you curious.</p>
        </div>

        <div className="w-full bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-slate-200/50 shadow-lg">
          <div className="mb-6">
            <input
              id="main-prompt"
              onChange={(e) => setInputPrompt(e.target.value)}
              value={inputPrompt}
              placeholder="Enter your new prompt here..."
              className="w-full px-6 py-4 bg-white/80 border border-slate-200/50 rounded-xl text-slate-800 placeholder-slate-500 text-lg focus:border-slate-400 focus:outline-none shadow-sm transition-all duration-200 font-inter"
              autoFocus
              onKeyUp={handleKeyPress}
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