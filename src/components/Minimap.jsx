// Graph overview and navigation

import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { getMinimapBounds } from '../utils/coordinateUtils';

const Minimap = ({ 
  nodes, 
  connections, 
  currentNodeId, 
  camera, 
  colorScheme,
  onNavigateToNode,
  onCameraMove 
}) => {
  const [minimapExpanded, setMinimapExpanded] = useState(false);
  const [minimapZoom, setMinimapZoom] = useState(1.0);

  if (nodes.length === 0) return null;

  const bounds = getMinimapBounds(nodes);

const handleMinimapClick = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  const worldX = bounds.minX + (bounds.maxX - bounds.minX) * x;
  const worldY = bounds.minY + (bounds.maxY - bounds.minY) * y;
  
  onCameraMove(-worldX, -worldY)
};

  return (
    <div
      className="absolute bottom-4 right-4 bg-black/90 backdrop-blur rounded-lg border border-gray-600 transition-all duration-300 minimap-container"
      style={{
        width: minimapExpanded ? 600 : 200,
        height: minimapExpanded ? 600 : 180,
        zIndex: 100
      }}
    >
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 border-b border-gray-600"
        onClick={() => setMinimapExpanded(!minimapExpanded)}
      >
        <span className="text-white text-sm font-semibold">Graph Overview</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{nodes.length} nodes</span>
          {minimapExpanded ? 
            <Minimize2 size={14} className="text-white" /> : 
            <Maximize2 size={14} className="text-white" />
          }
        </div>
      </div>

      <div className="relative overflow-hidden" style={{ height: minimapExpanded ? 550 : 130 }}>
        <svg
          className="w-full h-full cursor-crosshair"
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`}
          onClick={handleMinimapClick}
          onWheel={(e) => {
            if (!minimapExpanded) return;
            e.preventDefault();
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            setMinimapZoom(prev => Math.max(0.5, Math.min(prev * zoomDelta, 2.0)));
          }}
        >
          {/* Minimap connections */}
          {connections.map((conn, index) => {
            if (conn.from >= nodes.length || conn.to >= nodes.length) return null;
            const fromNode = nodes.at(conn.from);
            const toNode = nodes.at(conn.to);
            if (!fromNode || !toNode) return null;

            return (
              <line
                key={index}
                x1={fromNode.worldX}
                y1={fromNode.worldY}
                x2={toNode.worldX}
                y2={toNode.worldY}
                stroke={colorScheme.accent}
                strokeWidth="2"
                opacity="0.6"
              />
            );
          })}

          {/* Minimap nodes */}
          {nodes.map(node => (
            <g key={node.id}>
              <circle
                cx={node.worldX}
                cy={node.worldY}
                r={node.id === currentNodeId ? "60" : "36"}
                fill={node.type === 'root' ? '#FCD34D' : 
                      (node.id === currentNodeId ? colorScheme.accent : colorScheme.primary)}
                stroke={node.type === 'root' ? '#F59E0B' : colorScheme.secondary}
                strokeWidth="2"
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToNode(node.id);
                }}
              />
              {minimapExpanded && (
                <text
                  x={node.worldX}
                  y={node.worldY + 4}
                  fontSize="10"
                  fill="white"
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {node.label.slice(0, 6)}
                </text>
              )}
            </g>
          ))}

          {/* Viewport indicator */}
          <rect
            x={-camera.x - (window.innerWidth / 2) / camera.zoom}
            y={-camera.y - (window.innerHeight / 2) / camera.zoom}
            width={window.innerWidth / camera.zoom}
            height={window.innerHeight / camera.zoom}
            fill="none"
            stroke="yellow"
            strokeWidth="3"
            opacity="0.8"
            rx="5"
          />
        </svg>
      </div>
    </div>
  );
};

export default Minimap;