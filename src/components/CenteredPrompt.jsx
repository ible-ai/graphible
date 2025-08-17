// Initial prompt interface

import { useState } from 'react';
import { Brain, FolderOpen, Globe, Zap } from 'lucide-react';

const CenteredPrompt = ({ 
  showPromptCenter, 
  llmConnected, 
  onSubmit, 
  onShowSaveLoad 
}) => {
  const [currentMainPrompt, setCurrentMainPrompt] = useState(
    'I want to understand and play with a transformer architecture in a visual capacity'
  );

  const handleInputChange = (e) => {
    if (e.key === 'Enter') return;
    setCurrentMainPrompt(e.target.value);
  };

  if (!showPromptCenter) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-20">
      <div className="text-center max-w-2xl mx-4">
        <div className="mb-8">
          <Brain className="mx-auto mb-4 text-blue-400 animate-pulse" size={64} />
          <h1 className="text-4xl font-bold text-white mb-2">Graphible</h1>
          <p className="text-gray-300">Follow what makes you curious.</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Globe size={16} className="text-green-400" />
            <span className="text-sm text-green-400">Web App Ready</span>
          </div>
        </div>
        
        <div 
          className="w-full bg-black/80 backdrop-blur rounded-lg p-6 border border-gray-600" 
          style={{
            width: '750px',
            overflowY: 'hidden',
            minHeight: '100px',
            maxHeight: '1000px',
            boxSizing: 'border-box'
          }}
        >
          <div className="items-center gap-3 mb-4">
            <textarea
              id="main-prompt"
              value={currentMainPrompt}
              onChange={handleInputChange}
              placeholder="What do you want to explore?"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-lg focus:border-blue-500 focus:outline-none resize-none overflow-hidden"
              onKeyUp={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(currentMainPrompt);
                }
              }}
              autoFocus
            />
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => onSubmit(currentMainPrompt)}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2"
            >
              <Zap size={20} />
              Go
            </button>
            <button
              onClick={onShowSaveLoad}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <FolderOpen size={16} />
              Load Saved
            </button>
          </div>

          {/* Connection Status */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">LLM Connection:</span>
              <div className="flex items-center gap-2">
                {llmConnected === 'connected' && (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-400">Ollama Connected</span>
                  </>
                )}
                {llmConnected === 'pending' && (
                  <>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-yellow-400">Connecting...</span>
                  </>
                )}
                {llmConnected === 'disconnected' && (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-red-400">Offline</span>
                  </>
                )}
              </div>
            </div>
            
            {llmConnected !== 'connected' && (
              <div className="mt-2 text-xs text-orange-400 bg-orange-900/20 p-2 rounded">
                <strong>To connect local LLM:</strong><br />
                1. Install <a href="https://ollama.ai" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Ollama</a><br />
                2. Run: <code className="bg-gray-700 px-1 rounded">OLLAMA_ORIGINS=* ollama serve</code><br />
                3. Pull model: <code className="bg-gray-700 px-1 rounded">ollama pull gemma3:4b</code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CenteredPrompt;