// Pop-up prompt input interface for new prompts (i.e. all prompts after the landing page prompt).

import { useState, useCallback, useEffect } from 'react';
import { X, Send } from 'lucide-react';

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
  }, [isTypingPrompt, generationStatus.isGenerating]);

  const handleClose = useCallback(() => {
    setIsTypingPrompt(false);
    setNewPromptInput('');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!newPromptInput.trim()) return;

    setIsTypingPrompt(false);

    let finalPromptToLLM = newPromptInput;
    
    // TODO: allow user to select nodes for inclusion.
    if (includeContext) {
      let contextString = `Building on our previous discussion about "${initialPromptText}".`;
      if (currentNodeId && nodeDetails) {
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
  }, [newPromptInput, includeContext, initialPromptText, currentNodeId, nodeDetails, onGenerate]);

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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl mx-4">
      <div className="bg-black/90 backdrop-blur rounded-lg p-4 border border-gray-600 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-lg font-semibold">New Prompt</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Close (ESC)"
          >
            <X size={20} />
          </button>
        </div>
        
        <input
          type="text"
          value={newPromptInput}
          onChange={(e) => setNewPromptInput(e.target.value)}
          placeholder="Enter your new prompt here..."
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 text-lg focus:border-blue-500 focus:outline-none"
          autoFocus
          onKeyDown={handleKeyPress}
        />
        
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center text-gray-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-600 focus:ring-blue-500 bg-gray-700"
            />
            Include Previous Context
          </label>
          
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!newPromptInput.trim() || generationStatus.isGenerating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {generationStatus.isGenerating ?
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> :
                <Send size={16} />
              }
              {generationStatus.isGenerating ? 'Generating...' : 'Submit'}
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewPromptBox;