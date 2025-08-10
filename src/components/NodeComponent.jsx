// components/NodeComponent.jsx - Individual graph node display

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
  generationStatus
}) => {
  const screenPos = worldToScreen(node.worldX, node.worldY);
  const isClickable = !generationStatus.isGenerating || node.id <= (generationStatus.currentNodeId || -1);

  const getNodeStyle = (node, isCurrent) => {
    if (showPromptCenter) return { opacity: 0, pointerEvents: 'none' };

    const isCurrentScalar = isCurrent ? 1.3 : 1.0;
    const distanceScalar = Math.sqrt(Math.pow(camera.x - node.worldX, 2) + Math.pow((camera.y - node.worldY), 2));
    const opacity = Math.max(Math.min(distanceScalar * isCurrentScalar, 1.0), 0.0);

    return {
      transform: `scale(${isCurrentScalar})`,
      opacity: { opacity },
      transition: 'all 0.3s ease-out',
      zIndex: isCurrent ? 1 : 2,
      pointerEvents: 'auto'
    };
  };

  return (
    <div
      className={`absolute min-w-[160px] rounded-xl shadow-lg border-2 p-4 ${isClickable ? 'cursor-pointer' : 'cursor-wait'
        } node-component transition-all duration-300`}
      style={{
        left: screenPos.x - NODE_SIZE.width / 2,
        top: screenPos.y - NODE_SIZE.height / 2,
        ...getNodeStyle(node, isCurrent),
        backgroundColor: node.type === 'root' ? '#FCD34D' : (isCurrent ? colorScheme.accent : colorScheme.primary),
        borderColor: node.type === 'root' ? '#F59E0B' : (isCurrent ? '#FBBF24' : colorScheme.secondary),
        color: node.type === 'root' ? '#1F2937' : 'white',
        boxShadow: isCurrent ? '0 0 20px rgba(59, 130, 246, 0.5)' : '0 4px 6px rgba(0, 0, 0, 0.3)'
      }}
      onClick={() => isClickable && onClick(node)}
    >
      {isStreaming && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full animate-ping" />
      )}

      <div className="flex items-center space-x-2 mb-2">
        <Brain size={16} className={node.type === 'root' ? 'text-gray-800' : 'text-white'} />
        <h3 className={`text-sm font-bold ${node.type === 'root' ? 'text-gray-800' : 'text-white'}`}>
          {node.label || `Node ${node.id}`}
        </h3>
        {isStreaming && (
          <Circle className="animate-pulse text-yellow-400" size={10} />
        )}
      </div>

      <p className={`text-xs mb-3 ${node.type === 'root' ? 'text-gray-700' : 'text-white/80'}`}>
        {node.description}
      </p>

      <div className="flex justify-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFeedback(node.id, true);
          }}
          className="p-1 bg-green-500 rounded hover:bg-green-600 transition-colors"
          title="Positive feedback"
        >
          <ThumbsUp size={12} className="text-white" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFeedback(node.id, false);
          }}
          className="p-1 bg-red-500 rounded hover:bg-red-600 transition-colors"
          title="Negative feedback"
        >
          <ThumbsDown size={12} className="text-white" />
        </button>
      </div>
    </div>
  );
};

export default NodeComponent;