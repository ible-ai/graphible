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

  // Calculate dynamic dimensions based on content
  const calculateNodeDimensions = (content, type) => {
    const baseWidth = NODE_SIZE.width;
    const baseHeight = NODE_SIZE.height;

    // Adjust size based on content length
    const contentLength = (content || '').length;
    const scaleFactor = Math.min(3.0, Math.max(0.8, contentLength / 200));

    return {
      width: baseWidth,
      height: Math.max(baseHeight, baseHeight * scaleFactor)
    };
  };

  const dimensions = calculateNodeDimensions(node.content, node.type);

  // Apply adaptive styling based on UI personality
  const getAdaptiveStyles = () => {
    let styles = {};

    // Font family adaptations
    if (uiPersonality?.fontFamily) {
      if (uiPersonality.fontFamily.includes('bubble')) {
        styles.fontFamily = '"Comic Sans MS", cursive, sans-serif';
        styles.fontWeight = 'bold';
      } else if (uiPersonality.fontFamily.includes('mono')) {
        styles.fontFamily = '"Courier New", monospace';
      } else if (uiPersonality.fontFamily.includes('serif')) {
        styles.fontFamily = 'Georgia, serif';
      }
    }

    // Theme adaptations
    if (uiPersonality?.theme) {
      if (uiPersonality.theme.includes('goth')) {
        styles.backgroundColor = node.type === 'root' ? '#2a1a1a' : '#1a1a1a';
        styles.color = '#e0e0e0';
        styles.borderColor = '#666';
        styles.boxShadow = isCurrent
          ? '0 0 30px rgba(255, 0, 0, 0.5)'
          : '0 0 20px rgba(255, 0, 0, 0.3)';
      } else if (uiPersonality.theme.includes('cyber') || uiPersonality.theme.includes('neon')) {
        styles.backgroundColor = node.type === 'root' ? '#001122' : '#000011';
        styles.color = '#00ffff';
        styles.borderColor = '#00ff00';
        styles.boxShadow = isCurrent
          ? '0 0 30px rgba(0, 255, 255, 0.8)'
          : '0 0 15px rgba(0, 255, 255, 0.4)';
        styles.textShadow = '0 0 5px rgba(0, 255, 255, 0.5)';
      } else if (uiPersonality.theme.includes('elegant') || uiPersonality.theme.includes('minimal')) {
        styles.backgroundColor = node.type === 'root' ? '#f8f9fa' : '#ffffff';
        styles.color = '#2c3e50';
        styles.borderColor = '#bdc3c7';
        styles.boxShadow = isCurrent
          ? '0 8px 32px rgba(0, 0, 0, 0.1)'
          : '0 4px 16px rgba(0, 0, 0, 0.05)';
        styles.borderRadius = '8px';
      } else if (uiPersonality.theme.includes('playful') || uiPersonality.theme.includes('creative')) {
        styles.backgroundColor = node.type === 'root' ? '#ff6b6b' : '#4ecdc4';
        styles.color = '#ffffff';
        styles.borderColor = '#45b7b8';
        styles.borderRadius = '20px';
        styles.transform = isCurrent ? 'scale(1.3) rotate(1deg)' : 'rotate(0.5deg)';
      } else {
        // TODO: make adaptive to node type.
        styles.backgroundColor = `${uiPersonality.colors?.backgroundColor}`;
        styles.color = `${uiPersonality.colors?.color}`;
        styles.borderColor = `${uiPersonality.colors?.borderColor}`;
        styles.borderRadius = `${uiPersonality.colors?.borderRadius}`;
      }
    } else {
      // TODO: make adaptive to node type.
      styles.backgroundColor = `${uiPersonality.colors?.backgroundColor}`;
      styles.color = `${uiPersonality.colors?.color}`;
      styles.borderColor = `${uiPersonality.colors?.borderColor}`;
      styles.borderRadius = `${uiPersonality.colors?.borderRadius}`;
    }

    // Animation style adaptations
    if (uiPersonality?.animationStyle) {
      if (uiPersonality.animationStyle.includes('bouncy')) {
        styles.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      } else if (uiPersonality.animationStyle.includes('fast')) {
        styles.transition = 'all 0.1s ease-out';
      } else if (uiPersonality.animationStyle.includes('slow')) {
        styles.transition = 'all 0.8s ease-out';
      } else if (uiPersonality.animationStyle.includes('static')) {
        styles.transition = 'none';
      }
    }

    return styles;
  };

  const getNodeStyle = (node, isCurrent) => {
    if (showPromptCenter) return { opacity: 0, pointerEvents: 'none' };

    const isCurrentScalar = isCurrent ? 1.3 : 1.0;
    const distanceScalar = Math.sqrt(Math.pow(camera.x - node.worldX, 2) + Math.pow((camera.y - node.worldY), 2));
    const opacity = Math.max(Math.min(distanceScalar * isCurrentScalar, 1.0), 0.0);

    const baseStyle = {
      transform: `scale(${isCurrentScalar})`,
      opacity: { opacity },
      transition: 'all 0.3s ease-out',
      zIndex: isCurrent ? 1 : 2,
      pointerEvents: 'auto'
    };

    // Default styling if no UI personality adaptations
    if (!uiPersonality?.theme || uiPersonality.theme === 'tech') {
      baseStyle.backgroundColor = node.type === 'root' ? '#FCD34D' : (isCurrent ? colorScheme.accent : colorScheme.primary);
      baseStyle.borderColor = node.type === 'root' ? '#F59E0B' : (isCurrent ? '#FBBF24' : colorScheme.secondary);
      baseStyle.color = node.type === 'root' ? '#1F2937' : 'white';
      baseStyle.boxShadow = isCurrent ? '0 0 20px rgba(59, 130, 246, 0.5)' : '0 4px 6px rgba(0, 0, 0, 0.3)';
    }

    return baseStyle;
  };

  // Get adaptive button styling
  const getAdaptiveButtonStyles = () => {
    if (uiPersonality?.theme?.backgroundColor) {
      return {
        positive: 'p-1 bg-red-700 rounded hover:bg-red-600 transition-colors',
        negative: 'p-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors'
      };
    };

    if (uiPersonality?.theme?.includes('goth')) {
      return {
        positive: 'p-1 bg-red-700 rounded hover:bg-red-600 transition-colors',
        negative: 'p-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors'
      };
    } else if (uiPersonality?.theme?.includes('cyber')) {
      return {
        positive: 'p-1 bg-green-400 rounded hover:bg-green-300 transition-colors',
        negative: 'p-1 bg-red-400 rounded hover:bg-red-300 transition-colors'
      };
    } else if (uiPersonality?.theme?.includes('elegant')) {
      return {
        positive: 'p-1 bg-blue-500 rounded hover:bg-blue-600 transition-colors',
        negative: 'p-1 bg-gray-500 rounded hover:bg-gray-600 transition-colors'
      };
    }

    // Default styling
    return {
      positive: 'p-1 bg-green-500 rounded hover:bg-green-600 transition-colors',
      negative: 'p-1 bg-red-500 rounded hover:bg-red-600 transition-colors'
    };
  };

  const buttonStyles = getAdaptiveButtonStyles();
  const adaptiveStyles = getAdaptiveStyles();
  const nodeStyles = getNodeStyle(node, isCurrent);

  // Get text color for content based on theme
  const getContentTextColor = () => {
    if (uiPersonality?.theme?.includes('elegant')) {
      return node.type === 'root' ? 'text-gray-600' : 'text-gray-700';
    } else if (adaptiveStyles.color) {
      return ''; // Use the adaptive color
    }
    return node.type === 'root' ? 'text-gray-700' : 'text-white/80';
  };

  const getHeadingTextColor = () => {
    if (uiPersonality?.theme?.includes('elegant')) {
      return node.type === 'root' ? 'text-gray-800' : 'text-gray-900';
    } else if (adaptiveStyles.color) {
      return ''; // Use the adaptive color
    }
    return node.type === 'root' ? 'text-gray-800' : 'text-white';
  };


  return (
    <div
      className={`absolute rounded-xl shadow-lg border-2 p-4 ${isClickable ? 'cursor-pointer' : 'cursor-wait'} node-component transition-all duration-300`}
      style={{
        left: screenPos.x + dimensions.width / 4,
        top: screenPos.y - dimensions.height / 2,
        maxWidth: NODE_SIZE.width,
        minHeight: NODE_SIZE.height,
        backgroundColor: adaptiveStyles.backgroundColor
      }}
      onClick={() => isClickable && onClick(node)}
    >
      {/* Inject custom CSS if needed */}
      {uiPersonality?.customCSS && (
        <style jsx>{uiPersonality.customCSS}</style>
      )}

      {isStreaming && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full animate-ping" />
      )}

      <div className="flex items-center space-x-2 mb-2">
        <Brain
          size={16}
          className={getHeadingTextColor()}
          style={adaptiveStyles.color ? { color: adaptiveStyles.color } : {}}
        />
        <h3
          className={`text-sm font-bold ${getHeadingTextColor()}`}
          style={adaptiveStyles.color ? { color: adaptiveStyles.color } : {}}
        >
          {node.label || `Node ${node.id}`}
        </h3>
        {isStreaming && (
          <Circle className="animate-pulse text-yellow-400" size={10} />
        )}
      </div>

      <p
        className={`text-xs mb-3 ${getContentTextColor()}`}
        style={adaptiveStyles.color ? { color: `${adaptiveStyles.color}CC` } : {}}
      >
        {node.description}
      </p>

      <div className="flex justify-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFeedback(node.id, true);
          }}
          className={buttonStyles.positive}
          title="Positive feedback"
        >
          <ThumbsUp size={12} className="text-white" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFeedback(node.id, false);
          }}
          className={buttonStyles.negative}
          title="Negative feedback"
        >
          <ThumbsDown size={12} className="text-white" />
        </button>
      </div>

      {/* Special effects for certain themes */}
      {uiPersonality?.theme?.includes('cyber') && (
        <div className="absolute inset-0 rounded-xl pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>
        </div>
      )}

      {uiPersonality?.theme?.includes('playful') && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full opacity-70 animate-pulse"></div>
      )}
    </div>
  );
};

export default NodeComponent;