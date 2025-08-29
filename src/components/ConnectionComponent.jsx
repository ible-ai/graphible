// Node connection visualization

import { NODE_SIZE } from '../constants/graphConstants';
import { worldToScreen } from '../utils/coordinateUtils';
import { useMemo, memo } from 'react';

const ConnectionComponent = memo(({ fromNode, toNode, colorScheme, camera }) => {
  const connectionData = useMemo(() => {
    if (!fromNode?.worldX || !toNode?.worldX || !fromNode?.worldY || !toNode?.worldY) return null;

    const fromScreen = worldToScreen(fromNode.worldX, fromNode.worldY);
    const toScreen = worldToScreen(toNode.worldX, toNode.worldY);

    // Calculate connection points on node edges
    const dx = toScreen.x - fromScreen.x;
    const dy = toScreen.y - fromScreen.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return null;

    const unitX = dx / distance;
    const unitY = dy / distance;

    // Adjust for larger node sizes
    const nodeWidth = NODE_SIZE.width * 1.2;
    const nodeHeight = NODE_SIZE.height * 1.5;

    const fromX = fromScreen.x + nodeWidth * 0.75;
    const fromY = fromScreen.y + nodeHeight * 0.75;
    const toX = toScreen.x + nodeWidth * 0.75;
    const toY = toScreen.y + nodeHeight * 0.75;

    // Create curved path for better visual appeal
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const controlOffset = Math.min(distance * 0.15, 60); // Limit curve amount
    const controlX = midX + (-unitY * controlOffset);
    const controlY = midY + (unitX * controlOffset);

    const path = `M${fromX},${fromY} Q${controlX},${controlY} ${toX},${toY}`;

    // Calculate opacity based on distance and zoom for performance
    return {
      path,
      fromX,
      fromY,
      toX,
      toY,
      midX,
      midY
    };
  }, [fromNode.worldX, fromNode.worldY, toNode.worldX, toNode.worldY]);

  const {
    path,
    fromX,
    fromY,
    toX,
    toY,
    midX,
    midY
  } = connectionData;

  const computeOpacity = useMemo(() => {
    const baseStrokeWidth = 2;
    // Just use zoom level for opacity, not camera position
    const distanceScalar = Math.sqrt(
      Math.pow(camera.x - midX, 2) + Math.pow(camera.y - midY, 2)
    );
    const opacity = Math.max(Math.min(distanceScalar * camera.zoom, 1.0), 0.0);
    const scaledOpacity = 0.6 * opacity;
    const strokeWidth = Math.max(opacity * baseStrokeWidth, 0.8);

    return {
      opacity, scaledOpacity, strokeWidth
    }

  }, [camera.x, camera.y, camera.zoom, midX, midY]);

  if (!connectionData) return null;

  const { opacity, scaledOpacity, strokeWidth } = computeOpacity;


  return (
    <g>
      {/* Connection line */}
      <path
        d={path}
        stroke={colorScheme.accent}
        strokeWidth={strokeWidth}
        fill="none"
        strokeOpacity={scaledOpacity}
        markerEnd="url(#arrowhead)"
        strokeLinecap="round"
        style={{
          overflow: 'visible',
          zIndex: 1,
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
        }}
      />

      {/* Connection points */}
      <circle
        cx={fromX}
        cy={fromY}
        r="4"
        fill={colorScheme.border}
        stroke="white"
        opacity={opacity}
        strokeWidth="2"
        style={{
          zIndex: 2,
          overflow: 'visible',
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
        }}
      />
      <circle
        cx={toX}
        cy={toY}
        r="4"
        fill={colorScheme.primary}
        opacity={opacity}
        stroke="white"
        strokeWidth="2"
        style={{
          zIndex: 2,
          overflow: 'visible',
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
        }}
      />
    </g>
  );
});

ConnectionComponent.displayName = 'ConnectionComponent';

export default ConnectionComponent;