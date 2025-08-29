// Hook for handling node selection for context inclusion with drag selection
import { useState, useCallback } from 'react';
import { worldToScreen } from '../utils/coordinateUtils';

export const useNodeSelection = () => {
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });

  // Toggle selection mode on/off
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      const newMode = !prev;
      if (!newMode) {
        // Clear selections when exiting selection mode
        setSelectedNodes(new Set());
        setIsDragSelecting(false);
      }
      return newMode;
    });
  }, []);

  // Auto-select nodes from the most recent generation batch
  const autoSelectRecentBatch = useCallback((nodes, currentBatchId) => {
    if (!Array.isArray(nodes)) return;

    // Find the most recent batch ID
    const maxBatchId = Math.max(...nodes.map(n => n.batchId || 0));
    const recentBatchId = currentBatchId !== undefined ? currentBatchId : maxBatchId;

    // Select all nodes from the most recent batch
    const recentNodeIds = nodes
      .filter(node => (node.batchId || 0) === recentBatchId)
      .map(node => node.id);

    setSelectedNodes(new Set(recentNodeIds));
  }, []);

  // FIXME
  const clientToWorldCoords = (clientX, clientY, camera) => {
    console.log(clientX, clientY);
    const worldX = (clientX - window.innerWidth / 2) / camera.zoom - 2 * camera.x;
    const worldY = (clientY - window.innerHeight / 2) / camera.zoom - (1 - 1/camera.zoom) * camera.y / 2;
    const pos = worldToScreen(worldX, worldY);
    // const x = (clientX - (window.innerWidth / 2 + camera.x) * (1 - camera.zoom)) / camera.zoom;
    // const y = (clientY - (window.innerHeight / 2 + camera.y) * (1 - camera.zoom)) / camera.zoom;// + (camera.zoom - 4 ) *  camera.y;
    // const worldX = (clientX - (window.innerWidth / 2) * (1 - camera.zoom) + camera.x) / camera.zoom;
    // const worldX = (clientX - window.innerWidth / 2) * (1 - camera.zoom) / camera.zoom;
    // const worldY = (clientY - (window.innerHeight / 2) * (1 - camera.zoom) + camera.y) / camera.zoom;// + (camera.zoom - 4 ) *  camera.y;
    // return { x: x, y: y };
    return pos;
  };

  // Start drag selection
  const startDragSelection = useCallback((clientX, clientY, camera) => {
    if (!selectionMode) return;
    setIsDragSelecting(true);
    const coords = clientToWorldCoords(clientX, clientY, camera);
    setDragStart(coords);
    setDragEnd(coords);
  }, [selectionMode]);

  // Update drag selection
  const updateDragSelection = useCallback((clientX, clientY, camera) => {
    if (!isDragSelecting) return;

    // Convert screen coordinates to world coordinates
    const coords = clientToWorldCoords(clientX, clientY, camera);

    setDragEnd(coords);
  }, [isDragSelecting]);

  // End drag selection and select nodes in area
  const endDragSelection = useCallback((nodes) => {
    if (!isDragSelecting) return;

    setIsDragSelecting(false);

    if (!Array.isArray(nodes)) {
      console.warn('endDragSelection: nodes is not an array:', nodes);
      return;
    }

    const minX = Math.min(dragStart.x, dragEnd.x);
    const maxX = Math.max(dragStart.x, dragEnd.x);
    const minY = Math.min(dragStart.y, dragEnd.y);
    const maxY = Math.max(dragStart.y, dragEnd.y);

    // Only select if there's a meaningful drag area
    const dragArea = Math.abs(maxX - minX) * Math.abs(maxY - minY);
    if (dragArea < 100) return; // Minimum drag area threshold

    const nodesInArea = nodes.filter(node =>
      node.worldX >= minX && node.worldX <= maxX &&
      node.worldY >= minY && node.worldY <= maxY
    );

    const nodeIds = nodesInArea.map(node => node.id);
    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      nodeIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, [isDragSelecting, dragStart, dragEnd]);

  // Toggle selection of a specific node
  const toggleNodeSelection = useCallback((nodeId) => {
    if (!selectionMode) return;

    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, [selectionMode]);

  // Check if a node is selected
  const isNodeSelected = useCallback((nodeId) => {
    return selectedNodes.has(nodeId);
  }, [selectedNodes]);

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedNodes(new Set());
  }, []);

  // Get selection box coordinates for rendering
  const getSelectionBox = useCallback(() => {
    if (!isDragSelecting) return null;

    return {
      x: Math.min(dragStart.x, dragEnd.x),
      y: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y)
    };
  }, [isDragSelecting, dragStart, dragEnd]);

  return {
    selectedNodes,
    selectionMode,
    isDragSelecting,
    toggleSelectionMode,
    toggleNodeSelection,
    isNodeSelected,
    clearSelections,
    autoSelectRecentBatch,
    startDragSelection,
    updateDragSelection,
    endDragSelection,
    getSelectionBox,
    selectedCount: selectedNodes.size
  };
};