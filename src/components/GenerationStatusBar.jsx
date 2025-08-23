// Shows LLM generation progress

import { Brain, Circle } from 'lucide-react';

const GenerationStatusBar = ({ generationStatus, streamingContent }) => {
  if (!generationStatus.isGenerating) return null;

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200/50 min-w-[320px] shadow-lg font-inter">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center">
            <Brain size={16} className="text-slate-600 animate-pulse" />
          </div>
          <span className="text-slate-800 font-medium">Building nodes...</span>
        </div>

        <div className="flex-1 flex items-center justify-end gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Circle size={8} className="fill-emerald-500 text-emerald-500 animate-pulse" />
            <span>{generationStatus.tokensGenerated} tokens</span>
          </div>
          <div className="flex items-center gap-1">
            <span>⏱️</span>
            <span>{formatTime(generationStatus.elapsedTime)}</span>
          </div>
          {generationStatus.currentNodeId !== null && (
            <div className="text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-xs">
              Node: {generationStatus.currentNodeId}
            </div>
          )}
        </div>
      </div>

      {streamingContent && (
        <div className="mt-4 p-3 bg-slate-50/80 rounded-xl border border-slate-200/30 max-h-24 overflow-y-auto">
          <div className="font-mono text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
            {streamingContent.substring(Math.max(0, streamingContent.length - 300))}
            {streamingContent.length > 300 && '...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerationStatusBar;