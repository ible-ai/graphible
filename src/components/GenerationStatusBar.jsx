// Shows LLM generation progress

import { Brain, Circle, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import RemarkMathPlugin from 'remark-math';
import RehypeKatex from 'rehype-katex';

const GenerationStatusBar = ({ generationStatus, streamingContent, onCancel }) => {
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
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              title="Stop generating"
            >
              <X size={14} />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* A live tail of the reply, rendered as Markdown while it streams.
          Partial Markdown renders fine, and showing raw source until the last
          token made a normal generation look broken. */}
      {streamingContent && (
        <div className="mt-3 pt-3 border-t border-slate-200/60">
          <div className="text-xs text-slate-600 leading-relaxed max-h-28 overflow-hidden text-left prose prose-slate prose-sm max-w-none break-words">
            <ReactMarkdown remarkPlugins={[RemarkMathPlugin]} rehypePlugins={[RehypeKatex]}>
              {streamingContent.length > 500
                ? '\u2026' + streamingContent.slice(-500)
                : streamingContent}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerationStatusBar;