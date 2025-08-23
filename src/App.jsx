// Main application

import { useState, useEffect, useCallback } from 'react';
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
import ModelSelector from './components/ModelSelector';
import InstallationGuide from './components/InstallationGuide';

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

  // Simplified UI Personality state - consistent structure
  const [uiPersonality, setUiPersonality] = useState({
    theme: 'tech',
    colorScheme: 'blue',
    fontFamily: 'system',
    nodeStyle: 'rounded',
    animationStyle: 'smooth',
    layoutPattern: 'hierarchical',
    customCSS: '',
    colors: {
      root: {
        backgroundColor: '#FCD34D',
        borderColor: '#1E40AF',
        textColor: 'white',
        accentColor: '#60A5FA',
        positiveColor: '#10B981',
        negativeColor: '#EF4444',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
        isCurrent: {
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        },
      },
      default: {
        backgroundColor: '#3B82F6',
        borderColor: '#1E40AF',
        textColor: 'white',
        accentColor: '#60A5FA',
        positiveColor: '#10B981',
        negativeColor: '#EF4444'
      },
    },
    typography: {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      fontWeight: 'normal'
    },
    layout: {
      padding: '16px',
      borderRadius: '12px',
      borderWidth: '2px',
      scale: '1.0'
    },
    effects: {
      shadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
      textShadow: 'none',
      filter: 'none'
    },
    animations: {
      transition: 'all 0.3s ease-out',
      transform: 'none'
    },
    customProperties: {},
    decorativeElements: []
  });

  const [adaptivePrompts, setAdaptivePrompts] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [nodeDetails, setNodeDetails] = useState(null);
  const [showPromptCenter, setShowPromptCenter] = useState(true);
  const [initialPromptText, setInitialPromptText] = useState('');
  const [isTypingPrompt, setIsTypingPrompt] = useState(false);
  const [showInstallationGuide, setShowInstallationGuide] = useState(false);

  // Custom hooks
  const { camera, setCameraImmediate, setCameraTarget } = useCamera();

  // Enhanced LLM connection with model selection
  const {
    llmConnected,
    currentModel,
    testLLMConnection,
    generateWithLLM,
    handleModelChange,
    loadSavedConfig,
    hasTestedInitially
  } = useLLMConnection();

  const {
    nodes,
    connections,
    generationStatus,
    streamingContent,
    currentNodeId,
    currentStreamingNodeId,
    setCurrentNodeId,
    addNode,
    resetGraph,
    generateWithLLM: generateGraphWithLLM,
    applyLayoutOptimization,
    setConnections
  } = useGraphState(generateWithLLM);

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
    isTypingPrompt,
    showFeedbackModal
  });

  // Use UI personality color scheme, fall back to preferences, then default
  const currentScheme = colorSchemes[uiPersonality.colorScheme || preferences.colorScheme || 'default'];

  // Initialize LLM connection
  useEffect(() => {
    const initializeConnection = async () => {
      const savedConfig = loadSavedConfig();
      console.log('App initialization - loaded config:', savedConfig);

      // Load saved Google API key if it exists and we're using external config
      if (savedConfig.type === 'external' && savedConfig.provider === 'google' && !savedConfig.apiKey) {
        const savedApiKey = localStorage.getItem('graphible-google-api-key');
        if (savedApiKey) {
          const updatedConfig = { ...savedConfig, apiKey: savedApiKey };
          handleModelChange(updatedConfig);
          console.log('Updated config with saved API key:', updatedConfig);
        }
      }

      // Only test connection once on app startup
      if (!hasTestedInitially) {
        await testLLMConnection(savedConfig);
      }
    };

    initializeConnection();
  }, []); // Empty dependency array - only run once on mount

  // Node focusing
  useEffect(() => {
    const currentNode = nodes[currentNodeId];
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
    resetGraph();
    // Load nodes and connections
    graphData.nodes.forEach(node => addNode(node));
    setCurrentNodeId(graphData.currentNodeId);
    setInitialPromptText(graphData.name);
    setShowPromptCenter(false);
    setShowSaveLoad(false);
    setNodeDetails(null);

    // Reset UI personality to default when loading a graph
    setUiPersonality(prevUiPersonality => ({
      ...prevUiPersonality,
      theme: 'tech',
      colorScheme: 'blue',
      fontFamily: 'system',
      customCSS: ''
    }));
    setAdaptivePrompts([]);

    // Reset camera
    setCameraImmediate(0, 0, 1.0);
  };

  const handleInitialPromptSubmit = async (prompt) => {
    if (!prompt.trim()) return;

    // Always proceed, but test connection if not already connected
    if (llmConnected !== 'connected') {

      const isConnected = await testLLMConnection();
      if (!isConnected) {
        // Show a more user-friendly message but still allow them to proceed
        const modelType = currentModel.type === 'local' ? 'local model (Ollama)' : 'external API';
        const proceed = window.confirm(
          `Could not connect to ${modelType}. Would you like to try generating anyway? ` +
          `(You can configure your model settings using the dropdown in the top-left)`
        );
        if (!proceed) return;
      }
    }

    resetGraph();
    setShowPromptCenter(false);

    await generateGraphWithLLM(prompt, null, null, currentModel);
  };

  // Enhanced prompt generation that passes currentModel
  const enhancedGenerateWithLLM = async (prompt, prevWorldX, prevWorldY) => {
    return generateGraphWithLLM(prompt, prevWorldX, prevWorldY, currentModel);
  };

  // Mouse drag handling with proper event detection
  useEffect(() => {
    const handleMouseDown = (e) => {
      // Only start dragging if clicking on the background (not on interactive elements)
      if (
        e.target.closest('.node-component') ||
        e.target.closest('.minimap-container') ||
        e.target.closest('.details-panel') ||
        e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('textarea')
      ) {
        return;
      }

      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      setCameraImmediate(
        camera.x + deltaX / camera.zoom,
        camera.y + deltaY / camera.zoom
      );

      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    };

    const handleMouseUp = (e) => {
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
        e.preventDefault();
      }
    };

    // Add listeners to document to catch all mouse events
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Handle mouse leave to stop dragging
    document.addEventListener('mouseleave', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };
  }, [isDragging, camera, setCameraImmediate, dragStart]);

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

    const handleWheelEvent = (e) => handleWheel(e);
    document.addEventListener('wheel', handleWheelEvent, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleWheelEvent);
    };
  }, [handleWheel, showPromptCenter]);

  // Apply adaptive body styles based on UI personality
  useEffect(() => {
    const applyGlobalStyles = () => {
      if (uiPersonality.customCSS) {
        let styleElement = document.getElementById('adaptive-styles');
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = 'adaptive-styles';
          document.head.appendChild(styleElement);
        }
        styleElement.textContent = uiPersonality.customCSS;
      }

      // Apply font family to body
      if (uiPersonality.typography?.fontFamily && uiPersonality.typography.fontFamily !== 'system') {
        if (uiPersonality.typography.fontFamily.includes('bubble')) {
          document.body.style.fontFamily = '"Comic Sans MS", cursive, sans-serif';
        } else if (uiPersonality.typography.fontFamily.includes('mono')) {
          document.body.style.fontFamily = '"Courier New", monospace';
        } else if (uiPersonality.typography.fontFamily.includes('serif')) {
          document.body.style.fontFamily = 'Georgia, serif';
        }
      } else {
        document.body.style.fontFamily = '';
      }
    };

    applyGlobalStyles();

    return () => {
      const styleElement = document.getElementById('adaptive-styles');
      if (styleElement) {
        styleElement.remove();
      }
      document.body.style.fontFamily = '';
    };
  }, [uiPersonality]);

  return (
    <div
      className="w-screen h-screen relative bg-gradient-to-br from-slate-50 to-slate-100 font-inter"
    >
      <GenerationStatusBar
        generationStatus={generationStatus}
        streamingContent={streamingContent}
      />

      <CenteredPrompt
        showPromptCenter={showPromptCenter}
        setShowPromptCenter={setShowPromptCenter}
        llmConnected={llmConnected}
        onSubmit={handleInitialPromptSubmit}
        onShowSaveLoad={() => setShowSaveLoad(true)}
        onShowInstallationGuide={() => setShowInstallationGuide(true)}
        currentModel={currentModel}
        onModelChange={handleModelChange}
        onTestConnection={testLLMConnection}
      />

      {!showPromptCenter && (
        <>
          {/* UI Personality Indicator */}
          {adaptivePrompts.length > 0 && (
            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur rounded-lg p-3 text-white text-xs max-w-xs z-40">
              <div className="font-semibold mb-1">Current Style:</div>
              <div>Theme: {uiPersonality.theme}</div>
              <div>Colors: {uiPersonality.colorScheme}</div>
              <div>Font: {uiPersonality.typography?.fontFamily}</div>
              <div className="mt-2 text-gray-300">
                Adaptations: {adaptivePrompts.length}
              </div>
            </div>
          )}

          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl shadow-sm flex items-center justify-center">
                    <Brain className="text-slate-600" size={20} />
                  </div>
                  <h1 className="text-xl font-light text-slate-800 tracking-tight">graph.ible</h1>
                </div>

                {/* Model Selector */}
                <ModelSelector
                  currentModel={currentModel}
                  onModelChange={handleModelChange}
                  connectionStatus={llmConnected}
                  onTestConnection={testLLMConnection}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={applyLayoutOptimization}
                  disabled={nodes.length < 2}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-50 shadow-sm"
                >
                  <Circle size={16} />
                  Optimize Layout
                </button>
                <button
                  onClick={resetCamera}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
                >
                  <RotateCcw size={16} />
                  Reset View
                </button>
                <button
                  onClick={() => setShowSaveLoad(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
                >
                  <Save size={16} />
                  Save/Load
                </button>
              </div>
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
                      fill="rgb(148, 163, 184)"
                    />
                  </marker>
                </defs>

                {connections.map((conn, index) => (
                  <ConnectionComponent
                    key={index}
                    fromNode={nodes[conn.from]}
                    toNode={nodes[conn.to]}
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
        onGenerate={enhancedGenerateWithLLM}
        isTypingPrompt={isTypingPrompt}
        setIsTypingPrompt={setIsTypingPrompt}
        uiPersonality={uiPersonality}
        setUiPersonality={setUiPersonality}
        adaptivePrompts={adaptivePrompts}
        setAdaptivePrompts={setAdaptivePrompts}
        nodes={nodes}
        setConnections={setConnections}
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

      <InstallationGuide
        showGuide={showInstallationGuide}
        onClose={() => setShowInstallationGuide(false)}
      />
    </div>
  );
};

export default Graphible;