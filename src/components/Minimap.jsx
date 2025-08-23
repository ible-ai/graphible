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

    onCameraMove(-worldX, -worldY);
  };

  return (
    <div
      className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/50 transition-all duration-300 minimap-container shadow-lg font-inter"
      style={{
        width: minimapExpanded ? 600 : 280,
        height: minimapExpanded ? 400 : 200,
        zIndex: 100
      }}
    >
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 border-b border-slate-200/50 rounded-t-2xl transition-colors duration-200"
        onClick={() => setMinimapExpanded(!minimapExpanded)}
      >
        <span className="text-slate-800 text-sm font-medium">Graph Overview</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
            {nodes.length} nodes
          </span>
          {minimapExpanded ?
            <Minimize2 size={16} className="text-slate-600" /> :
            <Maximize2 size={16} className="text-slate-600" />
          }
        </div>
      </div>

      <div className="relative overflow-hidden" style={{ height: minimapExpanded ? 340 : 140 }}>
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
                stroke="rgb(203, 213, 225)"
                strokeWidth="3"
                opacity="0.4"
                strokeLinecap="round"
              />
            );
          })}

          {/* Minimap nodes */}
          {nodes.map(node => {
            const isRoot = node.type === 'root';
            const isCurrent = node.id === currentNodeId;

            return (
              <g key={node.id}>
                <circle
                  cx={node.worldX}
                  cy={node.worldY}
                  r={isCurrent ? "80" : "50"}
                  fill={isRoot ? 'rgb(99, 102, 241)' : (isCurrent ? 'rgb(67, 56, 202)' : 'rgb(148, 163, 184)')} // indigo-500, indigo-700, slate-400
                  stroke={isRoot ? 'rgb(67, 56, 202)' : (isCurrent ? 'rgb(55, 48, 163)' : 'rgb(100, 116, 139)')} // indigo-700, indigo-800, slate-500
                  strokeWidth={isCurrent ? "6" : "3"}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToNode(node.id);
                  }}
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
                  }}
                />
                {minimapExpanded && (
                  <text
                    x={node.worldX}
                    y={node.worldY + 5}
                    fontSize="12"
                    fill="rgb(51, 65, 85)"
                    textAnchor="middle"
                    className="pointer-events-none select-none font-medium"
                  >
                    {node.label.slice(0, 8)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Viewport indicator */}
          <rect
            x={-camera.x - (window.innerWidth / 2) / camera.zoom}
            y={-camera.y - (window.innerHeight / 2) / camera.zoom}
            width={window.innerWidth / camera.zoom}
            height={window.innerHeight / camera.zoom}
            fill="none"
            stroke="rgb(99, 102, 241)"
            strokeWidth="4"
            opacity="0.6"
            rx="8"
            strokeDasharray="8,4"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(99, 102, 241, 0.2))'
            }}
          />
        </svg>
      </div>
    </div>
  );
};

export default Minimap;