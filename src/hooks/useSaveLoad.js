// Graph persistence.
//
// Graphs used to live in sessionStorage, so they vanished when the browser
// closed. For a tool whose point is coming back to a conversation tree, that
// was the wrong store. They are in localStorage now, with a one-time migration
// of anything left in the old location, and can be exported to a file.

import { useState, useEffect, useCallback } from 'react';

// Date.now() alone collides: saving and importing within the same millisecond
// produced two graphs with one id, and every lookup here resolves by id, so one
// silently shadowed the other. Stays time-ordered, but never repeats.
let lastGraphId = 0;
const nextGraphId = () => {
  const now = Date.now();
  lastGraphId = now > lastGraphId ? now : lastGraphId + 1;
  return lastGraphId;
};


const STORAGE_KEY = 'graphible-graphs';
const LEGACY_KEY = 'graphible';
export const GRAPH_FILE_VERSION = 1;

const readStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStore = (graphs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs));
    return true;
  } catch (error) {
    // Quota is the likely cause: graphs carry the full text of every node.
    console.error('Could not save graphs:', error);
    return false;
  }
};

// Anything still in sessionStorage from a previous version is worth rescuing,
// but only while that session is alive - which is precisely the limitation.
const migrateLegacyGraphs = (existing) => {
  try {
    const raw = sessionStorage.getItem(LEGACY_KEY);
    if (!raw) return existing;

    const legacy = JSON.parse(raw);
    if (!Array.isArray(legacy) || legacy.length === 0) return existing;

    const known = new Set(existing.map((g) => g.id));
    const merged = [...existing, ...legacy.filter((g) => g && !known.has(g.id))];

    if (writeStore(merged)) sessionStorage.removeItem(LEGACY_KEY);
    return merged;
  } catch {
    return existing;
  }
};

export const useSaveLoad = (nodes, connections, currentNodeId, initialPromptText) => {
  const [savedGraphs, setSavedGraphs] = useState([]);
  const [showSaveLoad, setShowSaveLoad] = useState(false);

  useEffect(() => {
    setSavedGraphs(migrateLegacyGraphs(readStore()));
  }, []);

  const buildGraph = useCallback((name) => ({
    id: nextGraphId(),
    name: name || initialPromptText || 'Untitled Graph',
    timestamp: new Date().toISOString(),
    nodes,
    connections,
    currentNodeId,
  }), [nodes, connections, currentNodeId, initialPromptText]);

  const saveCurrentGraph = useCallback((name) => {
    if (nodes.length === 0) return null;

    const graph = buildGraph(name);
    setSavedGraphs((prev) => {
      const updated = [...prev, graph];
      writeStore(updated);
      return updated;
    });
    return graph;
  }, [nodes.length, buildGraph]);

  const deleteGraph = useCallback((id) => {
    setSavedGraphs((prev) => {
      const updated = prev.filter((g) => g.id !== id);
      writeStore(updated);
      return updated;
    });
  }, []);

  // Export gives the graph an existence outside this browser: a file to keep,
  // move between machines, or hand to someone else.
  const exportGraph = useCallback((graph) => {
    const payload = {
      version: GRAPH_FILE_VERSION,
      exportedAt: new Date().toISOString(),
      graph: graph ?? buildGraph(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(payload.graph.name || 'graph').replace(/[^\w.-]+/g, '-').slice(0, 60)}.graphible.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return payload;
  }, [buildGraph]);

  const importGraph = useCallback(async (file) => {
    const text = typeof file === 'string' ? file : await file.text();
    const parsed = JSON.parse(text);

    // Accept both the wrapped export and a bare graph object.
    const graph = parsed?.graph ?? parsed;
    if (!graph || !Array.isArray(graph.nodes)) {
      throw new Error('That file does not contain a Graphible graph.');
    }

    const imported = {
      ...graph,
      id: nextGraphId(),
      name: graph.name || 'Imported graph',
      timestamp: new Date().toISOString(),
      connections: Array.isArray(graph.connections) ? graph.connections : [],
    };

    setSavedGraphs((prev) => {
      const updated = [...prev, imported];
      writeStore(updated);
      return updated;
    });
    return imported;
  }, []);

  return {
    savedGraphs,
    showSaveLoad,
    setShowSaveLoad,
    saveCurrentGraph,
    deleteGraph,
    exportGraph,
    importGraph,
  };
};
