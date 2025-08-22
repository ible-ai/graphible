// Coordinate system utilities

import * as d3 from 'd3';
import { WORLD_CENTER, NODE_SIZE, NODE_SPACING, VIEWPORT_CENTER, RAD_PER_DEPTH } from '../constants/graphConstants';

export const worldToScreen = (worldX, worldY) => ({
  x: worldX + VIEWPORT_CENTER.x,
  y: worldY + VIEWPORT_CENTER.y
});

export const depthToScalar = (depth) => {

  const rads = depth * RAD_PER_DEPTH + Math.PI;
  return { y: Math.cos(rads), x: Math.sin(rads) };
};

export const calculateNodePosition = (newNodeContent, newNodeDescription, preceedingSiblingNodes, depth) => {

  const estimatedNewDimensions = estimateNewNodeDimensions(newNodeContent, newNodeDescription);
  let horizontalSpacing = NODE_SPACING.x;
  let verticalSpacing = NODE_SPACING.x;
  let worldX = WORLD_CENTER.x;
  let worldY = WORLD_CENTER.y;
  let siblingIndex = preceedingSiblingNodes.length;

  if (siblingIndex === 0) {
    // If new local root node, add space between previous local graph and this new node set.
    if (depth > 0) {
      siblingIndex = siblingIndex + 1;
    }
    // return calculateFirstNodePosition(depth);
    horizontalSpacing += estimatedNewDimensions.width / 2;
    verticalSpacing += estimatedNewDimensions.height / 2;
  } else {
    const closestSibling = preceedingSiblingNodes[preceedingSiblingNodes.length - 1];
    const closestSiblingDimensions = getCurrentElementDimensions(closestSibling.id);
    horizontalSpacing += (closestSiblingDimensions.width + estimatedNewDimensions.width) / 4;
    verticalSpacing += (closestSiblingDimensions.height + estimatedNewDimensions.height) / 4;
    const parentNode = preceedingSiblingNodes[0];
    worldX = parentNode.worldX;
    worldY = parentNode.worldY;
  }
  const rotScalars = depthToScalar(depth);

  // Calculate actual dimensions for the parent.
  return {
    worldX: worldX + siblingIndex * horizontalSpacing * rotScalars.x,
    worldY: worldY + siblingIndex * verticalSpacing * rotScalars.y,
  };
};

export const getCurrentElementDimensions = (id, prefix) => {
  const elementId = `${prefix}${id}`;
  const element = document.getElementById(elementId);
  if (element == null) {
    return { width: NODE_SIZE.width, height: NODE_SIZE.height };
  }
  const to_return = { width: element.clientWidth, height: element.clientHeight };
  console.log(to_return);
  return to_return;
}

// TODO cache the node size at rendering time and tie it to the node object.
export const getCurrentNodeDimensions = (node) => {
  if (node === null) {
    return { width: NODE_SIZE.width, height: NODE_SIZE.height };
  }
  const elementId = `node-${node.id}`;
  const element = document.getElementById(elementId);
  if (element === null) {
    return estimateNewNodeDimensions(node.content, node.description);
  }
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
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
  console.log("estimateNewNodeDimensions", estimatedContentHeight, estimatedDescriptionHeight, estimatedHeight);

  return { width: NODE_SIZE.width, height: estimatedHeight };
};

export const calculateDistance = (point1, point2) => {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// TODO: tie these to constants.
export const getMinimapBounds = (nodes) => {
  if (nodes.length === 0) return { minX: -400, maxX: 400, minY: -300, maxY: 300 };

  const padding = NODE_SIZE.width;
  const minX = Math.min(...nodes.map(n => n.worldX)) - padding;
  const maxX = Math.max(...nodes.map(n => n.worldX)) + padding;
  const minY = Math.min(...nodes.map(n => n.worldY)) - padding;
  const maxY = Math.max(...nodes.map(n => n.worldY)) + padding;

  return { minX, maxX, minY, maxY };
};

// Add this new function to your existing coordinateUtils.js
export const applyForceDirectedLayout = (nodes, connections, options = {}) => {
  if (nodes.length === 0) return nodes;

  const {
    // width = 2000,
    // height = 1500,
    iterations = 300,
    linkDistance = 200,
    nodeStrength = -400,
    centerStrength = 0.1
  } = options;

  // Convert your nodes to d3 format
  const d3Nodes = nodes.map(node => ({
    id: node.id,
    x: node.worldX || 0,
    y: node.worldY || 0,
    // Add node dimensions for collision detection
    radius: Math.max(node.dimensions?.width || NODE_SIZE.width, node.dimensions?.height || NODE_SIZE.height) / 4,
    originalNode: node
  }));

  // Convert connections to d3 links
  const d3Links = connections.map(conn => ({
    source: conn.from,
    target: conn.to
  }));

  // Create the force simulation
  const simulation = d3.forceSimulation(d3Nodes)
    .force('link', d3.forceLink(d3Links)
      .id(d => d.id)
      .distance(linkDistance)
      .strength(0.1)
    )
    .force('charge', d3.forceManyBody()
      .strength(nodeStrength)
    )
    .force('center', d3.forceCenter(0, 0)
      .strength(centerStrength)
    )
    .force('collision', d3.forceCollide()
      .radius(d => d.radius + 20) // Add padding
      .strength(0.7)
    )
    .stop();

  // Run the simulation synchronously
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  // Apply the results back to your nodes
  return nodes.map(node => {
    const d3Node = d3Nodes.find(d => d.id === node.id);
    return {
      ...node,
      worldX: d3Node.x,
      worldY: d3Node.y
    };
  });
};