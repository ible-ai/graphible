// Hook for handling node manipulation (drag, resize, delete, restore)
import { useState, useCallback, useRef } from 'react';

export const useNodeManipulation = (nodes, setNodes, connections, setConnections) => {
  const [deletedNodes, setDeletedNodes] = useState(new Map()); // Use Map for O(1) access
  const [isDraggingNode, setIsDraggingNode] = useState(null);
  const [isResizingNode, setIsResizingNode] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Start dragging a node
  const startNodeDrag = useCallback((nodeId, clientX, clientY, camera) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    dragOffsetRef.current = {
      x: (clientX - window.innerWidth / 2) / camera.zoom - node.worldX,
      y: (clientY - window.innerHeight / 2) / camera.zoom - node.worldY
    };

    setIsDraggingNode(nodeId);
  }, [nodes]);

  // Update node position during drag
  const updateNodeDrag = useCallback((clientX, clientY, camera) => {
    if (isDraggingNode === null) return;

    const worldX = (clientX - window.innerWidth / 2) / camera.zoom - dragOffsetRef.current.x;
    const worldY = (clientY - window.innerHeight / 2) / camera.zoom - dragOffsetRef.current.y;

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === isDraggingNode
          ? { ...node, worldX, worldY }
          : node
      )
    );
  }, [isDraggingNode, setNodes]);

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
  }, [nodes]);

  // Update node size during resize
  const updateNodeResize = useCallback((clientX, clientY) => {
    if (isResizingNode === null) return;

    const deltaX = clientX - resizeStart.x;
    const deltaY = clientY - resizeStart.y;

    const newWidth = Math.max(200, resizeStart.width + deltaX);
    const newHeight = Math.max(100, resizeStart.height + deltaY);

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
    setIsResizingNode(null);
    setResizeStart({ x: 0, y: 0, width: 0, height: 0 });
  }, []);

  // Delete a node (move to deletion store)
  const deleteNode = useCallback((nodeId) => {
    const nodeToDelete = nodes.find(n => n.id === nodeId);
    if (!nodeToDelete) return;

    // Find all connections involving this node
    const relatedConnections = connections.filter(
      conn => conn.from === nodeId || conn.to === nodeId
    );

    // Store deleted node with its connections and timestamp
    const deletedItem = {
      node: nodeToDelete,
      connections: relatedConnections,
      deletedAt: Date.now()
    };

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
    if (!deletedItem) return;

    // Check if any connected nodes still exist
    const validConnections = deletedItem.connections.filter(conn => {
      const fromExists = nodes.some(n => n.id === conn.from) || conn.from === nodeId;
      const toExists = nodes.some(n => n.id === conn.to) || conn.to === nodeId;
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
    setDeletedNodes(prev => {
      const newMap = new Map(prev);
      newMap.delete(nodeId);
      return newMap;
    });
  }, []);

  // Add connection between two nodes
  const addConnection = useCallback((fromNodeId, toNodeId) => {
    // Check if connection already exists
    const exists = connections.some(
      conn => (conn.from === fromNodeId && conn.to === toNodeId) ||
              (conn.from === toNodeId && conn.to === fromNodeId)
    );

    if (!exists) {
      setConnections(prev => [...prev, { from: fromNodeId, to: toNodeId }]);
    }
  }, [connections, setConnections]);

  // Remove connection between two nodes
  const removeConnection = useCallback((fromNodeId, toNodeId) => {
    setConnections(prev =>
      prev.filter(conn =>
        !(conn.from === fromNodeId && conn.to === toNodeId) &&
        !(conn.from === toNodeId && conn.to === fromNodeId)
      )
    );
  }, [setConnections]);

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
    deletedNodes,

    // Connection management
    addConnection,
    removeConnection
  };
};