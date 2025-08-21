// Node connection visualization

import { NODE_SIZE } from '../constants/graphConstants';
import { worldToScreen } from '../utils/coordinateUtils';

const ConnectionComponent = ({ fromNode, toNode, colorScheme, camera }) => {
  if (!fromNode || !toNode) return null;

  const fromScreen = worldToScreen(fromNode.worldX, fromNode.worldY);
  const toScreen = worldToScreen(toNode.worldX, toNode.worldY);

  // Calculate connection points on node edges
  const dx = toScreen.x - fromScreen.x;
  const dy = toScreen.y - fromScreen.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) return null;

  const unitX = dx / distance;
  const unitY = dy / distance;

  const fromX = fromScreen.x + NODE_SIZE.width * 3 / 4;
  const fromY = fromScreen.y + NODE_SIZE.height * 3 / 4;
  const toX = toScreen.x + NODE_SIZE.width * 3 / 4;
  const toY = toScreen.y + NODE_SIZE.height * 3 / 4;

  // Create curved path for better visual appeal
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const controlOffset = distance * 0.2;
  const controlX = midX + (-unitY * controlOffset);
  const controlY = midY + (unitX * controlOffset);

  const baseStrokeWidth = 2;
  const path = `M${fromX},${fromY} Q${controlX},${controlY} ${toX},${toY}`;
  const distanceScalar = Math.sqrt(
    Math.pow(camera.x - midX, 2) + Math.pow(camera.y - midY, 2)
  );
  const opacity = Math.max(Math.min(distanceScalar * camera.zoom, 1.0), 0.0);
  const strokeWidth = Math.max(opacity * baseStrokeWidth, 0.0);

  return (
    <g>
      {/* Connection line */}
      <path
        d={path}
        stroke={colorScheme.accent}
        strokeWidth={strokeWidth}
        fill="none"
        opacity={opacity}
        strokeOpacity={opacity}
        markerEnd="url(#arrowhead)"
        style={{
          overflow: 'visible',
          zIndex: 1,
        }}
      />

      {/* Connection points */}
      <circle
        cx={fromX}
        cy={fromY}
        r="3"
        fill={colorScheme.primary}
        stroke="white"
        opacity={opacity}
        strokeWidth="1"
        style={{
          zIndex: 1,
          overflow: 'visible',
        }}
      />
      <circle
        cx={toX}
        cy={toY}
        r="3"
        fill={colorScheme.secondary}
        opacity={opacity}
        stroke="white"
        strokeWidth="1"
        style={{
          zIndex: 1,
          overflow: 'visible',
        }}
      />
    </g>
  );
};

export default ConnectionComponent;