// Graph persistence management

import { useState, useEffect } from 'react';

export const useSaveLoad = (nodes, connections, currentNodeId, initialPromptText) => {
  const [savedGraphs, setSavedGraphs] = useState([]);
  const [showSaveLoad, setShowSaveLoad] = useState(false);

  // Load saved graphs on startup
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('graphible') || '[]');
    setSavedGraphs(saved);
  }, []);

  const saveCurrentGraph = () => {
    if (nodes.length === 0) return;

    const graphData = {
      id: Date.now(),
      name: initialPromptText || 'Untitled Graph',
      timestamp: new Date().toISOString(),
      nodes,
      connections,
      currentNodeId
    };

    const updated = [...savedGraphs, graphData];
    setSavedGraphs(updated);
    localStorage.setItem('graphible', JSON.stringify(updated));
  };

  const loadGraph = (graphData) => {
    // This function will be handled by the main component
    // since it needs to update multiple state variables
    return graphData;
  };

  const deleteGraph = (id) => {
    const updated = savedGraphs.filter(g => g.id !== id);
    setSavedGraphs(updated);
    localStorage.setItem('graphible', JSON.stringify(updated));
  };

  return {
    savedGraphs,
    showSaveLoad,
    setShowSaveLoad,
    saveCurrentGraph,
    loadGraph,
    deleteGraph
  };
};