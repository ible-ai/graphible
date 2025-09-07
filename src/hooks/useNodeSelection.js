// Hook for handling node selection for context inclusion with drag selection

import { useState, useCallback, useRef, useEffect } from 'react';
import { screenToWorld } from '../utils/coordinateUtils';

export const useNodeSelection = () => {
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });

  // Memory management: Track refs to avoid stale closures
  const selectedNodeIdsRef = useRef(new Set());
  const currentNodesRef = useRef(new Set());
  const cleanupTimeoutRef = useRef(null);
  const lastCleanupRef = useRef(0);

  // Cleanup function to remove invalid selections
  const cleanupInvalidSelections = useCallback((validNodeIds) => {
    const validIds = new Set(validNodeIds);
    currentNodesRef.current = validIds;

    setSelectedNodeIds(prev => {
      const cleaned = new Set();
      for (const nodeId of prev) {
        if (validIds.has(nodeId)) {
          cleaned.add(nodeId);
        }
      }
      selectedNodeIdsRef.current = cleaned.size !== prev.size ? cleaned : prev;
      return selectedNodeIdsRef.current;
    });
  }, []);

  // Debounced cleanup to avoid excessive calls
  const scheduleCleanup = useCallback((validNodeIds) => {
    const now = Date.now();
    // Throttle cleanup calls to max once per 200ms
    if (now - lastCleanupRef.current < 200) {
      return;
    }
    lastCleanupRef.current = now;

    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
    }

    cleanupTimeoutRef.current = setTimeout(() => {
      cleanupInvalidSelections(validNodeIds);
      cleanupTimeoutRef.current = null;
    }, 100);
  }, [cleanupInvalidSelections]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, []);

  // Toggle selection mode on/off
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      const newMode = !prev;
      if (!newMode) {
        // Clear selections when exiting selection mode
        setSelectedNodeIds(new Set());
        setIsDragSelecting(false);
      }
      return newMode;
    });
  }, []);

  // Auto-select nodes from the most recent generation batch
  const autoSelectRecentBatch = useCallback((nodes, currentNodeId) => {
    const curNode = nodes.find(n => n && n.id === currentNodeId);

    if (!Array.isArray(nodes) || nodes.length === 0 || curNode === null) return;

    const validNodeIds = nodes.map(n => n.id);
    scheduleCleanup(validNodeIds);

    // Find the most recent batch ID
    const maxBatchId = Math.max(...nodes.map(n => n.batchId || 0));
    const recentBatchId = curNode?.batchId ? curNode.batchId : maxBatchId;

    // Select all nodes from the most recent batch or from the existing set of nodes.
    const newlySelectedNodeIds = nodes
      .filter(
        node => node && node.id &&
          (
            (selectedNodeIdsRef.current.has(node.id)) ||
            (node.batchId || 0) === recentBatchId
          )
          && (node?.id <= currentNodeId)
      ).map(node => node.id);
    setSelectedNodeIds(new Set([...newlySelectedNodeIds]));
  }, [scheduleCleanup]);

  // Fixed coordinate conversion using the new coordinate system
  const clientToWorldCoords = useCallback((clientX, clientY, camera) => {
    return screenToWorld(clientX, clientY, camera);
  }, []);

  // Start drag selection
  const startDragSelection = useCallback((clientX, clientY, camera) => {
    if (!selectionMode) return;
    setIsDragSelecting(true);
    const coords = clientToWorldCoords(clientX, clientY, camera);
    setDragStart(coords);
    setDragEnd(coords);
  }, [selectionMode, clientToWorldCoords]);

  // Update drag selection
  const updateDragSelection = useCallback((clientX, clientY, camera) => {
    if (!isDragSelecting) return;

    // Convert screen coordinates to world coordinates
    const coords = clientToWorldCoords(clientX, clientY, camera);
    setDragEnd(coords);
  }, [isDragSelecting, clientToWorldCoords]);

  // End drag selection and select nodes in area
  const endDragSelection = useCallback((nodes) => {
    if (!isDragSelecting) return;

    setIsDragSelecting(false);

    if (!Array.isArray(nodes)) {
      console.warn('endDragSelection: nodes is not an array:', nodes);
      return;
    }

    // Clean up selections before adding new ones
    const validNodeIds = nodes.map(n => n.id);
    scheduleCleanup(validNodeIds);

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
    setSelectedNodeIds(prev => {
      const newSet = new Set(prev);
      nodeIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, [isDragSelecting, dragStart, dragEnd, scheduleCleanup]);

  // Toggle selection of a specific node
  const toggleNodeSelection = useCallback((nodeId) => {
    if (!selectionMode) return;

    setSelectedNodeIds(prev => {
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
    return selectedNodeIds.has(nodeId);
  }, [selectedNodeIds]);

  // Clear all selections
  const clearSelections = useCallback(() => {
    selectedNodeIdsRef.current = new Set();
    setSelectedNodeIds(selectedNodeIdsRef.current);
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

  // Enhanced selector that returns actual node objects, not just IDs
  const getSelectedNodeObjects = useCallback((allNodes) => {
    if (!Array.isArray(allNodes)) return [];

    return allNodes.filter(node => selectedNodeIds.has(node.id));
  }, [selectedNodeIds]);

  // Batch select nodes by IDs
  const selectNodes = useCallback((nodeIds) => {
    if (!Array.isArray(nodeIds)) return;

    setSelectedNodeIds(prev => {
      const newSet = new Set(prev);
      nodeIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, []);

  // Batch deselect nodes by IDs
  const deselectNodes = useCallback((nodeIds) => {
    if (!Array.isArray(nodeIds)) return;

    setSelectedNodeIds(prev => {
      const newSet = new Set(prev);
      nodeIds.forEach(id => newSet.delete(id));
      return newSet;
    });
  }, []);

  // Select all visible nodes
  const selectAllNodes = useCallback((allNodes) => {
    if (!Array.isArray(allNodes)) return;

    const allNodeIds = allNodes.map(node => node.id);
    setSelectedNodeIds(new Set(allNodeIds));
  }, []);

  return {
    // State
    selectedNodeIds,
    selectionMode,
    isDragSelecting,
    selectedCount: selectedNodeIds.size,

    // Mode management
    toggleSelectionMode,

    // Selection management
    toggleNodeSelection,
    isNodeSelected,
    clearSelections,
    selectNodes,
    deselectNodes,
    selectAllNodes,

    // Batch operations
    autoSelectRecentBatch,
    getSelectedNodeObjects,

    // Drag selection
    startDragSelection,
    updateDragSelection,
    endDragSelection,
    getSelectionBox,

    // Memory management
    cleanupInvalidSelections,
    scheduleCleanup
  };
};