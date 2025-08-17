// Individual graph node display with adaptive UI

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
  camera,
  showPromptCenter,
  generationStatus,
  uiPersonality
}) => {
  const screenPos = worldToScreen(node.worldX, node.worldY);
  const isClickable = !generationStatus.isGenerating || node.id <= (generationStatus.currentNodeId || -1);

  const getNodeStyles = () => {
    if (showPromptCenter) return { opacity: 0, pointerEvents: 'none' };

    const isCurrentScalar = isCurrent ? 1.0 : 0.8;
    const opacity = isCurrentScalar;

    // Base styles from uiPersonality
    const baseStyles = {
      transform: `scale(${isCurrentScalar})`,
      opacity: opacity,
      transition: uiPersonality.animations?.transition || 'all 0.3s ease-out',
      zIndex: isCurrent ? 1 : 2,
      pointerEvents: 'auto',
      padding: uiPersonality.layout?.padding || '16px',
      borderRadius: uiPersonality.layout?.borderRadius || '12px',
      borderWidth: uiPersonality.layout?.borderWidth || '2px',
      boxShadow: uiPersonality.effects?.shadow || '0 4px 6px rgba(0, 0, 0, 0.3)',
      fontSize: uiPersonality.typography?.fontSize || '14px',
      fontWeight: uiPersonality.typography?.fontWeight || 'normal',
      fontFamily: uiPersonality.typography?.fontFamily || 'system'
    };
    // TODO: remove hardcoded themes.
    // Apply theme-specific overrides
    if (uiPersonality.theme === 'goth') {
      baseStyles.backgroundColor = node.type === 'root' ? '#2a1a1a' : '#1a1a1a';
      baseStyles.color = '#e0e0e0';
      baseStyles.borderColor = '#666';
      baseStyles.boxShadow = isCurrent
        ? '0 0 30px rgba(255, 0, 0, 0.5)'
        : '0 0 20px rgba(255, 0, 0, 0.3)';
    } else if (uiPersonality.theme === 'cyber') {
      baseStyles.backgroundColor = node.type === 'root' ? '#001122' : '#000011';
      baseStyles.color = '#00ffff';
      baseStyles.borderColor = '#00ff00';
      baseStyles.boxShadow = isCurrent
        ? '0 0 30px rgba(0, 255, 255, 0.8)'
        : '0 0 15px rgba(0, 255, 255, 0.4)';
      baseStyles.textShadow = '0 0 5px rgba(0, 255, 255, 0.5)';
    } else if (uiPersonality.theme === 'elegant') {
      baseStyles.backgroundColor = node.type === 'root' ? '#f8f9fa' : '#ffffff';
      baseStyles.color = '#2c3e50';
      baseStyles.borderColor = '#bdc3c7';
      baseStyles.boxShadow = isCurrent
        ? '0 8px 32px rgba(0, 0, 0, 0.1)'
        : '0 4px 16px rgba(0, 0, 0, 0.05)';
    } else {
      let nodeStyle = uiPersonality.colors?.default;
      if (node.type === 'root') {
        nodeStyle = {...nodeStyle, ...uiPersonality.colors?.root};
      }
      // Default 'tech' theme or fallback to uiPersonality colors
      baseStyles.backgroundColor = nodeStyle?.backgroundColor ||
        (node.type === 'root' ? '#FCD34D' : (isCurrent ? colorScheme.accent : colorScheme.primary));
      baseStyles.color = uiPersonality.colors?.textColor ||
        (node.type === 'root' ? '#1F2937' : 'white');
      baseStyles.borderColor = uiPersonality.colors?.borderColor ||
        (node.type === 'root' ? '#F59E0B' : (isCurrent ? '#FBBF24' : colorScheme.secondary));

      if (isCurrent) {
        baseStyles.boxShadow = uiPersonality.effects?.shadow || '0 0 20px rgba(59, 130, 246, 0.5)';
      }
    }

    // Apply custom CSS if provided
    if (uiPersonality.customCSS) {
      // Custom CSS would be applied globally, so we don't override here
    }

    return baseStyles;
  };

  // SIMPLIFIED: Get button styles consistently
  const getButtonStyles = () => {
    const positiveColor = uiPersonality.colors?.positiveColor || '#10B981';
    const negativeColor = uiPersonality.colors?.negativeColor || '#EF4444';

    return {
      positive: {
        backgroundColor: positiveColor,
        padding: '4px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      },
      negative: {
        backgroundColor: negativeColor,
        padding: '4px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }
    };
  };

  const nodeStyles = getNodeStyles();
  const buttonStyles = getButtonStyles();
  const dimensions = { width: NODE_SIZE.width, height: NODE_SIZE.height };

  return (
    <div
      className={`absolute shadow-lg border-2 node-component ${isClickable ? 'cursor-pointer' : 'cursor-wait'}`}
      style={{
        left: screenPos.x + dimensions.width / 4,
        top: screenPos.y - dimensions.height / 2,
        maxWidth: NODE_SIZE.width,
        minHeight: NODE_SIZE.height,
        ...nodeStyles
      }}
      onClick={() => isClickable && onClick(node)}
    >
      {/* Streaming indicator */}
      {isStreaming && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full animate-ping" />
      )}

      {/* Header */}
      <div className="flex items-center space-x-2 mb-2">
        <Brain size={16} style={{ color: nodeStyles.color }} />
        <h3 className="text-sm font-bold" style={{ color: nodeStyles.color }}>
          {node.label || `Node ${node.id}`}
        </h3>
        {isStreaming && (
          <Circle className="animate-pulse text-yellow-400" size={10} />
        )}
      </div>

      {/* Description */}
      <p
        className="text-xs mb-3"
        style={{
          color: nodeStyles.color,
          opacity: 0.8,
          fontFamily: nodeStyles.fontFamily
        }}
      >
        {node.description}
      </p>

      {/* Action buttons */}
      <div className="flex justify-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFeedback(node.id, true);
          }}
          style={buttonStyles.positive}
          title="Positive feedback"
          onMouseEnter={(e) => {
            e.target.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.target.style.opacity = '1';
          }}
        >
          <ThumbsUp size={12} className="text-white" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFeedback(node.id, false);
          }}
          style={buttonStyles.negative}
          title="Negative feedback"
          onMouseEnter={(e) => {
            e.target.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.target.style.opacity = '1';
          }}
        >
          <ThumbsDown size={12} className="text-white" />
        </button>
      </div>

      {/* Theme-specific decorative elements */}
      {uiPersonality.theme === 'cyber' && (
        <div className="absolute inset-0 rounded-xl pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>
        </div>
      )}

      {uiPersonality.theme === 'playful' && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full opacity-70 animate-pulse"></div>
      )}
    </div>
  );
};

export default NodeComponent;