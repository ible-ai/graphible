// Coordinate system utilities

import { WORLD_CENTER, NODE_SIZE, NODE_SPACING, VIEWPORT_CENTER, RAD_PER_DEPTH } from '../constants/graphConstants';

export const worldToScreen = (worldX, worldY) => ({
  x: worldX + VIEWPORT_CENTER.x,
  y: worldY + VIEWPORT_CENTER.y
});

export const depthToScalar = (depth) => {

  const rads = depth * RAD_PER_DEPTH;
  return { y: Math.cos(rads), x: Math.sin(rads) };
};

export const calculateFirstNodePosition = (depth) => {
  if (depth > 0) {
    const rotScalar = depthToScalar(depth);
    return {
      worldX: NODE_SIZE.width * rotScalar.x * depth,
      worldY: NODE_SIZE.height * rotScalar.y * depth
    };
  }
  return { worldX: WORLD_CENTER.x, worldY: WORLD_CENTER.y };
};

export const calculateNodePosition = (newNodeContent, newNodeDescription, preceedingSiblingNodes, depth) => {

  if (preceedingSiblingNodes.length === 0) {
    return calculateFirstNodePosition(depth);
  }
  const rotScalars = depthToScalar(depth);

  // Calculate actual dimensions for the parent.
  const parentNode = preceedingSiblingNodes[0];
  const parentDimensions = getCurrentElementDimensions(parentNode.id);
  const estimatedNewDimensions = estimateNewNodeDimensions(newNodeContent);

  const horizontalSpacing = (parentDimensions.width + estimatedNewDimensions.width) / 2 + NODE_SPACING.x;
  const verticalSpacing = (parentDimensions.height + estimatedNewDimensions.height) / 2 + NODE_SPACING.y;
  const siblingIndex = preceedingSiblingNodes.length;
  return {
    worldX: parentNode.worldX + siblingIndex * horizontalSpacing * rotScalars.x,
    worldY: parentNode.worldY + siblingIndex * verticalSpacing * rotScalars.y,
  };
};

export const getCurrentElementDimensions = (id, prefix = 'node-') => {
  const elementId = `${prefix}${id}`;
  const element = document.getElementById(elementId);
  const rect = element.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  return { width: width, height: height };
}

const estimatedRenderedLineLength = (text, fontSizePx, allocatedWidth) => {
  const estimatedCharDim = fontSizePx * 0.4; // https://stackoverflow.com/a/11480924/30188977
  const estimatedUnrolledLength = text.length * estimatedCharDim;

  const estimatedLines = Math.ceil(estimatedUnrolledLength / allocatedWidth);
  const lineHeightPx = fontSizePx * 2; // Single-spacing.
  return estimatedLines * lineHeightPx;
};

const estimatedTextHeight = (text, fontSizePx = 15, boxWidthPx = NODE_SIZE.width) => {
  if (!text) return 0;

  const lines = text.split('\n');
  let estimatedHeight = 0;
  lines.map(curLine => estimatedHeight += estimatedRenderedLineLength(curLine, fontSizePx, boxWidthPx));

  return estimatedHeight;
}

export const estimateNewNodeDimensions = (content, description) => {
  const estimatedContentHeight = estimatedTextHeight(content);
  const estimatedDescriptionHeight = estimatedTextHeight(description, 30);
  const estimatedHeight = Math.max(NODE_SIZE.height, estimatedContentHeight + estimatedDescriptionHeight);

  return { width: NODE_SIZE.width, height: estimatedHeight };
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