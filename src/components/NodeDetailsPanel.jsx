// Detailed node information display

import { useState, useRef, useEffect } from 'react';
import { X, MessageSquareQuote, ListTree, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from "react-markdown";
import { defaultPanelSize, defaultPanelPosition } from '../utils/panelLayout';
import { threadForNode, siblingsOf } from '../utils/threadUtils';
import { Z } from '../constants/zLayers';
import RemarkMathPlugin from 'remark-math';
import RehypeKatex from 'rehype-katex';


const NodeDetailsPanel = ({
  nodeDetails,
  onClose,
  feedbackHistory,
  nodes = [],
  connections = [],
  onBranchFromQuote,
  onNavigateToNode,
}) => {
  const [view, setView] = useState('node');
  const [selection, setSelection] = useState('');
  const [size, setSize] = useState(defaultPanelSize);
  const [position, setPosition] = useState(() => defaultPanelPosition(defaultPanelSize()));
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);

  // Reset only when a *different* node is opened. Keying this on the whole
  // object reset the panel on every streamed chunk, undoing any resize the
  // user had just made.
  const nodeId = nodeDetails?.id;
  useEffect(() => {
    if (nodeId !== undefined && nodeId !== null) {
      const next = defaultPanelSize();
      setSize(next);
      setPosition(defaultPanelPosition(next));
    }
  }, [nodeId]);

  const handleMouseDown = (e, action) => {
    e.preventDefault();
    e.stopPropagation();

    if (action === 'drag') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    } else if (action === 'resize') {
      setIsResizing(true);
      setInitialSize({ ...size });
      setInitialPosition({ x: e.clientX, y: e.clientY });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - size.width));
        const newY = Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - size.height));
        setPosition({ x: newX, y: newY });
      }

      if (isResizing) {
        const deltaX = e.clientX - initialPosition.x;
        const deltaY = e.clientY - initialPosition.y;

        const newWidth = Math.max(320, Math.min(initialSize.width + deltaX, window.innerWidth - position.x));
        const newHeight = Math.max(200, Math.min(initialSize.height + deltaY, window.innerHeight - position.y));

        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isDragging ? 'grabbing' : 'se-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };
  }, [isDragging, isResizing, dragStart, position, size, initialSize, initialPosition]);

  if (!nodeDetails) return null;

  const nodeFeedback = feedbackHistory.filter(f => f.nodeId === nodeDetails.id);
  const thread = threadForNode(nodeDetails.id, nodes, connections);
  const siblings = siblingsOf(nodeDetails.id, nodes, connections);
  const siblingIndex = siblings.findIndex(n => n.id === nodeDetails.id);

  // Selecting a passage and branching from it anchors the follow-up to that
  // exact text rather than to the whole reply.
  const captureSelection = () => {
    const text = window.getSelection?.().toString() ?? '';
    setSelection(text.trim());
  };

  return (
    <div
      ref={panelRef}
      className="absolute bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-xl z-50 details-panel font-inter"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        // Above the minimap, below modals. It is docked bottom-right where the
        // minimap lives, so anything lower let the minimap swallow clicks on
        // the panel's own controls.
        zIndex: Z.DETAILS_PANEL,
      }}
    >
      {/* Header with drag handle */}
      <div
        className="flex items-center justify-between p-4 border-b border-slate-200/50 cursor-move select-none"
        onMouseDown={(e) => handleMouseDown(e, 'drag')}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-slate-800 font-medium text-lg truncate">{nodeDetails.label}</h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {siblings.length > 1 && (
            <div className="flex items-center gap-1 mr-1 text-xs text-slate-500">
              <button
                onClick={() => onNavigateToNode?.(siblings[(siblingIndex - 1 + siblings.length) % siblings.length].id)}
                aria-label="Previous alternative"
                title="Previous answer from the same point"
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <ChevronLeft size={16} />
              </button>
              <span title="Answers branching from the same point">
                {siblingIndex + 1}/{siblings.length}
              </span>
              <button
                onClick={() => onNavigateToNode?.(siblings[(siblingIndex + 1) % siblings.length].id)}
                aria-label="Next alternative"
                title="Next answer from the same point"
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <button
            onClick={() => setView(v => (v === 'thread' ? 'node' : 'thread'))}
            aria-label={view === 'thread' ? 'Show this node only' : 'Show the whole thread'}
            title={view === 'thread' ? 'Show this node only' : 'Read the whole thread'}
            className={`p-1.5 rounded-lg transition-colors ${view === 'thread'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
          >
            <ListTree size={16} />
          </button>
        <button
          onClick={onClose}
          aria-label="Close details"
          title="Close details"
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
        >
          <X size={18} />
        </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col h-full">
        <div
          className="block overflow-y-auto overflow-x-hidden p-4"
          style={{ height: size.height - 90 }}
          onMouseUp={captureSelection}
        >
          {view === 'thread' ? (
            <div className="space-y-4">
              {thread.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`rounded-xl border p-3 ${entry.id === nodeDetails.id
                    ? 'border-indigo-200 bg-indigo-50/40'
                    : 'border-slate-200/60 bg-white/60'}`}
                >
                  <button
                    onClick={() => onNavigateToNode?.(entry.id)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 mb-2 block text-left"
                  >
                    {index + 1}. {entry.label}
                  </button>
                  <div className="text-slate-700 text-sm leading-relaxed prose prose-slate prose-sm max-w-none break-words">
                    <ReactMarkdown
                      remarkPlugins={[RemarkMathPlugin]}
                      rehypePlugins={[RehypeKatex]}
                    >{entry.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-700 text-sm leading-relaxed prose prose-slate max-w-none break-words">
              <ReactMarkdown
                remarkPlugins={[RemarkMathPlugin]}
                rehypePlugins={[RehypeKatex]}
              >{nodeDetails.content}</ReactMarkdown>
            </div>
          )}

          {/* Feedback history for this node */}
          {nodeFeedback.length > 0 && (
            <div className="mt-4 bg-slate-50/50 rounded-xl p-4 border border-slate-200/30">
              <p className="text-slate-800 font-medium mb-3 text-sm">Feedback History:</p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {nodeFeedback
                  .slice(-3)
                  .map((feedback, index) => (
                    <div key={index} className="text-xs flex items-start gap-2">
                      <span className={`px-2 py-1 rounded-md text-white text-xs font-medium ${feedback.isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}>
                        {feedback.isPositive ? '👍' : '👎'}
                      </span>
                      <span className="text-slate-600 flex-1 leading-relaxed">{feedback.text}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {selection && onBranchFromQuote && (
          <div className="border-t border-slate-200/60 bg-indigo-50/60 p-3 flex items-start gap-3">
            <MessageSquareQuote size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-900 flex-1 line-clamp-2 break-words">
              &ldquo;{selection.length > 140 ? selection.slice(0, 140) + '\u2026' : selection}&rdquo;
            </p>
            <button
              onClick={() => { onBranchFromQuote(selection, nodeDetails); setSelection(''); }}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors flex-shrink-0"
            >
              Ask about this
            </button>
            <button
              onClick={() => setSelection('')}
              aria-label="Dismiss quote"
              className="text-indigo-400 hover:text-indigo-600 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-slate-200 rounded-tl-lg hover:bg-slate-300 transition-colors"
          onMouseDown={(e) => handleMouseDown(e, 'resize')}
        >
          <div className="absolute bottom-1 right-1 w-1 h-1 bg-slate-400 rounded-full"></div>
          <div className="absolute bottom-1 right-2.5 w-1 h-1 bg-slate-400 rounded-full"></div>
          <div className="absolute bottom-2.5 right-1 w-1 h-1 bg-slate-400 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default NodeDetailsPanel;