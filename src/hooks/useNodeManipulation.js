// Complete useNodeManipulation.js - Full Implementation with fixed coordinates
// This is a complete replacement for your existing useNodeManipulation.js

import { useState, useCallback, useRef } from 'react';

export const useNodeManipulation = (nodes, setNodes, connections, setConnections) => {
  const [deletedNodes, setDeletedNodes] = useState(new Map()); // Use Map for O(1) access
  const [isDraggingNode, setIsDraggingNode] = useState(null);
  const [isResizingNode, setIsResizingNode] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Convert client coordinates to world coordinates
  const clientToWorld = useCallback((clientX, clientY, camera) => {
    const worldX = (clientX - window.innerWidth / 2) / camera.zoom - camera.x;
    const worldY = (clientY - window.innerHeight / 2) / camera.zoom - camera.y;
    return { x: worldX, y: worldY };
  }, []);

  // Start dragging a node
  const startNodeDrag = useCallback((nodeId, clientX, clientY, camera) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Convert click position to world coordinates
    const worldClick = clientToWorld(clientX, clientY, camera);

    // Store the offset between click position and node center
    dragOffsetRef.current = {
      x: worldClick.x - node.worldX,
      y: worldClick.y - node.worldY
    };

    setIsDraggingNode(nodeId);
  }, [nodes, clientToWorld]);

  // Update node position during drag
  const updateNodeDrag = useCallback((clientX, clientY, camera) => {
    if (isDraggingNode === null) return;

    const worldMouse = clientToWorld(clientX, clientY, camera);

    // Apply the stored offset to get the correct node position
    const newWorldX = worldMouse.x - dragOffsetRef.current.x;
    const newWorldY = worldMouse.y - dragOffsetRef.current.y;

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === isDraggingNode
          ? { ...node, worldX: newWorldX, worldY: newWorldY }
          : node
      )
    );
  }, [isDraggingNode, setNodes, clientToWorld]);

  // End node drag
  const endNodeDrag = useCallback(() => {
    setIsDraggingNode(null);
    dragOffsetRef.current = { x: 0, y: 0 };
  }, []);

  // Start resizing a node
  const startNodeResize = useCallback((nodeId, clientX, clientY) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setIsResizingNode(nodeId);
    setResizeStart({
      x: clientX,
      y: clientY,
      width: node.width || 280,
      height: node.height || 200
    });

    console.log(`Starting resize for node ${nodeId}`);
  }, [nodes]);

  // Update node size during resize
  const updateNodeResize = useCallback((clientX, clientY) => {
    if (isResizingNode === null) return;

    const deltaX = clientX - resizeStart.x;
    const deltaY = clientY - resizeStart.y;

    // Set minimum dimensions
    const minWidth = 200;
    const minHeight = 100;
    const maxWidth = 800;
    const maxHeight = 600;

    const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.width + deltaX));
    const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStart.height + deltaY));

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === isResizingNode
          ? { ...node, width: newWidth, height: newHeight }
          : node
      )
    );
  }, [isResizingNode, resizeStart, setNodes]);

  // End node resize
  const endNodeResize = useCallback(() => {
    if (isResizingNode !== null) {
      console.log(`Ending resize for node ${isResizingNode}`);
      setIsResizingNode(null);
      setResizeStart({ x: 0, y: 0, width: 0, height: 0 });
    }
  }, [isResizingNode]);

  // Delete a node (move to deletion store)
  const deleteNode = useCallback((nodeId) => {
    const nodeToDelete = nodes.find(n => n.id === nodeId);
    if (!nodeToDelete) {
      console.warn(`Attempted to delete non-existent node: ${nodeId}`);
      return;
    }

    // Find all connections involving this node
    const relatedConnections = connections.filter(
      conn => conn.from === nodeId || conn.to === nodeId
    );

    // Store deleted node with its connections and timestamp
    const deletedItem = {
      node: { ...nodeToDelete }, // Clone to prevent reference issues
      connections: [...relatedConnections], // Clone connections array
      deletedAt: Date.now()
    };

    console.log(`Deleting node ${nodeId} with ${relatedConnections.length} connections`);

    setDeletedNodes(prev => new Map(prev.set(nodeId, deletedItem)));

    // Remove node and its connections from active graph
    setNodes(prevNodes => prevNodes.filter(n => n.id !== nodeId));
    setConnections(prevConnections =>
      prevConnections.filter(conn => conn.from !== nodeId && conn.to !== nodeId)
    );
  }, [nodes, connections, setNodes, setConnections]);

  // Restore a deleted node
  const restoreNode = useCallback((nodeId) => {
    const deletedItem = deletedNodes.get(nodeId);
    if (!deletedItem) {
      console.warn(`Attempted to restore non-existent deleted node: ${nodeId}`);
      return;
    }

    console.log(`Restoring node ${nodeId}`);

    // Check if any connected nodes still exist
    const currentNodeIds = new Set(nodes.map(n => n.id));
    const validConnections = deletedItem.connections.filter(conn => {
      const fromExists = currentNodeIds.has(conn.from) || conn.from === nodeId;
      const toExists = currentNodeIds.has(conn.to) || conn.to === nodeId;
      return fromExists && toExists;
    });

    console.log(`Restoring ${validConnections.length} of ${deletedItem.connections.length} connections`);

    // Restore node and valid connections
    setNodes(prevNodes => [...prevNodes, deletedItem.node]);
    setConnections(prevConnections => [...prevConnections, ...validConnections]);

    // Remove from deletion store
    setDeletedNodes(prev => {
      const newMap = new Map(prev);
      newMap.delete(nodeId);
      return newMap;
    });
  }, [deletedNodes, nodes, setNodes, setConnections]);

  // Permanently delete a node from the deletion store
  const permanentlyDeleteNode = useCallback((nodeId) => {
    console.log(`Permanently deleting node ${nodeId}`);
    setDeletedNodes(prev => {
      const newMap = new Map(prev);
      newMap.delete(nodeId);
      return newMap;
    });
  }, []);

  // Add connection between two nodes
  const addConnection = useCallback((fromNodeId, toNodeId) => {
    // Validate that both nodes exist
    const fromNode = nodes.find(n => n.id === fromNodeId);
    const toNode = nodes.find(n => n.id === toNodeId);

    if (!fromNode || !toNode) {
      console.warn(`Cannot create connection: missing nodes (${fromNodeId} -> ${toNodeId})`);
      return false;
    }

    // Check if connection already exists (in either direction)
    const exists = connections.some(
      conn => (conn.from === fromNodeId && conn.to === toNodeId) ||
        (conn.from === toNodeId && conn.to === fromNodeId)
    );

    if (!exists) {
      console.log(`Adding connection: ${fromNodeId} -> ${toNodeId}`);
      setConnections(prev => [...prev, { from: fromNodeId, to: toNodeId }]);
      return true;
    } else {
      console.log(`Connection already exists: ${fromNodeId} <-> ${toNodeId}`);
      return false;
    }
  }, [connections, setConnections, nodes]);

  // Remove connection between two nodes
  const removeConnection = useCallback((fromNodeId, toNodeId) => {
    console.log(`Removing connection: ${fromNodeId} -> ${toNodeId}`);
    const initialLength = connections.length;

    setConnections(prev =>
      prev.filter(conn =>
        !(conn.from === fromNodeId && conn.to === toNodeId) &&
        !(conn.from === toNodeId && conn.to === fromNodeId)
      )
    );

    // Log if any connections were actually removed
    setTimeout(() => {
      const newLength = connections.length;
      if (newLength < initialLength) {
        console.log(`Removed ${initialLength - newLength} connection(s)`);
      } else {
        console.log('No connections were removed (none found)');
      }
    }, 0);
  }, [connections, setConnections]);

  // Batch delete multiple nodes
  const deleteMultipleNodes = useCallback((nodeIds) => {
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) return;

    console.log(`Batch deleting ${nodeIds.length} nodes`);
    nodeIds.forEach(nodeId => deleteNode(nodeId));
  }, [deleteNode]);

  // Batch restore multiple nodes
  const restoreMultipleNodes = useCallback((nodeIds) => {
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) return;

    console.log(`Batch restoring ${nodeIds.length} nodes`);
    nodeIds.forEach(nodeId => restoreNode(nodeId));
  }, [restoreNode]);

  // Get deleted node by ID
  const getDeletedNode = useCallback((nodeId) => {
    return deletedNodes.get(nodeId) || null;
  }, [deletedNodes]);

  // Clear all deleted nodes permanently
  const clearDeletedNodes = useCallback(() => {
    console.log(`Permanently clearing ${deletedNodes.size} deleted nodes`);
    setDeletedNodes(new Map());
  }, [deletedNodes.size]);

  // Get statistics about manipulations
  const getManipulationStats = useCallback(() => {
    return {
      activeNodes: nodes.length,
      deletedNodes: deletedNodes.size,
      connections: connections.length,
      isDragging: isDraggingNode !== null,
      isResizing: isResizingNode !== null
    };
  }, [nodes.length, deletedNodes.size, connections.length, isDraggingNode, isResizingNode]);

  return {
    // Drag state
    isDraggingNode,
    isResizingNode,

    // Drag operations
    startNodeDrag,
    updateNodeDrag,
    endNodeDrag,

    // Resize operations
    startNodeResize,
    updateNodeResize,
    endNodeResize,

    // Node lifecycle
    deleteNode,
    restoreNode,
    permanentlyDeleteNode,
    deleteMultipleNodes,
    restoreMultipleNodes,
    deletedNodes,
    getDeletedNode,
    clearDeletedNodes,

    // Connection management
    addConnection,
    removeConnection,

    // Utilities
    getManipulationStats,
    clientToWorld
  };
};