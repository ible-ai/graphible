// Detailed node information display

import { useState, useRef, useEffect } from 'react';
import { X, Move } from 'lucide-react';
import ReactMarkdown from "react-markdown";
import RemarkMathPlugin from 'remark-math';
import RehypeKatex from 'rehype-katex';


const NodeDetailsPanel = ({ nodeDetails, onClose, feedbackHistory, uiPersonality }) => {
  const [position, setPosition] = useState({ x: 24, y: 120 });
  const [size, setSize] = useState({ width: 450, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);

  // Reset position and size when a new node is selected
  useEffect(() => {
    if (nodeDetails) {
      setPosition({ x: 24, y: 120 });
      setSize({ width: 384, height: 500 });
    }
  }, [nodeDetails]);

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

  return (
    <div
      ref={panelRef}
      className="absolute bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-xl z-50 details-panel font-inter"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        zIndex: 4,
      }}
    >
      {/* Header with drag handle */}
      <div
        className="flex items-center justify-between p-4 border-b border-slate-200/50 cursor-move select-none"
        onMouseDown={(e) => handleMouseDown(e, 'drag')}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-slate-800 font-medium text-lg">{nodeDetails.label}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col h-full">
        <div
          className="flex overflow-y-auto p-4"
          style={{ height: size.height - 90 }}
        >
          <div className="text-slate-700 text-sm leading-relaxed prose prose-slate max-w-none">
            <ReactMarkdown
              remarkPlugins={[RemarkMathPlugin]}
              rehypePlugins={[RehypeKatex]}
            >{nodeDetails.content}</ReactMarkdown>
          </div>

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