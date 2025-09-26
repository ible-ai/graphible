import { useState, useCallback, useRef, useEffect } from 'react';
import { screenToWorld } from '../utils/coordinateUtils';

export const useNodeSelection = () => {
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [contextMode, setContextMode] = useState('auto'); // 'auto', 'manual', 'branch', 'batch'

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
    const modes = ['auto', 'manual', 'branch', 'batch'];
    setContextMode(prev => {
      const currentIndex = modes.indexOf(prev);
      const nextIndex = (currentIndex + 1) % modes.length;
      return modes[nextIndex];
    });
  }, []);

  // Auto context selection - automatically selects relevant nodes
  const updateAutoContext = useCallback((nodes, currentNodeId, connections) => {
    if (contextMode !== 'auto' || !currentNodeId) return;

    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (!currentNode) return;

    // Algorithm for intelligent selection:
    // 1. Always include the current node
    // 2. Include recent nodes from same generation/batch
    // 3. Include directly connected nodes (parents/children)
    // 4. Include nodes with similar keywords in label/description
    // 5. Limit total selection to avoid context overload

    const selectedIds = new Set([currentNodeId]);

    // 1. Include nodes from the same batch (recent context)
    const currentBatch = currentNode.batchId || 0;
    const recentNodes = nodes
      .filter(n => (n.batchId || 0) === currentBatch && n.id !== currentNodeId)
      .slice(-3); // Limit to 3 most recent from same batch
    recentNodes.forEach(node => selectedIds.add(node.id));

    // 2. Include directly connected nodes
    const directConnections = connections.filter(c =>
      c.from === currentNodeId || c.to === currentNodeId
    );
    directConnections.forEach(conn => {
      const relatedId = conn.from === currentNodeId ? conn.to : conn.from;
      selectedIds.add(relatedId);
    });

    // 3. Include parent path to root (for context continuity)
    let parentNode = currentNode;
    let pathLength = 0;
    while (parentNode && pathLength < 3) { // Limit path depth to avoid too much context
      const parentConnection = connections.find(c => c.to === parentNode.id);
      if (parentConnection) {
        parentNode = nodes.find(n => n.id === parentConnection.from);
        if (parentNode) {
          selectedIds.add(parentNode.id);
          pathLength++;
        }
      } else {
        break;
      }
    }

    // 4. Semantic similarity - find nodes with similar keywords
    if (currentNode.label || currentNode.description) {
      const currentText = `${currentNode.label || ''} ${currentNode.description || ''}`.toLowerCase();
      const keywords = currentText.split(/\s+/)
        .filter(word => word.length > 3 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'her', 'now', 'oil', 'sit', 'set'].includes(word))
        .slice(0, 5); // Top 5 keywords

      if (keywords.length > 0) {
        const similarNodes = nodes
          .filter(n => n.id !== currentNodeId && !selectedIds.has(n.id))
          .map(node => {
            const nodeText = `${node.label || ''} ${node.description || ''}`.toLowerCase();
            const matchCount = keywords.filter(keyword => nodeText.includes(keyword)).length;
            return { node, similarity: matchCount / keywords.length };
          })
          .filter(item => item.similarity > 0.3) // At least 30% keyword match
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 2); // Top 2 most similar

        similarNodes.forEach(item => selectedIds.add(item.node.id));
      }
    }

    // Limit total selection to prevent overwhelming context
    const finalSelection = Array.from(selectedIds).slice(0, 8);
    setSelectedNodeIds(new Set(finalSelection));
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

  // Direct node selection toggle for smart interaction
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

  // Node selection based on context mode and modifier keys
  const handleNodeSelection = useCallback((nodeId, nodes, connections, modifierKey = false) => {
    if (contextMode === 'auto') {
      // In auto mode, allow both regular clicks and Ctrl/Cmd+click for individual node toggling
      toggleNodeSelection(nodeId);
      return;
    }

    if (contextMode === 'manual') {
      // In manual mode, all clicks toggle individual nodes
      toggleNodeSelection(nodeId);
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
  }, [contextMode, selectBranch, selectBatch, toggleNodeSelection]);


  // Check if a node is selected
  const isNodeSelected = useCallback((nodeId) => {
    return selectedNodeIds.has(nodeId);
  }, [selectedNodeIds]);

  // Clear all selections
  const clearSelections = useCallback(() => {
    selectedNodeIdsRef.current = new Set();
    setSelectedNodeIds(selectedNodeIdsRef.current);
  }, []);


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
    selectedCount: selectedNodeIds.size,

    // Mode management
    toggleContextMode,

    // Auto selection methods
    handleNodeSelection,
    updateAutoContext,
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

    // Memory management
    cleanupInvalidSelections,
    scheduleCleanup
  };
};