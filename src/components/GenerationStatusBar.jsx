// components/GenerationStatusBar.jsx - Shows LLM generation progress

import { Zap, Circle } from 'lucide-react';

const GenerationStatusBar = ({ generationStatus, streamingContent }) => {
  if (!generationStatus.isGenerating) return null;

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 bg-blue-900/90 backdrop-blur rounded-lg p-4 border border-blue-500 min-w-[300px]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="animate-pulse">
            <Zap size={20} className="text-yellow-400" />
          </div>
          <span className="text-white font-semibold">building nodes.</span>
        </div>

        <div className="flex-1 flex items-center gap-4 text-sm text-blue-200">
          <div className="flex items-center gap-1">
            <Circle size={8} className="fill-green-400 text-green-400 animate-pulse" />
            <span>{generationStatus.tokensGenerated} tokens</span>
          </div>
          <div>⏱️ {formatTime(generationStatus.elapsedTime)}</div>
          {generationStatus.currentNodeId !== null && (
            <div className="text-blue-300">
              Node: {generationStatus.currentNodeId}
            </div>
          )}
        </div>
      </div>

      {streamingContent && (
        <div className="mt-3 p-2 bg-black/30 rounded text-xs text-gray-300 max-h-20 overflow-y-auto">
          <div className="font-mono whitespace-pre-wrap">
            {streamingContent.substring(Math.max(0, streamingContent.length - 200))}...
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerationStatusBar;