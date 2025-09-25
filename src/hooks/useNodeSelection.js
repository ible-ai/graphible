import { useState, useCallback, useRef, useEffect } from 'react';
import { screenToWorld } from '../utils/coordinateUtils';

export const useNodeSelection = () => {
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [contextMode, setContextMode] = useState('smart'); // 'smart', 'manual', 'branch', 'batch'
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

  // Toggle between context modes
  const toggleContextMode = useCallback(() => {
    const modes = ['smart', 'manual', 'branch', 'batch'];
    setContextMode(prev => {
      const currentIndex = modes.indexOf(prev);
      const nextIndex = (currentIndex + 1) % modes.length;
      const newMode = modes[nextIndex];

      // Clear manual selections when switching away from manual mode
      if (prev === 'manual' && newMode !== 'manual') {
        setSelectedNodeIds(new Set());
      }

      return newMode;
    });
  }, []);

  // Smart context selection - automatically includes relevant context
  const updateSmartContext = useCallback((nodes, currentNodeId, connections) => {
    if (contextMode !== 'smart' || !currentNodeId) return;

    // Build path from root to current node
    const buildPathToNode = (nodeId) => {
      const path = [];
      let current = nodes.find(n => n.id === nodeId);

      while (current) {
        path.unshift(current.id);
        const parentConnection = connections.find(c => c.to === current.id);
        current = parentConnection ? nodes.find(n => n.id === parentConnection.from) : null;
      }

      return path;
    };

    const contextPath = buildPathToNode(currentNodeId);
    setSelectedNodeIds(new Set(contextPath));
  }, [contextMode]);

  // Select entire branch/subtree from a node
  const selectBranch = useCallback((rootNodeId, nodes, connections) => {
    const findChildrenRecursive = (nodeId) => {
      const children = connections
        .filter(c => c.from === nodeId)
        .map(c => c.to);

      const allDescendants = [nodeId];
      children.forEach(childId => {
        allDescendants.push(...findChildrenRecursive(childId));
      });

      return allDescendants;
    };

    const branchNodeIds = findChildrenRecursive(rootNodeId);
    setSelectedNodeIds(new Set(branchNodeIds));
  }, []);

  // Select all nodes from a specific batch
  const selectBatch = useCallback((batchId, nodes) => {
    const batchNodeIds = nodes
      .filter(node => (node.batchId || 0) === batchId)
      .map(node => node.id);

    setSelectedNodeIds(new Set(batchNodeIds));
  }, []);

  // Fixed coordinate conversion using the new coordinate system
  const clientToWorldCoords = useCallback((clientX, clientY, camera) => {
    return screenToWorld(clientX, clientY, camera);
  }, []);

  // Start drag selection (only in manual mode)
  const startDragSelection = useCallback((clientX, clientY, camera) => {
    if (contextMode !== 'manual') return;
    setIsDragSelecting(true);
    const coords = clientToWorldCoords(clientX, clientY, camera);
    setDragStart(coords);
    setDragEnd(coords);
  }, [contextMode, clientToWorldCoords]);

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

  // Smart node selection based on context mode and modifier keys
  const handleNodeSelection = useCallback((nodeId, nodes, connections, modifierKey = false) => {
    if (contextMode === 'smart') {
      // In smart mode, just update the smart context
      return;
    }

    if (contextMode === 'manual') {
      if (modifierKey) {
        // Ctrl/Cmd+click: toggle individual node
        setSelectedNodeIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(nodeId)) {
            newSet.delete(nodeId);
          } else {
            newSet.add(nodeId);
          }
          return newSet;
        });
      }
      return;
    }

    if (contextMode === 'branch') {
      selectBranch(nodeId, nodes, connections);
      return;
    }

    if (contextMode === 'batch') {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        selectBatch(node.batchId || 0, nodes);
      }
      return;
    }
  }, [contextMode, selectBranch, selectBatch]);

  // Legacy method for backwards compatibility
  const toggleNodeSelection = useCallback((nodeId) => {
    setSelectedNodeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

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
    contextMode,
    isDragSelecting,
    selectedCount: selectedNodeIds.size,

    // Mode management
    toggleContextMode,

    // Smart selection methods
    handleNodeSelection,
    updateSmartContext,
    selectBranch,
    selectBatch,

    // Legacy selection management
    toggleNodeSelection,
    isNodeSelected,
    clearSelections,
    selectNodes,
    deselectNodes,
    selectAllNodes,

    // Batch operations
    getSelectedNodeObjects,

    // Drag selection (manual mode only)
    startDragSelection,
    updateDragSelection,
    endDragSelection,
    getSelectionBox,

    // Memory management
    cleanupInvalidSelections,
    scheduleCleanup
  };
};