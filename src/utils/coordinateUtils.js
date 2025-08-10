// utils/coordinateUtils.js - Coordinate system utilities

import { WORLD_CENTER, NODE_SIZE, NODE_SPACING, VIEWPORT_CENTER } from '../constants/graphConstants';

export const worldToScreen = (worldX, worldY) => ({
  x: worldX + VIEWPORT_CENTER.x,
  y: worldY + VIEWPORT_CENTER.y
});

export const calculateNodePosition = (nodeIndex, parentNodeId, depth) => {
  const parentWorldX = WORLD_CENTER.x + depth * NODE_SPACING.x;
  const parentWorldY = WORLD_CENTER.y + depth * NODE_SPACING.y;
  const yOffset = -NODE_SPACING.y * nodeIndex;
  const xOffset = nodeIndex > parentNodeId + 1 ? NODE_SPACING.x * (2 * (nodeIndex % 2) - 1) : 0;
  
  return { 
    worldX: parentWorldX + xOffset, 
    worldY: parentWorldY + yOffset 
  };
};

export const calculateNodeDimensions = (content, type) => {
  const baseWidth = 180;
  const baseHeight = 100;
  const charPerLine = 25;
  const lineHeight = 20;

  if (!content) return { width: baseWidth, height: baseHeight };

  const lines = content.split('\n');
  const maxLineLength = Math.max(...lines.map(line => line.length));
  const numLines = lines.length;

  const requiredWidth = Math.max(baseWidth, Math.min(maxLineLength * 8, 400));
  const requiredHeight = Math.max(baseHeight, numLines * lineHeight + 80);

  return { width: requiredWidth, height: requiredHeight };
};

export const calculateDistance = (point1, point2) => {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const getMinimapBounds = (nodes) => {
  if (nodes.length === 0) return { minX: -400, maxX: 400, minY: -300, maxY: 300 };

  const padding = NODE_SIZE.width;
  const minX = Math.min(...nodes.map(n => n.worldX)) - padding;
  const maxX = Math.max(...nodes.map(n => n.worldX)) + padding;
  const minY = Math.min(...nodes.map(n => n.worldY)) - padding;
  const maxY = Math.max(...nodes.map(n => n.worldY)) + padding;

  return { minX, maxX, minY, maxY };
};