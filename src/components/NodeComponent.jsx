// Node component

import { useState, memo, useMemo, useEffect } from 'react';
import { Circle, Move, X } from 'lucide-react';
import { worldToScreen } from '../utils/coordinateUtils';
import { NODE_SIZE } from '../constants/graphConstants';

const NodeComponent = memo(({
  node,
  isCurrent,
  isStreaming,
  onClick,
  onFeedback,
  colorScheme,
  showPromptCenter,
  generationStatus,
  uiPersonality,
  isSelected = false,
  selectionMode = false,
  onStartDrag,
  onStartResize,
  onDelete,
  onToggleSelection,
  camera
}) => {
  const [showControls, setShowControls] = useState(false);
  const [width, setWidth] = useState(NODE_SIZE.width * 1.2);
  const [height, setHeight] = useState(NODE_SIZE.height * 1.5);
  const [screenPosX, setScreenPosX] = useState(0.0);
  const [screenPosY, setScreenPosY] = useState(0.0);

  useEffect(() => {
    const pos = worldToScreen(node.worldX, node.worldY);
    if (pos.x !== null && pos.y !== null) {
      setScreenPosX(pos.x);
      setScreenPosY(pos.y);
    }
  }, [node.worldX, node.worldY]);


  const isClickable = useMemo(() =>
    !generationStatus.isGenerating || node.id <= (generationStatus.currentNodeId || -1),
    [generationStatus.isGenerating, node.id, generationStatus.currentNodeId]
  );

  // Calculate dynamic dimensions
  useEffect(() => {
    if (node?.width !== null) {
      setWidth(node.width);
    }
    if (node?.height && node?.height !== null) {
      setHeight(node.height);
    } else {
      setHeight(NODE_SIZE.height * 1.5);
    }
  }, [node?.width, node?.height]);


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
    };

    // Selection styling with glow effect
    if (isSelected) {
      baseStyles.borderColor = '#3B82F6';
      baseStyles.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      baseStyles.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.4), 0 8px 32px rgba(59, 130, 246, 0.2)';
      baseStyles.transform = `scale(${isCurrent ? 1.05 : 1.0})`;
    }

    // Root node styling
    if (node.type === 'root') {
      baseStyles = {
        ...baseStyles,
        backgroundColor: isSelected
          ? 'rgba(59, 130, 246, 0.15)'
          : colorScheme.rootBg,
        borderColor: isSelected ? '#3B82F6' : colorScheme.rootBorder,
        color: colorScheme.rootText,
        boxShadow: isSelected
          ? '0 0 0 3px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.4), 0 8px 32px rgba(59, 130, 246, 0.2)'
          : (isCurrent
            ? `0 8px 32px ${colorScheme.rootBorder}40, 0 0 0 2px ${colorScheme.rootBorder}50`
            : `0 4px 16px ${colorScheme.rootBorder}25`),
      };
    } else {
      baseStyles = {
        ...baseStyles,
        backgroundColor: isSelected
          ? 'rgba(59, 130, 246, 0.08)'
          : (isCurrent ? colorScheme.surface : 'rgba(255, 255, 255, 0.85)'),
        borderColor: isSelected ? '#3B82F6' : (isCurrent ? colorScheme.primary : colorScheme.border),
        color: colorScheme.text,
        boxShadow: isSelected
          ? '0 0 0 3px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.4), 0 8px 32px rgba(59, 130, 246, 0.2)'
          : (isCurrent
            ? `0 12px 24px rgba(0, 0, 0, 0.08), 0 0 0 2px ${colorScheme.primary}33`
            : '0 4px 12px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.06)'),
      };
    }

    return baseStyles;
  }, [showPromptCenter, isCurrent, node.type, colorScheme, isSelected, width]);

  const handleMouseDown = (e) => {
    e.stopPropagation();

    if (selectionMode) {
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
      onClick(node);
    }
  };

  const handleDragHandleMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Drag handle clicked for node:', node.id);
    onStartDrag?.(node.id, e.clientX, e.clientY, camera);
  };

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    console.log('Resize handle clicked for node:', node.id);
    onStartResize?.(node.id, e.clientX, e.clientY);
  };

  const nodeStyles = getNodeStyles;

  return (
    <div
      id={`node-${node.id}`}
      className={` absolute node-component font-inter ${selectionMode ? 'cursor-pointer' :
        (isClickable ? 'cursor-pointer' : 'cursor-wait')
        }`}
      style={{
        // ...nodeStyles,
        left: screenPosX - width / 2,
        top: screenPosY - height / 2
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div
        style={{
          ...nodeStyles,
          flexDirection: 'row',
        }}
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

        {/* Selection mode overlay */}
        {selectionMode && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-2xl border-2 border-dashed border-blue-400 opacity-70 pointer-events-none" />
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
                <span className="text-xs text-indigo-600 font-medium">Generating...</span>
              </div>
            )}
          </div>
        </div>

        {/* Description with text wrapping */}
        <div
          className="flex text-xs mb-4 leading-relaxed overflow-y-auto break-words"
          style={{
            color: nodeStyles.color,
            opacity: 0.8,
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            hyphens: 'auto',
          }}
        >
          {node.description}
        </div>

        {/* Control buttons */}
        {(showControls || isSelected) && !selectionMode && (
          <div className="absolute top-2 right-2 flex gap-1 bg-white/95 rounded-lg p-1 shadow-lg border border-slate-200">
            <button
              className="drag-handle p-1.5 hover:bg-blue-100 rounded text-blue-600 cursor-grab active:cursor-grabbing transition-colors"
              onMouseDown={handleDragHandleMouseDown}
              title="Drag node"
            >
              <Move size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(node.id);
              }}
              className="p-1.5 hover:bg-red-100 rounded text-red-600 transition-colors"
              title="Delete node"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Resize handle */}
        {!selectionMode && (showControls || isSelected) && (
          <div
            className="absolute bottom-1 right-1 w-5 h-5 cursor-se-resize bg-slate-300/80 rounded-tl-lg hover:bg-slate-400/80 transition-colors border border-slate-400/50 flex items-center justify-center"
            onMouseDown={handleResizeMouseDown}
            title="Resize node"
          >
            <div className="w-2 h-2 border-r-2 border-b-2 border-slate-600 opacity-60"></div>
          </div>
        )}

        {/* Current node indicator */}
        {isCurrent && !isSelected && (
          <div
            className="absolute top-2 right-8 w-2 h-2 rounded-full opacity-60"
            style={{ backgroundColor: colorScheme.primary }}
          ></div>
        )}

        {/* Drag instruction hint for non-selection mode */}
        {!selectionMode && showControls && (
          <div className="absolute -bottom-6 left-0 text-xs text-slate-500 bg-white/90 px-2 py-1 rounded shadow-sm whitespace-nowrap">
            Shift + click to drag
          </div>
        )}
      </div>
    </div>
  );
});

NodeComponent.displayName = 'NodeComponent';

export default NodeComponent;