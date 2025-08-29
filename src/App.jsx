// Main application

import { useState, useEffect, useCallback } from 'react';
import { Brain, RotateCcw, Save, Circle, MousePointer, Link, Trash2, Target } from 'lucide-react';

// Import custom hooks
import { useCamera } from './hooks/useCamera';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useGraphState } from './hooks/useGraphState';
import { useLLMConnection } from './hooks/useLLMConnection';
import { useFeedback } from './hooks/useFeedback';
import { useSaveLoad } from './hooks/useSaveLoad';
import { useNodeManipulation } from './hooks/useNodeManipulation';
import { useNodeSelection } from './hooks/useNodeSelection';

// Import components
import CenteredPrompt from './components/CenteredPrompt';
import GenerationStatusBar from './components/GenerationStatusBar';
import NodeComponent from './components/NodeComponent';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import Minimap from './components/Minimap';
import FeedbackModal from './components/FeedbackModal';
import NewPromptBox from './components/NewPromptBox';
import SaveLoadModal from './components/SaveLoadModal';
import ModelSelector from './components/ModelSelector';
import InstallationGuide from './components/InstallationGuide';
import DeletionStoreModal from './components/DeletionStoreModal';
import ConnectionManager from './components/ConnectionManager';

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

  // UI Personality state - keeping existing structure
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
  const [showDeletionStore, setShowDeletionStore] = useState(false);
  const [showConnectionManager, setShowConnectionManager] = useState(false);

  // Custom hooks
  const { camera, setCameraImmediate, setCameraTarget } = useCamera();

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
    setConnections,
    setNodes
  } = useGraphState(generateWithLLM);

  // Node manipulation and selection hooks
  const {
    isDraggingNode,
    isResizingNode,
    startNodeDrag,
    updateNodeDrag,
    endNodeDrag,
    startNodeResize,
    updateNodeResize,
    endNodeResize,
    deleteNode,
    restoreNode,
    permanentlyDeleteNode,
    deletedNodes,
    addConnection,
    removeConnection
  } = useNodeManipulation(nodes, setNodes, connections, setConnections);

  const {
    selectedNodes,
    selectionMode,
    isDragSelecting,
    toggleSelectionMode,
    toggleNodeSelection,
    isNodeSelected,
    clearSelections,
    autoSelectRecentBatch,
    startDragSelection,
    updateDragSelection,
    endDragSelection,
    getSelectionBox,
    selectedCount
  } = useNodeSelection();

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
    showFeedbackModal: showFeedbackModal !== null
  });

  // Auto-select most recent batch when generation completes
  useEffect(() => {
    if (!generationStatus.isGenerating && nodes.length > 0 && generationStatus.currentNodeId !== null) {
      autoSelectRecentBatch(nodes, Math.max(...nodes.map(n => n.batchId || 0)));
    }
  }, [generationStatus.isGenerating, nodes, generationStatus.currentNodeId, autoSelectRecentBatch]);

  // Use UI personality color scheme, fall back to preferences, then default
  const currentScheme = colorSchemes[uiPersonality.colorScheme || preferences.colorScheme || 'default'];

  // Initialize LLM connection
  useCallback(() => {
    const initializeConnection = async () => {
      const savedConfig = loadSavedConfig();
      console.log('App initialization - loaded config:', savedConfig);

      if (savedConfig.type === 'external' && savedConfig.provider === 'google' && !savedConfig.apiKey) {
        const savedApiKey = localStorage.getItem('graphible-google-api-key');
        if (savedApiKey) {
          const updatedConfig = { ...savedConfig, apiKey: savedApiKey };
          handleModelChange(updatedConfig);
          console.log('Updated config with saved API key:', updatedConfig);
        }
      }

      if (!hasTestedInitially) {
        await testLLMConnection(savedConfig);
      }
    };

    initializeConnection();
  }, [loadSavedConfig, handleModelChange, testLLMConnection, hasTestedInitially]);

  // Node focusing
  useEffect(() => {
    const currentNode = nodes[currentNodeId];
    if (currentNode && !showPromptCenter) {
      setNodeDetails(currentNode);
    }
  }, [currentNodeId, showPromptCenter, nodes]);

  // Handle node manipulation mouse events
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingNode !== null) {
        updateNodeDrag(e.clientX, e.clientY, camera);
      }
      if (isResizingNode !== null) {
        updateNodeResize(e.clientX, e.clientY);
      }
      if (isDragSelecting) {
        updateDragSelection(e.clientX, e.clientY, camera);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingNode !== null) {
        endNodeDrag();
      }
      if (isResizingNode !== null) {
        endNodeResize();
      }
      if (isDragSelecting) {
        endDragSelection(nodes);
      }
    };

    if (isDraggingNode !== null || isResizingNode !== null || isDragSelecting) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      if (isDraggingNode !== null) {
        document.body.style.cursor = 'grabbing';
      } else if (isResizingNode !== null) {
        document.body.style.cursor = 'se-resize';
      }
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };
  }, [
    isDraggingNode,
    isResizingNode,
    isDragSelecting,
    updateNodeDrag,
    updateNodeResize,
    updateDragSelection,
    endNodeDrag,
    endNodeResize,
    endDragSelection,
    camera,
    nodes
  ]);

  // Layout optimization that preserves selections
  const applyLayoutOptimizationWithSelection = useCallback(() => {
    applyLayoutOptimization();
    if (nodes.length > 1) {

      // Restore selections after layout optimization
      setTimeout(() => {
        selectedNodes.forEach(nodeId => {
          if (nodes.some(n => n.id === nodeId)) {
            toggleNodeSelection(nodeId);
          }
        });
      }, 100);
    }
  }, [nodes, selectedNodes, toggleNodeSelection, applyLayoutOptimization]);

  // Event handlers
  const handleNodeClick = (node) => {
    if (selectionMode) {
      toggleNodeSelection(node.id);
      return;
    }

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
    resetGraph();
    graphData.nodes.forEach(node => addNode(node));
    setCurrentNodeId(graphData.currentNodeId);
    setInitialPromptText(graphData.name);
    setShowPromptCenter(false);
    setShowSaveLoad(false);
    setNodeDetails(null);
    clearSelections();

    setUiPersonality(prevUiPersonality => ({
      ...prevUiPersonality,
      theme: 'tech',
      colorScheme: 'blue',
      fontFamily: 'system',
      customCSS: ''
    }));
    setAdaptivePrompts([]);

    setCameraImmediate(0, 0, 1.0);
  };

  const handleInitialPromptSubmit = async (prompt) => {
    if (!prompt.trim()) return;

    if (llmConnected !== 'connected') {
      const isConnected = await testLLMConnection();
      if (!isConnected) {
        const modelType = currentModel.type === 'local' ? 'local model (Ollama)' : 'external API';
        const proceed = window.confirm(
          `Could not connect to ${modelType}. Would you like to try generating anyway? ` +
          `(You can configure your model settings using the dropdown in the top-left)`
        );
        if (!proceed) return;
      }
    }

    resetGraph();
    clearSelections();
    setShowPromptCenter(false);

    await generateGraphWithLLM(prompt, null, null, currentModel);
  };

  const enhancedGenerateWithLLM = async (prompt, prevWorldX, prevWorldY) => {
    return generateGraphWithLLM(prompt, prevWorldX, prevWorldY, currentModel);
  };

  // Background drag handling
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (isDraggingNode !== null || isResizingNode !== null) return;

      const clickedElement = e.target;
      const isInteractiveClick =
        clickedElement.closest('.node-component') ||
        clickedElement.closest('.minimap-container') ||
        clickedElement.closest('.details-panel') ||
        clickedElement.closest('button') ||
        clickedElement.closest('input') ||
        clickedElement.closest('textarea') ||
        clickedElement.closest('.modal') ||
        clickedElement.closest('select') ||
        clickedElement.closest('a');

      if (isInteractiveClick) {
        return;
      }

      if (selectionMode) {
        startDragSelection(e.clientX, e.clientY, camera);
      } else {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }

      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (isDragSelecting || !isDragging) return;

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

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };
  }, [
    isDragging,
    camera,
    setCameraImmediate,
    dragStart,
    selectionMode,
    isDraggingNode,
    isResizingNode,
    isDragSelecting,
    startDragSelection
  ]);

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
    <div className="w-screen h-screen relative bg-gradient-to-br from-slate-50 to-slate-100 font-inter">
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
          {/* Mode indicators */}
          {(selectionMode || selectedCount > 0) && (
            <div className="absolute bottom-8 left-6 bg-blue-500/90 backdrop-blur rounded-lg p-3 text-white text-sm z-40 opacity-60">
              <div className="font-semibold mb-1">Selection Mode</div>
              <div>{selectedCount} node{selectedCount !== 1 ? 's' : ''} selected</div>
              <div className="text-blue-100 text-xs mt-1">
                Click nodes to select • Click mode button to exit
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

                <ModelSelector
                  currentModel={currentModel}
                  onModelChange={handleModelChange}
                  connectionStatus={llmConnected}
                  onTestConnection={testLLMConnection}
                />
              </div>

              <div className="flex items-center gap-3">
                {/* Mode toggle buttons */}
                <div className="flex bg-white border border-slate-200 rounded-lg p-1">
                  <button
                    onClick={() => {
                      if (selectionMode) toggleSelectionMode();
                    }}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-all duration-200 ${!selectionMode
                        ? 'bg-slate-100 text-slate-800'
                        : 'text-slate-600 hover:text-slate-800'
                      }`}
                    title="Normal mode"
                  >
                    <MousePointer size={14} />
                    Normal
                  </button>
                  <button
                    onClick={toggleSelectionMode}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-all duration-200 ${selectionMode
                        ? 'bg-blue-100 text-blue-300 opacity-80'
                        : 'text-slate-600 hover:text-slate-800'
                      }`}
                    title="Selection mode"
                  >
                    <Target size={14} />
                    Select
                    {selectedCount > 0 && (
                      <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded-full text-xs">
                        {selectedCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Action buttons */}
                <button
                  onClick={applyLayoutOptimizationWithSelection}
                  disabled={nodes.length < 2}
                  style={{ fontSize: '12px' }}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-50 shadow-sm"
                >
                  <Circle size={16} />
                  Optimize Layout
                </button>

                <button
                  onClick={() => setShowConnectionManager(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
                  style={{ fontSize: '12px' }}
                >
                  <Link size={16} />
                  Connections
                </button>

                <button
                  onClick={() => setShowDeletionStore(true)}
                  style={{ fontSize: '12px' }}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
                >
                  <Trash2 size={16} /> Deleted ({deletedNodes.size})
                </button>

                <button
                  onClick={resetCamera}
                  style={{ fontSize: '12px' }}
                  className="flex items-center gap-2 px-2 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
                  >
                  <RotateCcw size={16} />
                  Reset View
                </button>

                <button
                  onClick={() => setShowSaveLoad(true)}
                  style={{ fontSize: '12px' }}
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
              {/* SVG for connections - positioned to match world coordinates */}
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{
                  overflow: 'visible',
                  transform: 'translate(50vw, 50vh)'
                }}
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

                {connections.map((conn, index) => {
                  const fromNode = nodes[conn.from];
                  const toNode = nodes[conn.to];

                  if (!fromNode || !toNode) return null;

                  const fromX = fromNode.worldX;
                  const fromY = fromNode.worldY;
                  const toX = toNode.worldX;
                  const toY = toNode.worldY;

                  const dx = toX - fromX;
                  const dy = toY - fromY;
                  const distance = Math.sqrt(dx * dx + dy * dy);

                  if (distance === 0) return null;

                  const midX = (fromX + toX) / 2;
                  const midY = (fromY + toY) / 2;
                  const controlOffset = Math.min(distance * 0.15, 60);
                  const unitX = dx / distance;
                  const unitY = dy / distance;
                  const controlX = midX + (-unitY * controlOffset);
                  const controlY = midY + (unitX * controlOffset);

                  const path = `M${fromX},${fromY} Q${controlX},${controlY} ${toX},${toY}`;

                  return (
                    <g key={index}>
                      <path
                        d={path}
                        stroke="rgb(148, 163, 184)"
                        strokeWidth="2"
                        fill="none"
                        strokeOpacity="0.6"
                        markerEnd="url(#arrowhead)"
                        strokeLinecap="round"
                        style={{
                          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
                        }}
                      />

                      <circle
                        cx={fromX}
                        cy={fromY}
                        r="4"
                        fill="rgb(148, 163, 184)"
                        stroke="white"
                        strokeWidth="2"
                        style={{
                          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
                        }}
                      />
                      <circle
                        cx={toX}
                        cy={toY}
                        r="4"
                        fill="rgb(59, 130, 246)"
                        stroke="white"
                        strokeWidth="2"
                        style={{
                          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
                        }}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {nodes.map(node => (
                <NodeComponent
                  key={node.id}
                  node={node}
                  isCurrent={node.id === currentNodeId}
                  isStreaming={currentStreamingNodeId === node.id}
                  isSelected={isNodeSelected(node.id)}
                  selectionMode={selectionMode}
                  onClick={handleNodeClick}
                  onFeedback={handleFeedback}
                  colorScheme={currentScheme}
                  showPromptCenter={showPromptCenter}
                  generationStatus={generationStatus}
                  uiPersonality={uiPersonality}
                  // Manipulation handlers
                  onStartDrag={startNodeDrag}
                  onStartResize={startNodeResize}
                  onDelete={deleteNode}
                  // Selection handlers
                  onToggleSelection={toggleNodeSelection}
                  camera={camera}
                />
              ))}

              {/* Selection box overlay */}
              {isDragSelecting && (() => {
                const selectionBox = getSelectionBox();
                if (!selectionBox) return null;

                return (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none z-20 opacity-10"
                    style={{
                      left: selectionBox.x,
                      top: selectionBox.y,
                      width: selectionBox.width,
                      height: selectionBox.height,
                    }}
                  />
                );
              })()}
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
        selectedNodes={selectedNodes}
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

      {/* New Modals - will need to create these components */}
      {showDeletionStore && (
        <DeletionStoreModal
          isOpen={showDeletionStore}
          onClose={() => setShowDeletionStore(false)}
          deletedNodes={deletedNodes}
          onRestoreNode={restoreNode}
          onPermanentlyDeleteNode={permanentlyDeleteNode}
        />
      )}

      {showConnectionManager && (
        <ConnectionManager
          isOpen={showConnectionManager}
          onClose={() => setShowConnectionManager(false)}
          nodes={nodes}
          connections={connections}
          onAddConnection={addConnection}
          onRemoveConnection={removeConnection}
        />
      )}
    </div>
  );
};

Graphible.displayName = 'Graphible';

export default Graphible;