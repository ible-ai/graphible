// Node component

import { useState, memo, useMemo, useCallback } from 'react';
import { Circle, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import { NODE_SIZE } from '../constants/graphConstants';
import { withAlpha } from '../utils/colorUtils';

const NodeComponent = memo(({
  node,
  isCurrent,
  isStreaming,
  onClick,
  onFeedback,
  colorScheme,
  showPromptCenter,
  generationStatus,
  isSelected = false,
  onStartDrag,
  onStartResize,
  onDelete,
  onToggleSelection,
  camera
}) => {
  const [showControls, setShowControls] = useState(false);
  const [width, setWidth] = useState(() => node.width || NODE_SIZE.width * 1.2);
  const [height, setHeight] = useState(() => node.height || NODE_SIZE.height * 1.5);

  // Update dimensions when node dimensions change
  useMemo(() => {
    if (node?.width !== null && node?.width !== undefined) {
      setWidth(node.width);
    }
    if (node?.height !== null && node?.height !== undefined) {
      setHeight(node.height);
    } else {
      setHeight(NODE_SIZE.height * 1.5);
    }
  }, [node?.width, node?.height]);

  const isClickable = useMemo(() =>
    !generationStatus.isGenerating || node.id <= (generationStatus.currentNodeId || -1),
    [generationStatus.isGenerating, node.id, generationStatus.currentNodeId]
  );

  const getNodeStyles = useMemo(() => {
    if (showPromptCenter) return { opacity: 0, pointerEvents: 'none' };

    const isCurrentScalar = isCurrent ? 1.0 : 0.9;
    const opacity = isCurrentScalar;

    let baseStyles = {
      transform: `scale(${isCurrentScalar})`,
      opacity: opacity,
      transition: 'all 0.3s ease-out',
      zIndex: isCurrent ? 10 : (isSelected ? 8 : 5),
      pointerEvents: 'auto',
      padding: '20px',
      borderRadius: '16px',
      borderWidth: isSelected ? '3px' : '1px',
      fontSize: '14px',
      fontWeight: '400',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backdropFilter: 'blur(8px)',
      width: `${width}px`,
      // Positioning is handled by parent container
    };

    // Selection enlarges the node; its colors come from the scheme below.
    if (isSelected) {
      baseStyles.transform = `scale(${isCurrent ? 1.05 : 1.0})`;
    }

    // The root always glows faintly in its own color, and the current node,
    // root or not, gets a ring and a stronger halo. These used to append a hex
    // alpha to an rgb() color, which is invalid CSS, so neither ever rendered.
    const { glow } = colorScheme;
    const ringAndHalo = (color) =>
      `0 0 0 3px ${withAlpha(color, glow.ring)}, 0 6px 30px ${withAlpha(color, glow.halo)}`;

    // Root node styling
    if (node.type === 'root') {
      baseStyles = {
        ...baseStyles,
        backgroundColor: isSelected
          ? colorScheme.selectedRootBg
          : colorScheme.rootBg,
        borderColor: isSelected ? colorScheme.selectedBorder : colorScheme.rootBorder,
        color: colorScheme.rootText,
        boxShadow: isSelected
          ? colorScheme.selectedShadow
          : (isCurrent
            ? `${colorScheme.lift}, ${ringAndHalo(colorScheme.rootBorder)}`
            : `${colorScheme.shadow}, 0 0 22px ${withAlpha(colorScheme.rootBorder, glow.rest)}`),
      };
    } else {
      baseStyles = {
        ...baseStyles,
        backgroundColor: isSelected
          ? colorScheme.selectedBg
          : (isCurrent ? colorScheme.surface : colorScheme.surfaceMuted),
        borderColor: isSelected ? colorScheme.selectedBorder : (isCurrent ? colorScheme.primary : colorScheme.border),
        color: colorScheme.text,
        boxShadow: isSelected
          ? colorScheme.selectedShadow
          : (isCurrent
            ? `${colorScheme.lift}, ${ringAndHalo(colorScheme.primary)}`
            : colorScheme.shadow),
      };
    }

    return baseStyles;
  }, [showPromptCenter, isCurrent, node.type, colorScheme, isSelected, width]);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();

    // Let the hover controls and the resize grip handle their own presses.
    // Focusing the node re-centres the camera, which slides the node out from
    // under the pointer, so mouseup lands elsewhere and the button never sees
    // a click at all.
    if (e.target.closest('.node-controls') || e.target.closest('.resize-handle')) {
      return;
    }

    // Ctrl/Cmd+click toggles selection
    if (e.ctrlKey || e.metaKey) {
      onToggleSelection?.(node.id);
      return;
    }

    // Check for drag modifier keys or drag handle
    if (e.shiftKey || e.target.closest('.drag-handle')) {
      onStartDrag?.(node.id, e.clientX, e.clientY, camera);
      return;
    }

    // Regular click - focus the node
    if (isClickable) {
      onClick(node, e);
    }
  }, [onToggleSelection, onStartDrag, camera, isClickable, onClick, node]);

  const handleResizeMouseDown = useCallback((e) => {
    e.stopPropagation();
    console.log('Resize handle clicked for node:', node.id);
    onStartResize?.(node.id, e.clientX, e.clientY);
  }, [onStartResize, node.id]);

  const nodeStyles = getNodeStyles;

  return (
    <div
      id={`node-${node.id}`}
      className={`node-component font-inter ${isClickable ? 'cursor-pointer' : 'cursor-wait'}`}
      style={nodeStyles}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Streaming indicator */}
      {isStreaming && (
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-3 -right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
          <div className="w-3 h-3 bg-white rounded-full"></div>
        </div>
      )}


      {/* Header */}
      <div className="flex items-center space-x-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold mb-1 leading-tight" style={{ color: nodeStyles.color }}>
            {node.label || `Node ${node.id}`}
          </h3>
          {isStreaming && (
            <div className="flex items-center gap-1">
              <Circle className="animate-pulse text-indigo-500" size={8} />
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Generating...</span>
            </div>
          )}
        </div>
      </div>

      {/* Description with text wrapping */}
      <div
        className="text-xs mb-4 leading-relaxed overflow-y-auto break-words"
        style={{
          color: nodeStyles.color,
          opacity: 0.8,
          // wordWrap: 'break-word',
          // overflowWrap: 'break-word',
          // hyphens: 'auto',
          maxHeight: `${height - 120}px` // Leave space for header and controls
        }}
      >
        {node.description}
      </div>

      {/* Control buttons */}
      {(showControls || isSelected) && (
        <div className="node-controls absolute top-2 right-2 flex gap-1 bg-white/95 dark:bg-neutral-900/95 rounded-lg p-1 shadow-lg border border-slate-200 dark:border-neutral-800">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFeedback?.(node.id, true);
            }}
            className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 rounded text-emerald-600 dark:text-emerald-400 transition-colors"
            title="This was helpful"
          >
            <ThumbsUp size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFeedback?.(node.id, false);
            }}
            className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-500/15 rounded text-amber-600 dark:text-amber-400 transition-colors"
            title="This needs improvement"
          >
            <ThumbsDown size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(node.id);
            }}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-500/15 rounded text-red-600 dark:text-red-400 transition-colors"
            title="Delete node"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Resize handle */}
      {(showControls || isSelected) && (
        <div
          className="resize-handle absolute bottom-1 right-1 w-5 h-5 cursor-se-resize bg-slate-300/80 dark:bg-neutral-600/80 rounded-tl-lg hover:bg-slate-400/80 dark:hover:bg-neutral-500/80 transition-colors border border-slate-400/50 dark:border-neutral-600/50 flex items-center justify-center"
          onMouseDown={handleResizeMouseDown}
          title="Resize node"
        >
          <div className="w-2 h-2 border-r-2 border-b-2 border-slate-600 dark:border-neutral-300 opacity-60"></div>
        </div>
      )}

      {/* Current node indicator */}
      {isCurrent && !isSelected && (
        <div
          className="absolute top-2 right-8 w-2 h-2 rounded-full opacity-60"
          style={{ backgroundColor: colorScheme.primary }}
        ></div>
      )}

      {/* Drag instruction hint */}
      {showControls && (
        <div className="absolute -bottom-6 left-0 text-xs text-slate-500 dark:text-neutral-400 bg-white/90 dark:bg-neutral-900/90 px-2 py-1 rounded shadow-sm whitespace-nowrap">
          Shift + click to drag
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo - only re-render if essential props change
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.label === nextProps.node.label &&
    prevProps.node.description === nextProps.node.description &&
    prevProps.node.content === nextProps.node.content &&
    prevProps.node.width === nextProps.node.width &&
    prevProps.node.height === nextProps.node.height &&
    prevProps.isCurrent === nextProps.isCurrent &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showPromptCenter === nextProps.showPromptCenter &&
    // The light and dark palettes are separate objects, so this is what
    // repaints the nodes when the theme changes.
    prevProps.colorScheme === nextProps.colorScheme
  );
});

NodeComponent.displayName = 'NodeComponent';

export default NodeComponent;