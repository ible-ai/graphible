// Main application

import { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, Save, Circle, MousePointer, Link, Trash2, Target, CircleQuestionMark, FileText, Waypoints } from 'lucide-react';

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
import SetupWizard from './components/SetupWizard/SetupWizard';
import ModelDownloadConsent from './components/ModelDownloadConsent';

// Import constants and utilities
import {
  colorSchemes,
  RESPONSE_MODES,
  RESPONSE_MODE_LABELS,
  DEFAULT_RESPONSE_MODE,
  RESPONSE_MODE_STORAGE_KEY
} from './constants/graphConstants';
import { loadSetupConfig } from './utils/setupWizardUtils';
import { focusOffsetForPanel } from './utils/panelLayout';

// Must stay in sync with the modes useNodeSelection cycles through.
const CONTEXT_MODE_LABELS = {
  auto: { title: 'Auto (relevant nodes selected for you)' },
  manual: { title: 'Manual (click nodes to select)' },
  branch: { title: 'Branch (click a subtree)' },
  batch: { title: 'Batch (click a generation)' }
};

const Graphible = () => {
  // Core state
  const [preferences] = useState({
    colorScheme: 'blue',
    layoutStyle: 'hierarchical',
    animationSpeed: 1.0,
    nodeSize: 'medium'
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [nodeDetails, setNodeDetails] = useState(null);
  const [showPromptCenter, setShowPromptCenter] = useState(true);
  const [initialPromptText, setInitialPromptText] = useState('');
  const [isTypingPrompt, setIsTypingPrompt] = useState(false);
  const [showInstallationGuide, setShowInstallationGuide] = useState(false);
  const [showDeletionStore, setShowDeletionStore] = useState(false);
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

  // Whether a reply is split into several nodes or kept whole in one.
  const [responseMode, setResponseMode] = useState(() => {
    try {
      const saved = localStorage.getItem(RESPONSE_MODE_STORAGE_KEY);
      return Object.values(RESPONSE_MODES).includes(saved) ? saved : DEFAULT_RESPONSE_MODE;
    } catch {
      return DEFAULT_RESPONSE_MODE;
    }
  });

  const toggleResponseMode = useCallback(() => {
    setResponseMode(prev => {
      const next = prev === RESPONSE_MODES.GRAPH ? RESPONSE_MODES.SINGLE : RESPONSE_MODES.GRAPH;
      try {
        localStorage.setItem(RESPONSE_MODE_STORAGE_KEY, next);
      } catch {
        // Storage can be unavailable in private windows; the mode still applies.
      }
      return next;
    });
  }, []);

  // Guards the one-shot startup connection attempt (see the effect below).
  const hasInitializedConnection = useRef(false);

  // Mirrors connectionError so the submit handler can read the reason set
  // during the await it just made, without waiting for a re-render.
  const connectionErrorRef = useRef(null);

  // Custom hooks
  const { camera, setCameraImmediate, setCameraTarget } = useCamera();

  const {
    llmConnected,
    currentModel,
    testLLMConnection,
    generateWithLLM,
    handleModelChange,
    loadSavedConfig,
    hasTestedInitially,
    webllmLoadingProgress,
    webllmLoadState,
    consentRequest,
    resolveConsentRequest,
    connectionError,
  } = useLLMConnection();

  const {
    nodes,
    connections,
    generationStatus,
    streamingContent,
    currentNodeId,
    currentStreamingNodeId,
    nodeMap,
    setCurrentNodeId,
    addNode,
    resetGraph,
    generateWithLLM: generateGraphWithLLM,
    applyLayoutOptimization,
    cancelGeneration,
    setConnections,
    setNodes
  } = useGraphState(generateWithLLM);

  // Node manipulation and selection hooks
  const {
    draggingNodeId,
    isResizingNodeId,
    startNodeDrag,
    startNodeResize,
    deleteNode,
    restoreNode,
    permanentlyDeleteNode,
    deletedNodes,
    addConnection,
    removeConnection
  } = useNodeManipulation(nodes, setNodes, connections, setConnections);

  const {
    selectedNodeIds,
    contextMode,
    toggleContextMode,
    setContextMode,
    handleNodeSelection,
    updateAutoContext,
    toggleNodeSelection,
    isNodeSelected,
    clearSelections,
    selectedCount
  } = useNodeSelection();

  const {
    feedbackHistory,
    showFeedbackModal,
    setShowFeedbackModal,
    submitFeedback,
    getQuickFeedbackOptions
  } = useFeedback(generateWithLLM);

  const {
    savedGraphs,
    showSaveLoad,
    setShowSaveLoad,
    saveCurrentGraph,
    deleteGraph,
    exportGraph,
    importGraph
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

  useEffect(() => {
    const setupConfig = loadSetupConfig();
    if (!setupConfig.isComplete) {
      setIsFirstRun(true);
      setShowSetupWizard(true);
    }
  }, []);

  useEffect(() => {
    const initializeConnection = async () => {
      const setupConfig = loadSetupConfig();

      if (setupConfig.isComplete && setupConfig.config) {
        // Use saved setup configuration
        const savedConfig = setupConfig.config;
        console.log('Using saved setup config:', savedConfig);

        if (savedConfig.type === 'external' && savedConfig.provider === 'google' && !savedConfig.apiKey) {
          const savedApiKey = localStorage.getItem('graphible-google-api-key');
          if (savedApiKey) {
            const updatedConfig = { ...savedConfig, apiKey: savedApiKey };
            handleModelChange(updatedConfig);
            console.log('Updated config with saved API key:', updatedConfig);
          }
        } else {
          handleModelChange(savedConfig);
        }

        if (!hasTestedInitially) {
          await testLLMConnection(savedConfig);
        }
      } else if (!showSetupWizard) {
        // Fallback to legacy configuration loading
        const legacyConfig = loadSavedConfig();
        console.log('App initialization - loaded legacy config:', legacyConfig);

        if (legacyConfig.type === 'external' && legacyConfig.provider === 'google' && !legacyConfig.apiKey) {
          const savedApiKey = localStorage.getItem('graphible-google-api-key');
          if (savedApiKey) {
            const updatedConfig = { ...legacyConfig, apiKey: savedApiKey };
            handleModelChange(updatedConfig);
            console.log('Updated legacy config with saved API key:', updatedConfig);
          }
        }

        if (!hasTestedInitially) {
          await testLLMConnection(legacyConfig);
        }
      }
    };

    // Run once. loadSavedConfig/handleModelChange/testLLMConnection all change
    // identity as a result of what this effect does - testLLMConnection depends
    // on currentModel, which handleModelChange sets - so keeping them as
    // dependencies re-fires the effect forever.
    if (!isFirstRun && !hasInitializedConnection.current) {
      hasInitializedConnection.current = true;
      initializeConnection();
    }
  }, [loadSavedConfig, handleModelChange, testLLMConnection, hasTestedInitially, isFirstRun, showSetupWizard]);

  const handleSetupComplete = useCallback((config) => {
    console.log('Setup completed with config:', config);
    setIsFirstRun(false);

    if (config.type !== 'demo') {
      handleModelChange(config);
      // Finishing the wizard is an explicit choice, so this test may download.
      setTimeout(() => testLLMConnection(config, { interactive: true }), 500);
    }
  }, [handleModelChange, testLLMConnection]);

  const handleSetupClose = useCallback(() => {
    setShowSetupWizard(false);

    // If this was first run and they closed without completing,
    // show the regular centered prompt
    if (isFirstRun) {
      setIsFirstRun(false);
      // The regular prompt will show since no model is configured
    }
  }, [isFirstRun]);

  const handleLoadDemoGraph = useCallback((demoData) => {
    // Load the demo graph data
    resetGraph();
    demoData.nodes.forEach(node => addNode(node));
    setConnections(demoData.connections || []);
    setCurrentNodeId(demoData.currentNodeId);
    setInitialPromptText(demoData.name);
    setShowPromptCenter(false);
    setNodeDetails(null);
    clearSelections();


    setCameraImmediate(0, 0, 1.0);
  }, [resetGraph, addNode, setConnections, setCurrentNodeId, setInitialPromptText, setShowPromptCenter,
    setNodeDetails, clearSelections, setCameraImmediate]);

  const handleShowSetupWizard = useCallback(() => {
    setShowSetupWizard(true);
  }, []);

  // Update auto context when current node changes
  useEffect(() => {
    if (nodes.length > 0 && currentNodeId !== null) {
      updateAutoContext(nodes, currentNodeId, connections);
    }
  }, [nodes, currentNodeId, connections, updateAutoContext]);

  // Use UI personality color scheme, fall back to preferences, then default
  const currentScheme = colorSchemes[preferences.colorScheme || 'default'];

  useEffect(() => {
    connectionErrorRef.current = connectionError;
  }, [connectionError]);

  // Node focusing. The details panel follows the node as it streams, so this
  // runs on every chunk - but the camera only moves when the focused node
  // actually changes, otherwise the canvas jitters throughout a generation.
  const focusedNodeIdRef = useRef(null);
  useEffect(() => {
    const currentNode = nodeMap.get(currentNodeId);
    if (!currentNode || showPromptCenter) return;

    if (focusedNodeIdRef.current !== currentNodeId) {
      focusedNodeIdRef.current = currentNodeId;
      setNodeDetails(currentNode);
      // Shift left by half the panel so the node lands in the visible half.
      setCameraImmediate(
        -currentNode.worldX - focusOffsetForPanel(camera.zoom, true),
        -currentNode.worldY
      );
      return;
    }

    // Same node: keep an open panel in step with its content while it streams,
    // but never reopen one the user has closed. This effect re-runs whenever
    // the camera moves, so an unconditional set made the close button useless.
    setNodeDetails(prev => (prev && prev.id === currentNodeId ? currentNode : prev));
  }, [currentNodeId, showPromptCenter, nodeMap, setCameraImmediate, camera.zoom]);

  // Handle node manipulation mouse events
  useEffect(() => {
    const handleMouseDown = (e) => {
      // Don't interfere with node manipulation
      if (draggingNodeId !== null || isResizingNodeId !== null) return;

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
        clickedElement.closest('a') ||
        clickedElement.closest('.node-controls') ||
        clickedElement.closest('.resize-handle');

      if (isInteractiveClick) return;

      if (e.shiftKey && clickedElement.closest('.node-component')) return;

      // Start camera dragging
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (draggingNodeId !== null || isResizingNodeId !== null) return;

      // Handle camera dragging
      if (!isDragging) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      // Apply camera movement
      setCameraImmediate(
        camera.x + deltaX / camera.zoom,
        camera.y + deltaY / camera.zoom,
        camera.zoom
      );

      // Update drag start for next frame
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    };

    const handleMouseUp = (e) => {
      if (draggingNodeId !== null || isResizingNodeId !== null) return;

      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
      }

      e.preventDefault();
    };

    // Only add listeners when not in prompt center mode
    if (!showPromptCenter) {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

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
    contextMode,
    draggingNodeId,
    isResizingNodeId,
    nodes,
    showPromptCenter
  ]);

  // Layout optimization that preserves selections
  const applyLayoutOptimizationWithSelection = useCallback(() => {
    applyLayoutOptimization();
    if (nodes.length > 1) {

      // Restore selections after layout optimization
      setTimeout(() => {
        selectedNodeIds.forEach(nodeId => {
          if (nodes.some(n => n.id === nodeId)) {
            toggleNodeSelection(nodeId);
          }
        });
      }, 100);
    }
  }, [nodes, selectedNodeIds, toggleNodeSelection, applyLayoutOptimization]);

  // Event handlers
  const handleNodeClick = useCallback((node, event) => {
    const modifierKey = event?.ctrlKey || event?.metaKey;

    // Handle context selection based on mode
    handleNodeSelection(node.id, nodes, connections);

    // Always update current node (except in manual mode with modifier key)
    if (!(contextMode === 'manual' && modifierKey)) {
      setCurrentNodeId(node.id);
      setNodeDetails(node);
      setCameraImmediate(
        -node.worldX - focusOffsetForPanel(camera.zoom, true),
        -node.worldY,
        camera.zoom
      );
    }
  }, [camera.zoom, handleNodeSelection, nodes, connections, contextMode, setCurrentNodeId, setNodeDetails, setCameraImmediate]);

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
    // useSaveLoad persists connections; without this they were dropped on load.
    setConnections(graphData.connections || []);
    setCurrentNodeId(graphData.currentNodeId);
    setInitialPromptText(graphData.name);
    setShowPromptCenter(false);
    setShowSaveLoad(false);
    setNodeDetails(null);
    clearSelections();


    setCameraImmediate(0, 0, 1.0);
  };

  const handleInitialPromptSubmit = async (prompt) => {
    if (!prompt.trim()) return;

    if (llmConnected !== 'connected') {
      // interactive: the user has just asked for a generation, so this is an
      // acceptable moment to ask about a download.
      const isConnected = await testLLMConnection(currentModel, { interactive: true });

      if (!isConnected) {
        // Declining the download is a decision, not a failure: say nothing and
        // leave the user where they were.
        if (/declined|consent/i.test(connectionErrorRef.current || '')) return;

        const modelType = currentModel.type === 'local' ? 'local model (Ollama)' :
          currentModel.type === 'webllm' ? 'browser model' : 'external API';
        const reason = connectionErrorRef.current ? `\n\nReason: ${connectionErrorRef.current}` : '';
        const proceed = window.confirm(
          `Could not connect to the ${modelType}.${reason}\n\n` +
          `Generate anyway? You can also pick a different model from the menu in the top-left.`
        );
        if (!proceed) return;
      }
    }

    resetGraph();
    clearSelections();
    setShowPromptCenter(false);

    await generateGraphWithLLM(prompt, null, null, currentModel, null, responseMode);
  };

  const enhancedGenerateWithLLM = async (prompt, prevWorldX, prevWorldY) => {
    return generateGraphWithLLM(prompt, prevWorldX, prevWorldY, currentModel, currentNodeId, responseMode);
  };

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

  return (
    <div className="w-screen h-screen relative bg-gradient-to-br from-slate-50 to-slate-100 font-inter">
      <GenerationStatusBar
        generationStatus={generationStatus}
        streamingContent={streamingContent}
        onCancel={cancelGeneration}
      />

      <CenteredPrompt
        showPromptCenter={showPromptCenter}
        setShowPromptCenter={setShowPromptCenter}
        llmConnected={llmConnected}
        onSubmit={handleInitialPromptSubmit}
        onShowSaveLoad={() => setShowSaveLoad(true)}
        onShowInstallationGuide={() => setShowInstallationGuide(true)}
        onShowSetupWizard={handleShowSetupWizard}
        currentModel={currentModel}
        onModelChange={handleModelChange}
        onTestConnection={testLLMConnection}
        webllmLoadingProgress={webllmLoadingProgress}
        webllmLoadState={webllmLoadState}
        responseMode={responseMode}
        onToggleResponseMode={toggleResponseMode}
        />

      {!showPromptCenter && (
        <>
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-light text-slate-800 tracking-tight">graph.ible</h1>
                </div>

                <ModelSelector
                  currentModel={currentModel}
                  onModelChange={handleModelChange}
                  connectionStatus={llmConnected}
                  onTestConnection={testLLMConnection}
                  webllmLoadingProgress={webllmLoadingProgress}
                  webllmLoadState={webllmLoadState}
                />
              </div>
              <button
                onClick={() => setShowSetupWizard(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
                style={{ fontSize: '12px' }}
                title="Reconfigure AI model"
              >
                <CircleQuestionMark size={16} />
                Wizard
              </button>

              <div className="flex items-center gap-3">
                {/* Mode toggle buttons */}
                <div className="flex bg-white border border-slate-200 rounded-lg p-1">
                  <button
                    onClick={() => {
                      setContextMode('auto');
                    }}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-all duration-200 ${contextMode === 'auto'
                      ? 'bg-slate-100 text-slate-800'
                      : 'text-slate-600 hover:text-slate-800'
                      }`}
                    title="Normal mode"
                  >
                    <MousePointer size={14} />
                    Normal
                  </button>
                  <button
                    onClick={toggleContextMode}
                    className="flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-all duration-200 bg-indigo-100 text-indigo-800"
                    title={`Context: ${CONTEXT_MODE_LABELS[contextMode]?.title ?? contextMode}`}
                  >
                    {contextMode === 'auto' && <><Circle size={14} />Auto</>}
                    {contextMode === 'manual' && <><MousePointer size={14} />Manual</>}
                    {contextMode === 'branch' && <><Link size={14} />Branch</>}
                    {contextMode === 'batch' && <><Target size={14} />Batch</>}
                    {selectedCount > 0 && (
                      <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full text-xs">
                        {selectedCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Response mode: split the reply into nodes, or keep it whole */}
                <button
                  onClick={toggleResponseMode}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 shadow-sm ${responseMode === RESPONSE_MODES.SINGLE
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  style={{ fontSize: '12px' }}
                  title={`${RESPONSE_MODE_LABELS[responseMode].name}: ${RESPONSE_MODE_LABELS[responseMode].description}. Click to switch.`}
                >
                  {responseMode === RESPONSE_MODES.SINGLE
                    ? <FileText size={16} />
                    : <Waypoints size={16} />}
                  {RESPONSE_MODE_LABELS[responseMode].name}
                </button>

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
          <div className="pt-20 w-full h-full relative overflow-hidden">
            {/* Background container that handles camera transformation */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                transform: `translate(${window.innerWidth / 2 + camera.x * camera.zoom}px, ${window.innerHeight / 2 + camera.y * camera.zoom}px) scale(${camera.zoom})`,
                transformOrigin: '0 0'
              }}
            >
              {/* SVG for connections - positioned in world coordinates */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  overflow: 'visible',
                  // The SVG coordinate system now matches world coordinates
                  left: -window.innerWidth / 2 / camera.zoom,
                  top: -window.innerHeight / 2 / camera.zoom,
                  width: window.innerWidth / camera.zoom,
                  height: window.innerHeight / camera.zoom
                }}
                viewBox={`${-window.innerWidth / 2 / camera.zoom} ${-window.innerHeight / 2 / camera.zoom} ${window.innerWidth / camera.zoom} ${window.innerHeight / camera.zoom}`}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill="rgb(148, 163, 184)"
                    />
                  </marker>
                </defs>

                {connections.map((conn, index) => {
                  // By id, not array position: ids stop matching indices
                  // after any deletion.
                  const fromNode = nodeMap.get(conn.from);
                  const toNode = nodeMap.get(conn.to);

                  if (!fromNode || !toNode) return null;

                  const fromX = fromNode.worldX;
                  const fromY = fromNode.worldY;
                  const toX = toNode.worldX;
                  const toY = toNode.worldY;

                  const dx = toX - fromX;
                  const dy = toY - fromY;
                  const distance = Math.sqrt(dx * dx + dy * dy);

                  if (distance === 0) return null;

                  // Create curved path
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
                        strokeWidth={2 / camera.zoom} // Scale stroke width with zoom
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
                        r={4 / camera.zoom}
                        fill="rgb(148, 163, 184)"
                        stroke="white"
                        strokeWidth={2 / camera.zoom}
                        style={{
                          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
                        }}
                      />
                      <circle
                        cx={toX}
                        cy={toY}
                        r={4 / camera.zoom}
                        fill="rgb(59, 130, 246)"
                        stroke="white"
                        strokeWidth={2 / camera.zoom}
                        style={{
                          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
                        }}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Nodes positioned in world coordinates */}
              {nodes.map(node => (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: node.worldX,
                    top: node.worldY,
                    transform: 'translate(-50%, -50%)' // Center the node on its world position
                  }}
                >
                  <NodeComponent
                    node={node}
                    isCurrent={node.id === currentNodeId}
                    isStreaming={currentStreamingNodeId === node.id}
                    isSelected={isNodeSelected(node.id)}
                    onClick={handleNodeClick}
                    onFeedback={handleFeedback}
                    colorScheme={currentScheme}
                    showPromptCenter={showPromptCenter}
                    generationStatus={generationStatus}
                    // Manipulation handlers
                    onStartDrag={startNodeDrag}
                    onStartResize={startNodeResize}
                    onDelete={deleteNode}
                    // Selection handlers
                    onToggleSelection={toggleNodeSelection}
                    camera={camera}
                  />
                </div>
              ))}

            </div>
          </div>

          {/* UI panels that stay in screen coordinates */}
          <NodeDetailsPanel
            nodeDetails={nodeDetails}
            onClose={() => setNodeDetails(null)}
            feedbackHistory={feedbackHistory}
          />

          <Minimap
            nodes={nodes}
            connections={connections}
            currentNodeId={currentNodeId}
            camera={camera}
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
      />

      <NewPromptBox
        currentNodeId={currentNodeId}
        nodeDetails={nodeDetails}
        generationStatus={generationStatus}
        onGenerate={enhancedGenerateWithLLM}
        isTypingPrompt={isTypingPrompt}
        setIsTypingPrompt={setIsTypingPrompt}
        nodes={nodes}
        connections={connections}
        selectedNodeIds={selectedNodeIds}
      />

      <SaveLoadModal
        showSaveLoad={showSaveLoad}
        savedGraphs={savedGraphs}
        hasNodes={nodes.length > 0}
        onClose={() => setShowSaveLoad(false)}
        onSave={saveCurrentGraph}
        onLoad={loadGraph}
        onDelete={deleteGraph}
        onExport={exportGraph}
        onImport={importGraph}
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

      <ModelDownloadConsent
        request={consentRequest}
        onDecide={resolveConsentRequest}
      />

      <SetupWizard
        isOpen={showSetupWizard}
        onClose={handleSetupClose}
        onComplete={handleSetupComplete}
        onModelChange={handleModelChange}
        onLoadDemoGraph={handleLoadDemoGraph}
      />

    </div>
  );
};

Graphible.displayName = 'Graphible';

export default Graphible;