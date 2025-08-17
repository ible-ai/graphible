// Graph persistence management

import { useState, useEffect } from 'react';

export const useSaveLoad = (nodes, connections, currentNodeId, initialPromptText) => {
  const [savedGraphs, setSavedGraphs] = useState([]);
  const [showSaveLoad, setShowSaveLoad] = useState(false);

  // Load saved graphs on startup
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('graphible') || '[]');
      setSavedGraphs(saved);
    } catch (error) {
      console.log('Could not load saved graphs:', error);
      setSavedGraphs([]);
    }
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
    
    try {
      sessionStorage.setItem('graphible', JSON.stringify(updated));
    } catch (error) {
      console.log('Could not save graph:', error);
    }
  };

  const loadGraph = (graphData) => {
    return graphData;
  };

  const deleteGraph = (id) => {
    const updated = savedGraphs.filter(g => g.id !== id);
    setSavedGraphs(updated);
    
    try {
      sessionStorage.setItem('graphible', JSON.stringify(updated));
    } catch (error) {
      console.log('Could not update saved graphs:', error);
    }
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
