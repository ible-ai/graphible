// Main application

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Save, Circle, MousePointer, Link, Trash2, Target, CircleQuestionMark } from 'lucide-react';

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

// Import constants and utilities
import { colorSchemes } from './constants/graphConstants';
import { loadSetupConfig } from './utils/setupWizardUtils';

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
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

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
    selectedNodeIds,
    contextMode,
    toggleContextMode,
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

  useEffect(() => {
    const setupConfig = loadSetupConfig();
    if (!setupConfig.isComplete) {
      setIsFirstRun(true);
      setShowSetupWizard(true);
    }
  }, []);

  useEffect(() => {
    const initializeConnection = async () => {
      let setupConfig = null;
      setTimeout(() => {
        setupConfig = loadSetupConfig();
      }, 2000);
      if (setupConfig === null || setupConfig?.isComplete) return;

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

    if (!isFirstRun) {
      initializeConnection();
    }
  }, [loadSavedConfig, handleModelChange, testLLMConnection, hasTestedInitially, isFirstRun, showSetupWizard]);

  const handleSetupComplete = useCallback((config) => {
    console.log('Setup completed with config:', config);
    setIsFirstRun(false);

    if (config.type !== 'demo') {
      handleModelChange(config);
      // Test the connection
      setTimeout(() => testLLMConnection(config), 500);
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
    setCurrentNodeId(demoData.currentNodeId);
    setInitialPromptText(demoData.name);
    setShowPromptCenter(false);
    setNodeDetails(null);
    clearSelections();

    // Reset UI personality for demo
    setUiPersonality(prevUiPersonality => ({
      ...prevUiPersonality,
      theme: 'tech',
      colorScheme: 'blue',
      fontFamily: 'system',
      customCSS: ''
    }));
    setAdaptivePrompts([]);

    setCameraImmediate(0, 0, 1.0);
  }, [resetGraph, addNode, setCurrentNodeId, setInitialPromptText, setShowPromptCenter,
    setNodeDetails, clearSelections, setUiPersonality, setAdaptivePrompts, setCameraImmediate]);

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
  const currentScheme = colorSchemes[uiPersonality.colorScheme || preferences.colorScheme || 'default'];

  // Initialize LLM connection
  useCallback(() => {
    const initializeConnection = async () => {
      let savedConfig;
      setTimeout(() => {
        savedConfig = loadSavedConfig();
        console.log('App initialization - loaded config:', savedConfig);
      }, 1500);

      if (savedConfig.type === 'external' && savedConfig.provider === 'google' && !savedConfig.apiKey) {
        const savedApiKey = localStorage.getItem('graphible-google-api-key');
        if (savedApiKey) {
          const updatedConfig = { ...savedConfig, apiKey: savedApiKey };
          handleModelChange(updatedConfig);
          console.log('Updated config with saved API key:', updatedConfig);
        }
      }

      if (!hasTestedInitially) {
        setTimeout(async () => {
          await testLLMConnection(savedConfig);
        }, 1500);
      }
    };

    initializeConnection();
  }, [loadSavedConfig, handleModelChange, testLLMConnection, hasTestedInitially]);

  // Node focusing
  useEffect(() => {
    const currentNode = nodes[currentNodeId];
    if (currentNode && !showPromptCenter) {
      setNodeDetails(currentNode);
      setCameraImmediate(-currentNode.worldX, -currentNode.worldY);
    }
  }, [currentNodeId, showPromptCenter, nodes, setCameraImmediate]);

  // Handle node manipulation mouse events
  useEffect(() => {
    const handleMouseDown = (e) => {
      // Don't interfere with node manipulation
      if (isDraggingNode != null || isResizingNode != null) return;

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
      if (isDraggingNode !== null || isResizingNode !== null) return;

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
      if (isDraggingNode !== null || isResizingNode !== null) return;

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
    isDraggingNode,
    isResizingNode,
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
    handleNodeSelection(node.id, nodes, connections, modifierKey);

    // Always update current node (except in manual mode with modifier key)
    if (!(contextMode === 'manual' && modifierKey)) {
      setCurrentNodeId(node.id);
      setNodeDetails(node);
      setCameraImmediate(-node.worldX, -node.worldY, camera.zoom);
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
        const modelType = currentModel.type === 'local' ? 'local model (Ollama)' :
          currentModel.type === 'webllm' ? 'browser model' : 'external API';
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

    await generateGraphWithLLM(prompt, null, null, currentModel, null);
  };

  const enhancedGenerateWithLLM = async (prompt, prevWorldX, prevWorldY) => {
    return generateGraphWithLLM(prompt, prevWorldX, prevWorldY, currentModel, currentNodeId);
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

      if (isInteractiveClick) return;

      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      // Fixed camera movement calculation
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      // Apply delta in world space, accounting for zoom
      setCameraImmediate(
        camera.x + deltaX / camera.zoom,
        camera.y + deltaY / camera.zoom,
        camera.zoom
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
    contextMode,
    isDraggingNode,
    isResizingNode
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
        onShowInstallationGuide={handleShowSetupWizard}
        onShowSetupWizard={handleShowSetupWizard}
        currentModel={currentModel}
        onModelChange={handleModelChange}
        onTestConnection={testLLMConnection}
        webllmLoadingProgress={webllmLoadingProgress}
        webllmLoadState={webllmLoadState}
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
                      if (contextMode !== 'smart') toggleContextMode();
                    }}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-all duration-200 ${contextMode === 'smart'
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
                    title={`Context: ${contextMode === 'smart' ? 'Smart (Ctrl+click to select)' :
                      contextMode === 'branch' ? 'Branch (click subtree)' :
                      'Batch (click generation)'}`}
                  >
                    {contextMode === 'smart' && <><Circle size={14} />Smart</>}
                    {contextMode === 'branch' && <><Link size={14} />Branch</>}
                    {contextMode === 'batch' && <><Target size={14} />Batch</>}
                    {selectedCount > 0 && (
                      <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full text-xs">
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
                    contextMode={contextMode}
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
                </div>
              ))}

            </div>
          </div>

          {/* UI panels that stay in screen coordinates */}
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
            generateWithLLM={generateWithLLM}
            currentModel={currentModel}
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
        connections={connections}
        setConnections={setConnections}
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