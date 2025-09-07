// Node manipulation logic

import { useState, useCallback, useRef, useEffect } from 'react';
import { NODE_SIZE } from '../constants/graphConstants';

export const useNodeManipulation = (nodes, setNodes, connections, setConnections) => {
  const [deletedNodes, setDeletedNodes] = useState(new Map());
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [isResizingNodeId, setIsResizingNodeId] = useState(null);

  // Store initial drag/resize state
  const manipulationState = useRef({
    start: null,
    initialNode: null,
    camera: null,
  });

  const startNodeDrag = useCallback((nodeId, clientX, clientY, camera) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    console.log('Starting node drag:', nodeId, 'at', clientX, clientY);

    manipulationState.current = {
      start: { x: clientX, y: clientY },
      initialNode: {
        width: NODE_SIZE.width,
        height: NODE_SIZE.height,
        worldX: node.worldX,
        worldY: node.worldY,
      },
      camera: { ...camera }
    };

    setDraggingNodeId(nodeId);
  }, [nodes]);

  // Update node position during drag
  const updateNodeDrag = useCallback((clientX, clientY) => {
    if (draggingNodeId === null || !manipulationState.current.start) return;

    const { start, initialNode, camera } = manipulationState.current;

    // Calculate mouse movement in screen space
    const deltaScreenX = clientX - start.x;
    const deltaScreenY = clientY - start.y;

    // Convert screen movement to world movement (accounting for zoom)
    const deltaWorldX = deltaScreenX / camera.zoom;
    const deltaWorldY = deltaScreenY / camera.zoom;

    // Apply the delta to the initial world position
    const newWorldX = initialNode.worldX + deltaWorldX;
    const newWorldY = initialNode.worldY + deltaWorldY;

    // Update the node position
    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === draggingNodeId
          ? { ...node, worldX: newWorldX, worldY: newWorldY }
          : node
      )
    );
  }, [draggingNodeId, setNodes]);

  // End node drag
  const endNodeDrag = useCallback(() => {
    if (draggingNodeId !== null) {
      console.log('Ending node drag for:', draggingNodeId);
      setDraggingNodeId(null);
      manipulationState.current = { start: null, initialNode: null, camera: null };
    }
  }, [draggingNodeId]);

  // Start resizing a node
  const startNodeResize = useCallback((nodeId, clientX, clientY) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    
    manipulationState.current = {
      start: { x: clientX, y: clientY },
      initialNode: {
        width: node.width || 280,
        height: node.height || 200
      }
    };
    console.log('Starting node resize:', nodeId, 'manipulationState', manipulationState.current, 'node', node);

    setIsResizingNodeId(nodeId);
  }, [nodes]);

  // Update node size during resize
  const updateNodeResize = useCallback((clientX, clientY) => {
    if (isResizingNodeId == null || !manipulationState.current.start) return;

    const deltaX = clientX - manipulationState.current.start.x;
    const deltaY = clientY - manipulationState.current.start.y;

    // Set constraints
    const minWidth = 200;
    const minHeight = 100;
    const maxWidth = 800;
    const maxHeight = 600;

    const newWidth = Math.max(minWidth, Math.min(maxWidth, manipulationState.current.initialNode.width + deltaX));
    const newHeight = Math.max(minHeight, Math.min(maxHeight, manipulationState.current.initialNode.height + deltaY));

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === isResizingNodeId
          ? { ...node, width: newWidth, height: newHeight }
          : node
      )
    );
  }, [isResizingNodeId, setNodes]);

  // End node resize
  const endNodeResize = useCallback(() => {
    if (isResizingNodeId != null) {
      console.log('Ending node resize for:', isResizingNodeId);
      setIsResizingNodeId(null);
      manipulationState.current = { start: null, initialNode: null };
    }
  }, [isResizingNodeId]);

  // Delete a node (move to deletion store)
  const deleteNode = useCallback((nodeId) => {
    const nodeToDelete = nodes.find(n => n && n.id && n.id === nodeId);
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
    setConnections(prev =>
      prev.filter(conn =>
        !(conn.from === fromNodeId && conn.to === toNodeId) &&
        !(conn.from === toNodeId && conn.to === fromNodeId)
      )
    );
  }, [setConnections]);

  // Global mouse event handlers
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (draggingNodeId !== null) {
        updateNodeDrag(e.clientX, e.clientY);
      } else if (isResizingNodeId !== null) {
        updateNodeResize(e.clientX, e.clientY);
      }
    };

    const handleGlobalMouseUp = () => {
      if (draggingNodeId !== null) {
        endNodeDrag();
      } else if (isResizingNodeId !== null) {
        endNodeResize();
      }
    };

    if (draggingNodeId !== null || isResizingNodeId !== null) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = draggingNodeId !== null ? 'grabbing' : 'se-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };
  }, [draggingNodeId, isResizingNodeId, endNodeDrag, endNodeResize, updateNodeDrag, updateNodeResize]);

  return {
    // Drag state
    draggingNodeId,
    isResizingNodeId,
    
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
    deletedNodes,

    // Connection management
    addConnection,
    removeConnection,
  };
};