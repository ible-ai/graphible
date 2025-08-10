// Initial prompt interface

import { useState } from 'react';
import { Brain, FolderOpen } from 'lucide-react';

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
          <Brain className="mx-auto mb-4 text-blue-400" size={64} />
          <h1 className="text-4xl font-bold text-white mb-2">Wander</h1>
          <p className="text-gray-300">Follow what makes you curious.</p>
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
              onClick={onShowSaveLoad}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <FolderOpen size={16} />
              Load Saved
            </button>
          </div>

          {llmConnected !== 'connected' && (
            <div className="mt-4 text-xs text-orange-400 bg-orange-900/20 p-3 rounded">
              ⚡ Install Ollama and run "ollama serve" then restart this app
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CenteredPrompt;