// Pop-up prompt input interface with consistent modern styling

import { useState, useCallback, useEffect } from 'react';
import { X, Send, Link, Sparkles } from 'lucide-react';

const NewPromptBox = ({
  initialPromptText,
  currentNodeId,
  nodeDetails,
  generationStatus,
  onGenerate,
  isTypingPrompt,
  setIsTypingPrompt,
  uiPersonality,
  setUiPersonality,
  adaptivePrompts,
  setAdaptivePrompts,
  nodes,
  setConnections
}) => {
  const [newPromptInput, setNewPromptInput] = useState('');
  const [includeContext, setIncludeContext] = useState(true);

  // Global typing listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't handle if already typing or in other modals
      if (isTypingPrompt || generationStatus.isGenerating) return;

      // Don't handle if focused on an input element
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Handle single character input to start new prompt
      if (e.key.length === 1 && e.key.match(/^[a-z0-9 ]$/i)) {
        setNewPromptInput(e.key);
        setIsTypingPrompt(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isTypingPrompt, generationStatus.isGenerating, setIsTypingPrompt]);

  const handleClose = useCallback(() => {
    setIsTypingPrompt(false);
    setNewPromptInput('');
  }, [setIsTypingPrompt]);

  const handleSubmit = useCallback(async () => {
    if (!newPromptInput.trim()) return;

    setIsTypingPrompt(false);

    let finalPromptToLLM = newPromptInput;

    // TODO: allow user to select nodes for inclusion.
    if (includeContext) {
      let contextString = `Building on our previous discussion about "${initialPromptText}".`;
      if (currentNodeId !== null && nodeDetails) {
        contextString += ` Currently focused on the node "${nodeDetails.label}" (ID: ${currentNodeId}) which describes "${nodeDetails.description}". Its content is: "${nodeDetails.content}".`;
      }
      contextString += ` Now, based on this context, please generate a new graph for: "${finalPromptToLLM}"`;
      finalPromptToLLM = contextString;

      // Only include a connection if the user specifies to carry the context forward.
      setConnections(prevConnections => [...prevConnections, {
        from: currentNodeId,
        to: nodes.length
      }]);
    }
    const curNode = nodes[currentNodeId];
    await onGenerate(finalPromptToLLM, curNode.worldX, curNode.worldY);
    setNewPromptInput('');
  }, [newPromptInput, includeContext, initialPromptText, currentNodeId, nodeDetails, onGenerate, nodes, setConnections, setIsTypingPrompt]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }, [handleSubmit, handleClose]);

  if (!isTypingPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-40 font-inter">
      <div className="w-full max-w-2xl mx-4">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl flex items-center justify-center">
                <Sparkles className="text-indigo-600" size={16} />
              </div>
              <h3 className="text-slate-800 text-lg font-medium">Continue Exploring</h3>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100/50"
              title="Close (ESC)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Context indicator */}
            {includeContext && nodeDetails && (
              <div className="mb-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-200/30">
                <div className="flex items-start gap-3">
                  <Link className="text-indigo-500 mt-0.5" size={16} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-indigo-800">
                      Building from: {nodeDetails.label}
                    </p>
                    <p className="text-xs text-indigo-600 mt-1 line-clamp-2">
                      {nodeDetails.description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Input field */}
            <div className="mb-4">
              <input
                type="text"
                value={newPromptInput}
                onChange={(e) => setNewPromptInput(e.target.value)}
                placeholder="What would you like to explore next?"
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200/50 rounded-xl text-slate-800 placeholder-slate-500 text-base focus:border-indigo-300 focus:bg-white/80 focus:outline-none transition-all duration-200 shadow-sm"
                autoFocus
                onKeyDown={handleKeyPress}
              />
            </div>

            {/* Options */}
            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center text-slate-600 text-sm cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={includeContext}
                    onChange={(e) => setIncludeContext(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 transition-all duration-200 ${includeContext
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'border-slate-300 group-hover:border-slate-400'
                    }`}>
                    {includeContext && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="ml-3">Include previous context</span>
              </label>

              <div className="text-xs text-slate-500">
                Press Enter to continue • ESC to cancel
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!newPromptInput.trim() || generationStatus.isGenerating}
                className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-200 font-medium shadow-lg"
              >
                {generationStatus.isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Continue Exploring
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 font-medium shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewPromptBox;