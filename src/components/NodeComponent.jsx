// Individual graph node display

import { ThumbsUp, ThumbsDown, Brain, Circle } from 'lucide-react';
import { worldToScreen } from '../utils/coordinateUtils';
import { NODE_SIZE } from '../constants/graphConstants';

const NodeComponent = ({
  node,
  isCurrent,
  isStreaming,
  onClick,
  onFeedback,
  colorScheme,
  showPromptCenter,
  generationStatus,
  uiPersonality
}) => {
  const screenPos = worldToScreen(node.worldX, node.worldY);
  const isClickable = !generationStatus.isGenerating || node.id <= (generationStatus.currentNodeId || -1);

  const getNodeStyles = () => {
    if (showPromptCenter) return { opacity: 0, pointerEvents: 'none' };

    const isCurrentScalar = isCurrent ? 1.0 : 0.9;
    const opacity = isCurrentScalar;

    let baseStyles = {
      transform: `scale(${isCurrentScalar})`,
      opacity: opacity,
      transition: 'all 0.3s ease-out',
      zIndex: isCurrent ? 10 : 5,
      pointerEvents: 'auto',
      padding: '20px',
      borderRadius: '16px',
      borderWidth: '1px',
      fontSize: '14px',
      fontWeight: '400',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backdropFilter: 'blur(8px)',
    };

    // Root node styling - using colorScheme root colors
    if (node.type === 'root') {
      baseStyles = {
        ...baseStyles,
        backgroundColor: colorScheme.rootBg,
        borderColor: colorScheme.rootBorder,
        color: colorScheme.rootText,
        boxShadow: isCurrent
          ? `0 8px 32px ${colorScheme.rootBorder}40, 0 0 0 2px ${colorScheme.rootBorder}50`
          : `0 4px 16px ${colorScheme.rootBorder}25`,
      };
    } else {

      baseStyles = {
        ...baseStyles,
        backgroundColor: isCurrent ? colorScheme.surface : 'rgba(255, 255, 255, 0.85)',
        borderColor: isCurrent ? colorScheme.primary : colorScheme.border,
        color: colorScheme.text,
        boxShadow: isCurrent
          ? `0 12px 24px rgba(0, 0, 0, 0.08), 0 0 0 2px ${colorScheme.primary}33`
          : '0 4px 12px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.06)',
      };
    }

    return baseStyles;
  };

      const getButtonStyles = () => {
    return {
      positive: {
        backgroundColor: colorScheme.success,
        padding: '6px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: `0 2px 4px ${colorScheme.success}33`,
      },
      negative: {
        backgroundColor: colorScheme.error,
        padding: '6px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: `0 2px 4px ${colorScheme.error}33`,
      }
    };
  };

  const nodeStyles = getNodeStyles();
  const buttonStyles = getButtonStyles();
  const dimensions = {
    width: NODE_SIZE.width * 1.2,
    height: NODE_SIZE.height * 1.5
  };

  return (
    <div
      id={`node-${node.id}`}
      className={`absolute node-component ${isClickable ? 'cursor-pointer' : 'cursor-wait'} font-inter`}
      style={{
        left: screenPos.x + dimensions.width / 4,
        top: screenPos.y - dimensions.height / 2,
        width: dimensions.width,
        minHeight: dimensions.height,
        ...nodeStyles
      }}
      onClick={() => isClickable && onClick(node)}
    >
      {/* Streaming indicator */}
      {isStreaming && (
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
      )}

      {/* Header */}
      <div className="flex items-center space-x-3 mb-3">
        <div
          className="p-2 rounded-lg"
          style={{
            backgroundColor: node.type === 'root' ?
              `${colorScheme.rootBorder}1A` : // 10% opacity
              `${colorScheme.accent}1A` // 10% opacity
          }}
        >
          <Brain size={16} style={{ color: nodeStyles.color }} />
        </div>
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

      {/* Description */}
      <p
        className="text-xs mb-4 leading-relaxed line-clamp-3"
        style={{
          color: nodeStyles.color,
          opacity: 0.8,
        }}
      >
        {node.description}
      </p>

      {/* Action buttons - Removed until functionality is fixed */}
      {/* <div className="flex justify-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFeedback(node.id, true);
          }}
          style={buttonStyles.positive}
          title="Positive feedback"
          className="hover:scale-105 active:scale-95 transition-transform duration-150"
        >
          <ThumbsUp size={14} className="text-white" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFeedback(node.id, false);
          }}
          style={buttonStyles.negative}
          title="Negative feedback"
          className="hover:scale-105 active:scale-95 transition-transform duration-150"
        >
          <ThumbsDown size={14} className="text-white" />
        </button>
      </div> */}

      {/* Subtle corner accent for current node */}
      {isCurrent && (
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full opacity-60"
          style={{ backgroundColor: colorScheme.primary }}
        ></div>
      )}
    </div>
  );
};

export default NodeComponent;