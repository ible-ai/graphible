// App.jsx - Main application component
import { useState, useRef, useEffect, useCallback } from 'react';
import { Brain, RotateCcw, Save, Circle } from 'lucide-react';

// Import custom hooks
import { useCamera } from './hooks/useCamera';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useGraphState } from './hooks/useGraphState';
import { useLLMConnection } from './hooks/useLLMConnection';
import { useFeedback } from './hooks/useFeedback';
import { useSaveLoad } from './hooks/useSaveLoad';

// Import components
import CenteredPrompt from './components/CenteredPrompt';
import GenerationStatusBar from './components/GenerationStatusBar';
import NodeComponent from './components/NodeComponent';
import ConnectionComponent from './components/ConnectionComponent';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import Minimap from './components/Minimap';
import FeedbackModal from './components/FeedbackModal';
import NewPromptBox from './components/NewPromptBox';
import SaveLoadModal from './components/SaveLoadModal';

// Import constants and utilities
import { colorSchemes } from './constants/graphConstants';

const Graphible = () => {
  // Core state
  const [preferences, setPreferences] = useState({
    colorScheme: 'blue',
    layoutStyle: 'hierarchical',
    animationSpeed: 1.0,
    nodeSize: 'medium'
  });

  // UI Personality state for adaptive UI
  const [uiPersonality, setUiPersonality] = useState({
    colorScheme: 'blue',
    fontFamily: 'system',
    nodeStyle: 'rounded',
    animationStyle: 'smooth',
    layoutPattern: 'hierarchical',
    customCSS: '',
    theme: 'tech',
    colors: {
      // TODO: make these settings node.type operable.
      backgroundColor: '#3B82F6',
      borderColor: '#1E40AF',
      color: 'white',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
    }
  });

  const [adaptivePrompts, setAdaptivePrompts] = useState([]);

  const [isDragging, setIsDragging] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);
  const [showPromptCenter, setShowPromptCenter] = useState(true);
  const [initialPromptText, setInitialPromptText] = useState('');
  const [isTypingPrompt, setIsTypingPrompt] = useState(false);

  // Custom hooks
  const { camera, setCameraImmediate, setCameraTarget } = useCamera();
  const {
    nodes,
    connections,
    generationStatus,
    streamingContent,
    currentStreamingNodeId,
    addNode,
    updateGenerationStatus,
    resetGraph,
    generateWithLLM
  } = useGraphState();

  const { llmConnected, testLLMConnection } = useLLMConnection();
  const {
    feedbackHistory,
    showFeedbackModal,
    setShowFeedbackModal,
    submitFeedback,
    getQuickFeedbackOptions
  } = useFeedback();

  const {
    savedGraphs,
    showSaveLoad,
    setShowSaveLoad,
    saveCurrentGraph,
    deleteGraph
  } = useSaveLoad(nodes, connections, currentNodeId, initialPromptText);

  useKeyboardNavigation({
    nodes,
    currentNodeId,
    setCurrentNodeId,
    setNodeDetails,
    setCameraTarget,
    camera,
    setCameraImmediate,
    showPromptCenter,
    generationStatus,
    isTypingPrompt
  });

  // Use UI personality color scheme, fall back to preferences
  const currentScheme = colorSchemes[uiPersonality.colorScheme || preferences.colorScheme];

  // Initialize LLM connection
  useEffect(() => {
    testLLMConnection();
  }, [testLLMConnection]);

  // Node focusing
  useEffect(() => {
    const currentNode = nodes.at(currentNodeId);
    if (currentNode && !showPromptCenter) {
      setNodeDetails(currentNode);
    }
  }, [currentNodeId, showPromptCenter, nodes]);

  // Event handlers
  const handleNodeClick = (node) => {
    setCurrentNodeId(node.id);
    setNodeDetails(node);
    setCameraTarget(-node.worldX, -node.worldY);
  };

  const handleFeedback = (nodeId, isPositive) => {
    setShowFeedbackModal({ nodeId, isPositive });
  };

  const resetCamera = () => {
    setCameraTarget(0, 0, 1.0);
    const rootNode = nodes.find(n => n.type === 'root');
    if (rootNode) {
      setCurrentNodeId(rootNode.id);
      setNodeDetails(rootNode);
    }
  };

  const loadGraph = (graphData) => {
    // Reset state and load graph data
    setNodes(graphData.nodes);
    setCurrentNodeId(graphData.currentNodeId);
    setInitialPromptText(graphData.name);
    setShowPromptCenter(false);
    setShowSaveLoad(false);
    setNodeDetails(null);

    // Reset UI personality to default when loading a graph
    setUiPersonality(prevUiPersonality => (
      {
        ...prevUiPersonality,
        colorScheme: 'blue',
        fontFamily: 'system',
        nodeStyle: 'rounded',
        animationStyle: 'smooth',
        layoutPattern: 'hierarchical',
        customCSS: '',
        theme: 'tech'
      }));
    setAdaptivePrompts([]);

    // Reset camera
    setCameraImmediate(0, 0, 1.0);
  };

  const handleInitialPromptSubmit = async (prompt) => {
    if (!prompt.trim()) return;

    if (llmConnected !== 'connected') {
      const isConnected = await testLLMConnection();
      if (!isConnected) {
        alert('Cannot connect to LLM server. Please ensure Ollama is running at http://localhost:11434');
        return;
      }
    }

    resetGraph();
    setInitialPromptText(prompt);
    setShowPromptCenter(false);

    await generateWithLLM(prompt);
  };

  // Mouse drag handling
  useEffect(() => {
    let dragLastPos = { x: 0, y: 0 };

    const handleMouseDown = (e) => {
      if (e.target.closest('.node-component') ||
        e.target.closest('.minimap-container') ||
        e.target.closest('.details-panel')) return;

      setIsDragging(true);
      dragLastPos = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragLastPos.x;
      const deltaY = e.clientY - dragLastPos.y;

      setCameraImmediate(camera.x + deltaX / camera.zoom, camera.y + deltaY / camera.zoom);
      dragLastPos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, camera, setCameraImmediate]);

  // Zoom handling
  const handleWheel = useCallback((e) => {
    if (showPromptCenter) return;
    e.preventDefault();

    const scaleAmount = 0.1;
    const zoomFactor = e.deltaY < 0 ? (1 + scaleAmount) : (1 - scaleAmount);
    const newZoom = Math.max(0.1, Math.min(camera.zoom * zoomFactor, 3.0));

    setCameraImmediate(camera.x, camera.y, newZoom);
  }, [showPromptCenter, camera, setCameraImmediate]);

  useEffect(() => {
    if (showPromptCenter) return;
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [handleWheel, showPromptCenter]);

  // Apply adaptive body styles based on UI personality
  useEffect(() => {
    const applyGlobalStyles = () => {
      if (uiPersonality.customCSS) {
        // Create or update a style element for custom CSS
        let styleElement = document.getElementById('adaptive-styles');
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = 'adaptive-styles';
          document.head.appendChild(styleElement);
        }
        styleElement.textContent = uiPersonality.customCSS;
      }

      // Apply font family to body if needed
      if (uiPersonality.fontFamily && uiPersonality.fontFamily !== 'system') {
        if (uiPersonality.fontFamily.includes('bubble')) {
          document.body.style.fontFamily = '"Comic Sans MS", cursive, sans-serif';
        } else if (uiPersonality.fontFamily.includes('mono')) {
          document.body.style.fontFamily = '"Courier New", monospace';
        } else if (uiPersonality.fontFamily.includes('serif')) {
          document.body.style.fontFamily = 'Georgia, serif';
        }
      } else {
        document.body.style.fontFamily = '';
      }
    };

    applyGlobalStyles();

    return () => {
      // Cleanup on unmount
      const styleElement = document.getElementById('adaptive-styles');
      if (styleElement) {
        styleElement.remove();
      }
      document.body.style.fontFamily = '';
    };
  }, [uiPersonality]);

  return (
    <div
      className="w-screen h-screen relative"
      style={{ backgroundColor: currentScheme.bg }}
    >
      <GenerationStatusBar
        generationStatus={generationStatus}
        streamingContent={streamingContent}
      />

      <CenteredPrompt
        showPromptCenter={showPromptCenter}
        llmConnected={llmConnected}
        onSubmit={handleInitialPromptSubmit}
        onShowSaveLoad={() => setShowSaveLoad(true)}
      />

      {!showPromptCenter && (
        <>
          {/* UI Personality Indicator */}
          {(adaptivePrompts) && (
            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur rounded-lg p-3 text-white text-xs max-w-xs z-40">
              <div className="font-semibold mb-1">Current Style:</div>
              <div>Theme: {uiPersonality.theme}</div>
              <div>Colors: {uiPersonality.colorScheme}</div>
              <div>Font: {uiPersonality.fontFamily}</div>
              <div>Colors: {JSON.stringify(uiPersonality.colors)}</div>
              {adaptivePrompts.length > 0 && (
                <div className="mt-2 text-gray-300">
                  Adaptations: {adaptivePrompts.length}
                </div>
              )}
            </div>
          )}

          {/* LLM Status Indicator */}
          <div className="absolute top-4 right-4 flex items-center space-x-2 z-40">
            <span className="text-xs text-gray-400">LLM Status:</span>
            {llmConnected === 'pending' && <Circle size={12} className="animate-pulse text-yellow-400" />}
            {llmConnected === 'connected' && <Circle size={12} className="text-green-500" />}
            {llmConnected === 'disconnected' && <Circle size={12} className="text-red-500" />}
          </div>

          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-black/90 backdrop-blur border-b border-gray-700 p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Brain className="text-blue-400" size={24} />
                <h1 className="text-xl font-bold text-white">graph.ible</h1>
                <div className={`px-2 py-1 rounded text-xs ${llmConnected === 'connected' ? 'bg-green-600' : 'bg-red-600'}`}>
                  {llmConnected === 'connected' ? 'LLM Connected' : 'LLM Offline'}
                </div>
              </div>
              <button
                onClick={resetCamera}
                className="flex items-center gap-2 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                <RotateCcw size={16} />
                Reset View
              </button>
              <button
                onClick={() => setShowSaveLoad(true)}
                className="flex items-center gap-2 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                <Save size={16} />
                Save/Load
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="pt-20 w-full h-full relative">
            <div
              className="relative w-full h-full overflow-visible"
              style={{
                transform: `scale(${camera.zoom}) translate(${camera.x}px, ${camera.y}px)`,
                transformOrigin: 'center center'
              }}
            >
              {/* SVG for connections */}
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill={currentScheme.accent}
                    />
                  </marker>
                </defs>

                {connections.map((conn, index) => (
                  <ConnectionComponent
                    key={index}
                    fromNode={nodes.at(conn.from)}
                    toNode={nodes.at(conn.to)}
                    colorScheme={currentScheme}
                    camera={camera}
                  />
                ))}
              </svg>

              {/* Nodes */}
              {nodes.map(node => (
                <NodeComponent
                  key={node.id}
                  node={node}
                  isCurrent={node.id === currentNodeId}
                  isStreaming={currentStreamingNodeId === node.id}
                  onClick={handleNodeClick}
                  onFeedback={handleFeedback}
                  colorScheme={currentScheme}
                  camera={camera}
                  showPromptCenter={showPromptCenter}
                  generationStatus={generationStatus}
                  uiPersonality={uiPersonality}
                />
              ))}
            </div>
          </div>

          <NodeDetailsPanel
            nodeDetails={nodeDetails}
            onClose={() => setNodeDetails(null)}
            feedbackHistory={feedbackHistory}
            uiPersonality={uiPersonality}
          />

          <Minimap
            nodes={nodes}
            connections={connections}
            currentNodeId={currentNodeId}
            camera={camera}
            colorScheme={currentScheme}
            onNavigateToNode={(nodeId) => {
              const node = nodes.find(n => n.id === nodeId);
              if (node) {
                setCurrentNodeId(nodeId);
                setNodeDetails(node);
                setCameraTarget(-node.worldX, -node.worldY);
              }
            }}
            onCameraMove={setCameraTarget}
          />
        </>
      )}

      <FeedbackModal
        showFeedbackModal={showFeedbackModal}
        onClose={() => setShowFeedbackModal(null)}
        onSubmit={submitFeedback}
        getQuickFeedbackOptions={getQuickFeedbackOptions}
        uiPersonality={uiPersonality}
        setUiPersonality={setUiPersonality}
        adaptivePrompts={adaptivePrompts}
        setAdaptivePrompts={setAdaptivePrompts}
      />

      <NewPromptBox
        initialPromptText={initialPromptText}
        currentNodeId={currentNodeId}
        nodeDetails={nodeDetails}
        generationStatus={generationStatus}
        onGenerate={generateWithLLM}
        isTypingPrompt={isTypingPrompt}
        setIsTypingPrompt={setIsTypingPrompt}
        uiPersonality={uiPersonality}
        setUiPersonality={setUiPersonality}
        adaptivePrompts={adaptivePrompts}
        setAdaptivePrompts={setAdaptivePrompts}
      />

      <SaveLoadModal
        showSaveLoad={showSaveLoad}
        savedGraphs={savedGraphs}
        hasNodes={nodes.length > 0}
        onClose={() => setShowSaveLoad(false)}
        onSave={saveCurrentGraph}
        onLoad={loadGraph}
        onDelete={deleteGraph}
      />
    </div>
  );
};

export default Graphible;