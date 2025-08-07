import { useState, useRef, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, Brain, X, Maximize2, Minimize2, Send, Zap, Circle, RotateCcw, Save, FolderOpen } from 'lucide-react';

const Graphible = () => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [currentRootPromptNodeId, setCurrentRootPromptNodeId] = useState(null);
  const [currentId, setCurrentId] = useState(0);
  const [currNodeDepth, setCurrNodeDepth] = useState(0);
  const [nodeIdOffset, setNodeIdOffset] = useState(0);
  const [initialPromptText, setInitialPromptText] = useState('');
  const [showPromptCenter, setShowPromptCenter] = useState(true);
  const [llmConnected, setLlmConnected] = useState('pending');
  const [preferences, setPreferences] = useState({
    colorScheme: 'blue',
    layoutStyle: 'hierarchical',
    animationSpeed: 1.0,
    nodeSize: 'medium'
  });
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackCategories, setFeedbackCategories] = useState({
    content: { positive: [], negative: [] },
    visual: { positive: [], negative: [] },
    layout: { positive: [], negative: [] },
    interaction: { positive: [], negative: [] }
  });
  const [showFeedbackModal, setShowFeedbackModal] = useState(null);
  const [minimapExpanded, setMinimapExpanded] = useState(false);
  const [nodeDetails, setNodeDetails] = useState(null);
  const keysPressed = useRef(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [minimapZoom, setMinimapZoom] = useState(1.0);

  // New states for improved functionality
  const [isTypingFeedback, setIsTypingFeedback] = useState(false);
  const [isTypingPrompt, setIsTypingPrompt] = useState(false);
  const [newPromptInput, setNewPromptInput] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const [generationBatch, setGenerationBatch] = useState(0);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [savedGraphs, setSavedGraphs] = useState([]);

  // New states for streaming and generation status
  const [generationStatus, setGenerationStatus] = useState({
    isGenerating: false,
    currentNodeId: null,
    tokensGenerated: 0,
    startTime: null,
    elapsedTime: 0
  });
  const [streamingContent, setStreamingContent] = useState('');
  const [currentStreamingNodeId, setCurrentStreamingNodeId] = useState(null);

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });


  // Global coordinate system constants.
  const WORLD_CENTER = { x: 0, y: 0 };
  const NODE_SIZE = { width: 180, height: 100 };
  const NODE_SPACING = { x: NODE_SIZE.width * 1.8, y: NODE_SIZE.height * 1.5 };
  const VIEWPORT_CENTER = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  const colorSchemes = {
    blue: { primary: '#3B82F6', secondary: '#1E40AF', accent: '#60A5FA', bg: '#0F172A', street: '#1E293B' },
    purple: { primary: '#8B5CF6', secondary: '#7C3AED', accent: '#A78BFA', bg: '#1E1B4B', street: '#312E81' },
    green: { primary: '#10B981', secondary: '#059669', accent: '#34D399', bg: '#064E3B', street: '#065F46' },
    orange: { primary: '#F59E0B', secondary: '#D97706', accent: '#FBBF24', bg: '#92400E', street: '#B45309' }
  };

  const currentScheme = colorSchemes[preferences.colorScheme];

  const setCameraImmediate = useCallback((x, y, zoom = camera.zoom) => {
    setCamera({ x, y, zoom });
  }, [camera.zoom]);

  const setCameraTarget = useCallback((x, y, zoom = camera.zoom) => {
    // Smooth transition using requestAnimationFrame
    const startCamera = { ...camera };
    const targetCamera = { x, y, zoom };
    const startTime = performance.now();
    const duration = 300; // ms

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const newCamera = {
        x: startCamera.x + (targetCamera.x - startCamera.x) * easeOut,
        y: startCamera.y + (targetCamera.y - startCamera.y) * easeOut,
        zoom: startCamera.zoom + (targetCamera.zoom - startCamera.zoom) * easeOut
      };

      setCamera(newCamera);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [camera]);

  // Load saved graphs on startup
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('graphible') || '[]');
    setSavedGraphs(saved);
  }, []);

  // Save/Load functionality
  const saveCurrentGraph = () => {
    if (nodes.length === 0) return;

    const graphData = {
      id: Date.now(),
      name: initialPromptText || 'Untitled Graph',
      timestamp: new Date().toISOString(),
      nodes,
      connections,
      currentNodeId,
      currentRootPromptNodeId,
      nodeIdOffset,
      generationBatch
    };

    const updated = [...savedGraphs, graphData];
    setSavedGraphs(updated);
    localStorage.setItem('graphible', JSON.stringify(updated));
  };

  const loadGraph = (graphData) => {
    setNodes(graphData.nodes);
    setConnections(graphData.connections);
    setCurrentNodeId(graphData.currentNodeId);
    setCurrentRootPromptNodeId(graphData.currentRootPromptNodeId);
    setNodeIdOffset(graphData.nodeIdOffset);
    setGenerationBatch(graphData.generationBatch);
    setInitialPromptText(graphData.name);
    setShowPromptCenter(false);
    setShowSaveLoad(false);

    // Reset camera
    setCameraImmediate(0, 0, 1.0);
  };

  const deleteGraph = (id) => {
    const updated = savedGraphs.filter(g => g.id !== id);
    setSavedGraphs(updated);
    localStorage.setItem('graphible', JSON.stringify(updated));
  };

  // Node structure definition
  const createNode = (id, label, type, description, content, worldX, worldY, batchId, parentNodeId, nodeDepth, context = '') => ({
    id: Number(id),
    label: label || `Node ${id}`,
    type: type || 'concept',
    description: description || '',
    content: content || '',
    context: context,
    worldX: worldX || 0,
    worldY: worldY || 0,
    batchId: batchId,
    parentNodeId: parentNodeId,
    depth: nodeDepth
  });

  const worldToScreen = (worldX, worldY) => ({
    x: worldX + VIEWPORT_CENTER.x,
    y: worldY + VIEWPORT_CENTER.y
  });

  const calculateNodePosition = (nodeIndex, parentNodeId, depth) => {
    const parentWorldX = WORLD_CENTER.x + depth * NODE_SPACING.x;
    const parentWorldY = WORLD_CENTER.y + depth * NODE_SPACING.y;
    const yOffset = -NODE_SPACING.y * nodeIndex;
    const xOffset = nodeIndex > parentNodeId + 1 ? NODE_SPACING.x * (2 * (nodeIndex % 2) - 1) : 0;
    return { worldX: parentWorldX + xOffset, worldY: parentWorldY + yOffset };
  };

  // Animate camera to a target node
  const focusOnNode = (nodeId) => {
    if (nodeId >= nodes.length) return;
    const node = nodes.at(nodeId);
    if (!node) return;
    setCameraTarget(node.worldX, node.worldY);
  };

  // Simplified generation status timer.
  useEffect(() => {
    let interval;
    if (generationStatus.isGenerating && generationStatus.startTime) {
      interval = setInterval(() => {
        setGenerationStatus(prev => ({
          ...prev,
          elapsedTime: Date.now() - prev.startTime
        }));
      }, 1000); // Reduced frequency to 1 second
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [generationStatus.isGenerating, generationStatus.startTime]);

  // Enhanced JSON extraction with streaming support
  const extractJsonFromLlmResponse = (responseString) => {
    const jsonRegex = /```json([\s\S]*?)```/;
    const match = responseString.match(jsonRegex);

    if (match && match[1]) {
      try {
        const jsonData = JSON.parse(match[1]);
        const remainderString = responseString.replace(match[0], '');
        return [jsonData, remainderString];
      } catch (e) {
        return [null, responseString];
      }
    }

    const firstBraceIndex = responseString.indexOf('{');
    const lastBraceIndex = responseString.lastIndexOf('}');

    if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
      try {
        const jsonString = responseString.substring(firstBraceIndex, lastBraceIndex + 1);
        const jsonData = JSON.parse(jsonString);
        const remainderString = responseString.substring(lastBraceIndex + 1);
        return [jsonData, remainderString];
      } catch (e) {
        return [null, responseString];
      }
    }

    return [null, responseString];
  };

  const testLLMConnection = async () => {
    setLlmConnected('pending');
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        setLlmConnected('connected');
        return true;
      }
    } catch (error) {
      console.error('LLM not connected. Please ensure your local server is running and accessible.', error);
    }
    setLlmConnected('disconnected');
    return false;
  };

  function countCharacter(str, char) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === char) {
        count++;
      }
    }
    return count;
  }

  const navigateToNode = (nodeId) => {
    if (nodeId >= nodes.length) return;
    const node = nodes.at(nodeId);
    if (!node) return;

    setCurrentNodeId(nodeId);
    setNodeDetails(node);

    setCameraTarget(-node.worldX, -node.worldY);
  };

  const navigateToNextNode = () => {
    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (!currentNode) return;

    let targetNode = null;
    let minDistance = Infinity;

    nodes.forEach(node => {
      if (node.id === currentNodeId) return;

      const dx = node.worldX - currentNode.worldX;
      const dy = node.worldY - currentNode.worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let isInDirection = false;
      if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) {
        isInDirection = dy < -50;
      } else if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) {
        isInDirection = dy > 50;
      } else if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) {
        isInDirection = dx < -50;
      } else if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) {
        isInDirection = dx > 50;
      }

      if (isInDirection && distance < minDistance) {
        minDistance = distance;
        targetNode = node;
      }
    });

    if (targetNode) {
      navigateToNode(targetNode.id);
      keysPressed.current.clear();
    }
  };

  const generateWithLLM = async (prompt) => {
    console.log('Starting generation with prompt:', prompt);

    // Reset states and prepare for generation
    const currentBatch = generationBatch;
    setGenerationBatch(prev => prev + 1);

    setGenerationStatus({
      isGenerating: true,
      currentNodeId: null,
      tokensGenerated: 0,
      startTime: Date.now(),
      elapsedTime: 0
    });

    let newNodes = [];
    let newConnections = [];
    let parentNodeId = currentNodeId;

    try {
      console.log('Making request to LLM...');
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma3:4b',
          prompt: `Generate a structured learning graph that provides a step-by-step response to: ${prompt}. 
          Format your response as a sequence of node definitions. Each node should be an individual, un-nested, json-parseable dictionary.
          Respond with repeated nodes, each formatted with JSON:
          '''json
          {
            "label": "<generate a label to broadly characterize the user prompt>",
            "type": "<label the type of data generate amongst: root|concept|example|detail>",
            "description": "<generate a description of the interaction>",
            "content": "<generate detail content that satisfies some part of the query>",
          }
          '''
          Separate each node with four (4) new lines (\\n).
          
          The first node should represent the user prompt like:
          '''json
          {
            "label": "<generate a label of the user query here>",
            "type": "root",
            "description": "<generate a description of any recent interaction that might be helpful>",
            "content": "<add the user prompt here>",
          }
          '''
          Make it educational and well-structured. Position nodes in a logical flow.
          Your response must be completely JSON parseable so never include excess characters or descriptions beyond your JSON-compatible response.`,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is not a ReadableStream.');
      }

      console.log('Starting to read stream...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rawResponseBuffer = '';
      let leftBracesSeen = 0;
      let rightBracesSeen = 0;
      let newNodeCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream finished');
          setGenerationStatus(prev => ({ ...prev, isGenerating: false }));
          setStreamingContent('');
          setCurrentStreamingNodeId(null);
          setCurrNodeDepth(prev => (prev + 1));
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });

        let decoded_response;
        try {
          decoded_response = JSON.parse(chunkText);
        } catch (e) {
          console.error('Failed to parse chunk as JSON:', e);
          continue;
        }

        const chunk = decoded_response.response;
        if (!chunk) {
          console.log('No response in chunk, continuing...');
          continue;
        }

        setGenerationStatus(prev => ({
          ...prev,
          tokensGenerated: prev.tokensGenerated + chunk.split(' ').length
        }));

        try {
          leftBracesSeen += countCharacter(chunk, '{');
          rightBracesSeen += countCharacter(chunk, '}');
          rawResponseBuffer += chunk;

          setStreamingContent(rawResponseBuffer);

          if (rightBracesSeen !== leftBracesSeen || leftBracesSeen < 1) {
            continue;
          }

          console.log('Attempting to parse complete JSON object...');
          const [parsedData, newRawResponseBuffer] = extractJsonFromLlmResponse(rawResponseBuffer);
          rawResponseBuffer = newRawResponseBuffer;
          leftBracesSeen = countCharacter(newRawResponseBuffer, '{');
          rightBracesSeen = countCharacter(newRawResponseBuffer, '}');

          if (!parsedData) {
            console.log('No parsed data, continuing...');
            continue;
          }

          console.log('Successfully parsed node data:', parsedData);
          rawResponseBuffer = '';
          setStreamingContent('');
          newNodeCount = newNodeCount + 1;

          const uniqueNodeId = nodes.length + newNodes.length;
          console.log(`Unique node id: ${uniqueNodeId}; Node offset: ${nodeIdOffset} newNodeCount ${newNodeCount}; nodes.length ${nodes.length}`);
          const nodeDepth = currNodeDepth;
          const position = calculateNodePosition(uniqueNodeId, parentNodeId, nodeDepth);

          const newNode = createNode(
            uniqueNodeId,
            parsedData.label,
            parsedData.type,
            parsedData.description,
            parsedData.content,
            position.worldX,
            position.worldY,
            currentBatch,
            parentNodeId,
            nodeDepth
          );

          newNodes.push(newNode);

          if (nodes.length > uniqueNodeId + 1) {
            // Connect to previous node in sequence
            const prevNode = nodes.at(uniqueNodeId - 1);
            newConnections.push({
              from: prevNode.id,
              to: newNode.id
            });
          }

          setCurrentNodeId(uniqueNodeId);
          setCurrentStreamingNodeId(uniqueNodeId);
          setGenerationStatus(prev => ({ ...prev, currentNodeId: uniqueNodeId }));

          if (parsedData.type === 'root') {
            setCurrentRootPromptNodeId(uniqueNodeId);
            parentNodeId = uniqueNodeId;
          } else {
            setConnections(prevConnections => [...prevConnections, {
              from: uniqueNodeId - 1,
              to: uniqueNodeId
            }]);
          }

          console.log('Adding new node to state:', newNode);
          setNodes(prevNodes => [...prevNodes, newNode]);

          // Focus on the new node after a short delay
          setTimeout(() => {
            navigateToNode(uniqueNodeId);
          }, 100);
        } catch (e) {
          console.error("Error parsing stream chunk:", e);
        }
      }
    } catch (error) {
      console.error('LLM streaming fetch error:', error);
      setGenerationStatus(prev => ({ ...prev, isGenerating: false, currentNodeId: null }));
      alert(`Failed to generate graph: ${error.message}\n\nPlease check that your LLM server is running at http://localhost:11434`);
    }
  };

  // Analyze feedback with LLM
  const analyzeFeedback = async (nodeId, isPositive, userInput) => {
    if (llmConnected !== 'connected') return [null, null];

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma3:4b',
          prompt: `Analyze this user feedback about a learning interface node:
                  Feedback: "${userInput}"
                  Sentiment: ${isPositive ? 'positive' : 'negative'}
                  
                  Categorize the feedback into one of these categories and extract the key concern:
                  - content: about the information, accuracy, depth, or educational value
                  - visual: about colors, layout, fonts, appearance, or visual design
                  - layout: about positioning, spacing, organization, or structure
                  - interaction: about controls, navigation, responsiveness, or user experience
                  
                  Respond with JSON: {"category": "category_name", "concern": "brief_description", "suggestion": "improvement_suggestion"}`,
          stream: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        try {
          return extractJsonFromLlmResponse(data.response);
        } catch (e) {
          console.error("Failed to parse feedback analysis JSON:", e);
          return [null, null];
        }
      }
    } catch (error) {
      console.log('Feedback analysis error:', error);
    }
    return [null, null];
  };

  useEffect(() => {
    testLLMConnection();
  }, []);

  useEffect(() => {
    if (showPromptCenter || isTypingPrompt || isTypingFeedback) return;

    const handleKeyDown = (e) => {
      keysPressed.current.add(e.key.toLowerCase());
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    // Throttle camera movement to prevent excessive updates
    let lastMoveTime = 0;
    const moveCamera = () => {
      const now = Date.now();
      if (now - lastMoveTime < 50) return; // Throttle to 20fps max
      lastMoveTime = now;

      if (keysPressed.current.size === 0) return;

      if (keysPressed.current.has('shift')) {
        // Free navigation mode
        let deltaX = 0, deltaY = 0;
        const speed = 15 / camera.zoom;

        if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) deltaY += speed;
        if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) deltaY -= speed;
        if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) deltaX += speed;
        if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) deltaX -= speed;

        if (deltaX !== 0 || deltaY !== 0) {
          setCameraImmediate(camera.x + deltaX, camera.y + deltaY);
        }
      } else {
        // Snap navigation between nodes
        if (keysPressed.current.has('w') || keysPressed.current.has('arrowup') ||
          keysPressed.current.has('s') || keysPressed.current.has('arrowdown') ||
          keysPressed.current.has('a') || keysPressed.current.has('arrowleft') ||
          keysPressed.current.has('d') || keysPressed.current.has('arrowright')) {
          navigateToNextNode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const interval = setInterval(moveCamera, 50); // 20fps throttling

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(interval);
    };
  }, [nodes, showPromptCenter, isTypingPrompt, isTypingFeedback, camera, setCameraImmediate]);

  useEffect(() => {
    let dragLastPos = { x: 0, y: 0 };

    const handleMouseDown = (e) => {
      if (e.target.closest('.node-component') || e.target.closest('.minimap-container') || e.target.closest('.details-panel')) return;
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

  const handleWheel = useCallback((e) => {
    if (showPromptCenter || isTypingPrompt || isTypingFeedback) return;
    e.preventDefault();

    const scaleAmount = 0.1;
    const zoomFactor = e.deltaY < 0 ? (1 + scaleAmount) : (1 - scaleAmount);
    const newZoom = Math.max(0.2, Math.min(camera.zoom * zoomFactor, 3.0));

    setCameraImmediate(camera.x, camera.y, newZoom);
  }, [showPromptCenter, isTypingPrompt, isTypingFeedback, camera, setCameraImmediate]);

  useEffect(() => {
    if (showPromptCenter || isTypingPrompt || isTypingFeedback) return;
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel, showPromptCenter, isTypingPrompt, isTypingFeedback]);

  // Node focusing
  useEffect(() => {
    const currentNode = nodes.at(currentNodeId);
    if (currentNode && !showPromptCenter && !isTypingPrompt && !isTypingFeedback) {
      setNodeDetails(currentNode);
    }
  }, [currentNodeId, showPromptCenter, isTypingPrompt, isTypingFeedback, nodes]);

  const handleNodeClick = (node) => {
    setCurrentNodeId(node.id);
    setNodeDetails(node);
    focusOnNode(node.id);
  };

  const handleFeedback = (nodeId, isPositive) => {
    setShowFeedbackModal({ nodeId, isPositive });
    setIsTypingFeedback(true);
  };

  const submitFeedback = async (feedbackText, quickOption = null) => {
    const { nodeId, isPositive } = showFeedbackModal;
    const inputText = quickOption || feedbackText;

    if (!inputText.trim()) {
      setShowFeedbackModal(null);
      setIsTypingFeedback(false);
      return;
    }

    try {
      const [analysis, _] = await analyzeFeedback(nodeId, isPositive, inputText);

      const feedback = {
        nodeId,
        isPositive,
        text: inputText,
        analysis,
        timestamp: Date.now(),
        preferences: { ...preferences }
      };

      setFeedbackHistory(prev => [...prev, feedback]);

      if (analysis && analysis.category) {
        const category = analysis.category;
        const sentiment = isPositive ? 'positive' : 'negative';

        setFeedbackCategories(prev => ({
          ...prev,
          [category]: {
            ...prev[category],
            [sentiment]: [...(prev[category]?.[sentiment] || []), {
              concern: analysis.concern,
              suggestion: analysis.suggestion,
              count: 1
            }]
          }
        }));
      }

      console.log('Feedback submitted:', feedback);

    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setShowFeedbackModal(null);
      setIsTypingFeedback(false);
    }
  };

  // Reset camera function
  const resetCamera = () => {
    setCameraTarget(0, 0, 1.0);
    if (currentRootPromptNodeId >= nodes.length) return;
    const rootNode = nodes.at(currentRootPromptNodeId);
    if (rootNode) {
      setCurrentNodeId(rootNode.id);
      navigateToNode(rootNode.id);
    }
  };

  const handleInitialPromptSubmit = async (prompt) => {
    console.log('handleInitialPromptSubmit called with prompt:', prompt);

    if (!prompt.trim()) {
      console.log('Empty prompt, returning');
      return;
    }

    // Check LLM connection first
    if (llmConnected !== 'connected') {
      console.log('LLM not connected, testing connection...');
      const isConnected = await testLLMConnection();
      if (!isConnected) {
        alert('Cannot connect to LLM server. Please ensure Ollama is running at http://localhost:11434');
        return;
      }
    }

    console.log('Resetting state and starting generation...');

    // Reset all relevant state
    setNodes([]);
    setConnections([]);
    setCurrentId(0);
    setGenerationBatch(0);
    setCurrentNodeId(null);
    setCurrentRootPromptNodeId(null);
    setNodeDetails(null);
    setStreamingContent('');
    setCurrentStreamingNodeId(null);

    // Set initial prompt text and hide prompt center
    setInitialPromptText(prompt);
    setShowPromptCenter(false);

    console.log('Starting LLM generation...');
    await generateWithLLM(prompt);
  };

  const getQuickFeedbackOptions = (isPositive) => {
    const hasHistory = feedbackHistory.length > 2;
    if (!hasHistory) return [];

    if (isPositive) {
      return [
        'Content was helpful and clear',
        'Visual design looks great',
        'Layout and positioning work well',
        'Interaction feels smooth'
      ];
    } else {
      return [
        'Content needs more detail',
        'Colors or design need improvement',
        'Layout is confusing',
        'Navigation is difficult'
      ];
    }
  };

  // Calculate minimap bounds dynamically
  const getMinimapBounds = () => {
    if (nodes.length === 0) return { minX: -400, maxX: 400, minY: -300, maxY: 300 };

    const padding = NODE_SIZE.width;
    const minX = Math.min(...nodes.map(n => n.worldX)) - padding;
    const maxX = Math.max(...nodes.map(n => n.worldX)) + padding;
    const minY = Math.min(...nodes.map(n => n.worldY)) - padding;
    const maxY = Math.max(...nodes.map(n => n.worldY)) + padding;

    return { minX, maxX, minY, maxY };
  };

  // Handle minimap click navigation
  const handleMinimapClick = (e) => {
    if (!minimapExpanded) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const bounds = getMinimapBounds();

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const worldX = bounds.minX + (bounds.maxX - bounds.minX) * x;
    const worldY = bounds.minY + (bounds.maxY - bounds.minY) * y;

    setCameraTarget(-worldX, -worldY);
  };

  // Generation Status Component
  const GenerationStatusBar = () => {
    if (!generationStatus.isGenerating) return null;

    const formatTime = (ms) => {
      const seconds = Math.floor(ms / 1000);
      return `${seconds}s`;
    };

    return (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 bg-blue-900/90 backdrop-blur rounded-lg p-4 border border-blue-500 min-w-[300px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="animate-pulse">
              <Zap size={20} className="text-yellow-400" />
            </div>
            <span className="text-white font-semibold">building nodes.</span>
          </div>

          <div className="flex-1 flex items-center gap-4 text-sm text-blue-200">
            <div className="flex items-center gap-1">
              <Circle size={8} className="fill-green-400 text-green-400 animate-pulse" />
              <span>{generationStatus.tokensGenerated} tokens</span>
            </div>
            <div>⏱️ {formatTime(generationStatus.elapsedTime)}</div>
            {generationStatus.currentNodeId !== null && (
              <div className="text-blue-300">
                Node: {generationStatus.currentNodeId}
              </div>
            )}
          </div>
        </div>

        {streamingContent && (
          <div className="mt-3 p-2 bg-black/30 rounded text-xs text-gray-300 max-h-20 overflow-y-auto">
            <div className="font-mono whitespace-pre-wrap">
              {streamingContent.substring(Math.max(0, streamingContent.length - 200))}...
            </div>
          </div>
        )}
      </div>
    );
  };

  // Enhanced node styling with better visibility
  const getNodeStyle = (node, isCurrent) => {
    if (showPromptCenter) return { opacity: 0, pointerEvents: 'none' };

    const isCurrentScalar = isCurrent ? 1.3 : 1.0;
    const distanceScalar = Math.sqrt(Math.pow(camera.x - node.worldX, 2) + Math.pow((camera.y - node.worldY), 2));
    const opacity = Math.max(Math.min(distanceScalar * isCurrentScalar, 1.0), 0.0);

    return {
      transform: `scale(${isCurrentScalar})`,
      opacity: { opacity },
      transition: 'all 0.3s ease-out',
      zIndex: isCurrent ? 1 : 2,
      pointerEvents: 'auto'
    };
  };

  // Enhanced Node Component
  const NodeComponent = ({ node, isCurrent, onClick, onFeedback }) => {
    const screenPos = worldToScreen(node.worldX, node.worldY);

    const isStreaming = currentStreamingNodeId === node.id;
    const isClickable = !generationStatus.isGenerating || node.id <= (currentStreamingNodeId || -1);

    return (
      <div
        className={`absolute min-w-[160px] rounded-xl shadow-lg border-2 p-4 ${isClickable ? 'cursor-pointer' : 'cursor-wait'} node-component transition-all duration-300`}
        style={{
          left: screenPos.x - NODE_SIZE.width / 2,
          top: screenPos.y - NODE_SIZE.height / 2,
          ...getNodeStyle(node, isCurrent),
          backgroundColor: node.type === 'root' ? '#FCD34D' : (isCurrent ? currentScheme.accent : currentScheme.primary),
          borderColor: node.type === 'root' ? '#F59E0B' : (isCurrent ? '#FBBF24' : currentScheme.secondary),
          color: node.type === 'root' ? '#1F2937' : 'white',
          boxShadow: isCurrent ? '0 0 20px rgba(59, 130, 246, 0.5)' : '0 4px 6px rgba(0, 0, 0, 0.3)'
        }}
        onClick={() => isClickable && onClick(node)}
      >
        {isStreaming && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full animate-ping" />
        )}

        <div className="flex items-center space-x-2 mb-2">
          <Brain size={16} className={node.type === 'root' ? 'text-gray-800' : 'text-white'} />
          <h3 className={`text-sm font-bold ${node.type === 'root' ? 'text-gray-800' : 'text-white'}`}>
            {node.label || `Node ${node.id}`}
          </h3>
          {isStreaming && (
            <Circle className="animate-pulse text-yellow-400" size={10} />
          )}
        </div>

        <p className={`text-xs mb-3 ${node.type === 'root' ? 'text-gray-700' : 'text-white/80'}`}>
          {node.description}
        </p>

        <div className="flex justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFeedback(node.id, true);
            }}
            className="p-1 bg-green-500 rounded hover:bg-green-600 transition-colors"
            title="Positive feedback"
          >
            <ThumbsUp size={12} className="text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFeedback(node.id, false);
            }}
            className="p-1 bg-red-500 rounded hover:bg-red-600 transition-colors"
            title="Negative feedback"
          >
            <ThumbsDown size={12} className="text-white" />
          </button>
        </div>
      </div>
    );
  };

  // Enhanced Connection Component with proper screen coordinates
  const ConnectionComponent = ({ fromNode, toNode }) => {
    if (!fromNode || !toNode) return null;

    const fromScreen = worldToScreen(fromNode.worldX, fromNode.worldY);
    const toScreen = worldToScreen(toNode.worldX, toNode.worldY);

    // Calculate connection points on node edges
    const dx = toScreen.x - fromScreen.x;
    const dy = toScreen.y - fromScreen.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return null;

    const unitX = dx / distance;
    const unitY = dy / distance;

    // Offset from node centers to edges
    const fromX = fromScreen.x + NODE_SIZE.width * 3 / 4;
    // const fromX = fromNode.worldX;
    const fromY = fromScreen.y + NODE_SIZE.height * 1 / 4;
    const toX = toScreen.x + NODE_SIZE.width * 3 / 4;
    const toY = toScreen.y + NODE_SIZE.height * 1 / 4;

    // Create curved path for better visual appeal
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const controlOffset = distance * 0.2;
    const controlX = midX + (-unitY * controlOffset);
    const controlY = midY + (unitX * controlOffset);

    const baseStrokeWidth = 2;
    const path = `M${fromX},${fromY} Q${controlX},${controlY} ${toX},${toY}`;
    const distanceScalar = Math.sqrt(Math.pow(camera.x - midX, 2) + Math.pow((camera.y - midY), 2));
    const opacity = Math.max(Math.min(distanceScalar * camera.zoom, 1.0), 0.0);
    const strokeWidth = Math.max(opacity * baseStrokeWidth, 0.0);
    return (
      <g>
        {/* Connection line */}
        <path
          d={path}
          stroke={currentScheme.accent}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={opacity}
          // className="transition-all duration-300"
          strokeOpacity={opacity}
          markerEnd="url(#arrowhead)"
          style={{
            overflow: 'visible',
            zIndex: 1,
          }}
        />

        {/* Connection points */}
        <circle
          cx={fromX}
          cy={fromY}
          r="3"
          fill={currentScheme.primary}
          stroke="white"
          opacity={opacity}
          strokeWidth="1"
          style={{
            zIndex: 1,
            overflow: 'visible',
          }}
        />
        <circle
          cx={toX}
          cy={toY}
          r="3"
          fill={currentScheme.secondary}
          opacity={opacity}
          stroke="white"
          strokeWidth="1"
          style={{
            zIndex: 1,
            overflow: 'visible',
          }}
        />
      </g>
    );
  };

  // Feedback Modal Component with improved state handling
  const FeedbackModal = () => {
    if (!showFeedbackModal) return null;

    const [feedbackText, setFeedbackText] = useState('');
    const { isPositive } = showFeedbackModal;
    const quickOptions = getQuickFeedbackOptions(isPositive);

    const handleClose = useCallback(() => {
      setShowFeedbackModal(null);
      setIsTypingFeedback(false);
      setFeedbackText('');
    }, []);

    const handleSubmit = useCallback(() => {
      submitFeedback(feedbackText);
      setFeedbackText('');
    }, [feedbackText]);

    const handleQuickSubmit = useCallback((option) => {
      submitFeedback('', option);
      setFeedbackText('');
    }, []);

    // Handle escape key
    useEffect(() => {
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };

      if (showFeedbackModal) {
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
      }
    }, [showFeedbackModal, handleClose]);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">
              {isPositive ? 'What worked well?' : 'What needs improvement?'}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {quickOptions.length > 0 && (
            <div className="mb-4">
              <p className="text-gray-300 text-sm mb-2">Quick options:</p>
              <div className="space-y-2">
                {quickOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickSubmit(option)}
                    className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-white transition-colors"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-2">
              Or describe specifically:
            </label>
            <input
              type="text"
              id="feedback-text"
              value={feedbackText}
              onChange={(e) => {
                setFeedbackText(e.target.value);
              }}
              placeholder={isPositive ? "What did you like?" : "What should be improved?"}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleClose();
                }
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!feedbackText.trim() && quickOptions.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit Feedback
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Save/Load Modal Component with improved close handling
  const SaveLoadModal = () => {
    if (!showSaveLoad) return null;

    const handleClose = useCallback(() => {
      setShowSaveLoad(false);
    }, []);

    const handleSave = useCallback(() => {
      saveCurrentGraph();
      setShowSaveLoad(false);
    }, []);

    const handleLoad = useCallback((graph) => {
      loadGraph(graph);
    }, []);

    const handleDelete = useCallback((id) => {
      deleteGraph(id);
    }, []);

    // Handle escape key
    useEffect(() => {
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };

      if (showSaveLoad) {
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
      }
    }, [showSaveLoad, handleClose]);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">Saved Graphs</h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {nodes.length > 0 && (
            <div className="mb-4">
              <button
                onClick={handleSave}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Save size={16} />
                Save Current Graph
              </button>
            </div>
          )}

          <div className="space-y-2">
            {savedGraphs.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No saved graphs yet</p>
            ) : (
              savedGraphs.map((graph) => (
                <div key={graph.id} className="bg-gray-800 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-semibold text-sm truncate">
                      {graph.name}
                    </h4>
                    <button
                      onClick={() => handleDelete(graph.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs mb-2">
                    {new Date(graph.timestamp).toLocaleDateString()} • {graph.nodes.length} nodes
                  </p>
                  <button
                    onClick={() => handleLoad(graph)}
                    className="w-full px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    Load Graph
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Centered Prompt Component
  const CenteredPrompt = () => {
    const [currentMainPrompt, setCurrentMainPrompt] = useState('I want to understand and play with a transformer architecture in a visual capacity');

    const handleInputChange = (e) => {
      setCurrentMainPrompt(e.target.value);
    };

    if (!showPromptCenter) return null;

    return (
      <div className="fixed inset-0 flex items-center justify-center z-20">
        <div className="text-center max-w-2xl mx-4">
          <div className="mb-8">
            <Brain className="mx-auto mb-4 text-blue-400" size={64} />
            <h1 className="text-4xl font-bold text-white mb-2">Wander</h1>
            <p className="text-gray-300">Follow what makes you curious.</p>
          </div>
          <div className="w-full bg-black/80 backdrop-blur rounded-lg p-6 border border-gray-600" style={
            { width: '750px', overflowY: 'hidden', minHeight: '100px', maxHeight: '1000px', boxSizing: 'border-box' }
          }>
            <div className="items-center gap-3 mb-4">
              <textarea
                id="main-prompt"
                value={currentMainPrompt}
                onChange={handleInputChange}
                placeholder="What do you want to explore?"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-lg focus:border-blue-500 focus:outline-none resize-none overflow-hidden"
                onKeyUp={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleInitialPromptSubmit(currentMainPrompt);
                  }
                }}
                autoFocus
              />
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowSaveLoad(true)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                <FolderOpen size={16} />
                Load Saved
              </button>
            </div>

            {llmConnected !== 'connected' && (
              <div className="mt-4 text-xs text-orange-400 bg-orange-900/20 p-3 rounded">
                ⚡ Install Ollama and run "ollama serve" then restart this app
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // New Prompt Box Component with improved close handling
  const NewPromptBox = () => {
    if (!isTypingPrompt || showPromptCenter) return null;

    const handleClose = useCallback(() => {
      setIsTypingPrompt(false);
      setNewPromptInput('');
    }, []);

    const handleSubmit = useCallback(async () => {
      if (!newPromptInput.trim()) return;

      setIsTypingPrompt(false);

      let finalPromptToLLM = newPromptInput;

      if (includeContext) {
        let contextString = `Building on our previous discussion about "${initialPromptText}".`;
        if (currentNodeId && nodeDetails) {
          contextString += ` Currently focused on the node "${nodeDetails.label}" (ID: ${currentNodeId}) which describes "${nodeDetails.description}". Its content is: "${nodeDetails.content}".`;
        }
        contextString += ` Now, based on this context, please generate a new graph for: "${finalPromptToLLM}"`;
        finalPromptToLLM = contextString;
      }

      await generateWithLLM(finalPromptToLLM);
      setNewPromptInput('');
    }, [newPromptInput, includeContext, initialPromptText, currentNodeId, nodeDetails]);

    const handleKeyPress = useCallback((e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    }, [handleSubmit, handleClose]);

    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl mx-4">
        <div className="bg-black/90 backdrop-blur rounded-lg p-4 border border-gray-600 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-lg font-semibold">New Prompt</h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title="Close (ESC)"
            >
              <X size={20} />
            </button>
          </div>
          <input
            type="text"
            value={newPromptInput}
            onChange={(e) => setNewPromptInput(e.target.value)}
            placeholder="Enter your new prompt here..."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 text-lg focus:border-blue-500 focus:outline-none"
            autoFocus
            onKeyDown={handleKeyPress}
          />
          <div className="flex items-center justify-between mt-3">
            <label className="flex items-center text-gray-300 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-600 focus:ring-blue-500 bg-gray-700"
              />
              Include Previous Context
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!newPromptInput.trim() || generationStatus.isGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {generationStatus.isGenerating ?
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> :
                  <Send size={16} />
                }
                {generationStatus.isGenerating ? 'Generating...' : 'Submit'}
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Simplified global typing listener without race conditions
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Only handle if not in prompt center and not currently generating
      if (showPromptCenter || generationStatus.isGenerating) return;

      // Don't handle if already typing or in feedback mode
      if (isTypingPrompt || isTypingFeedback) return;

      // Don't handle if focused on an input element
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Handle single character input to start new prompt
      if (e.key.length === 1 && e.key.match(/^[a-z0-9 ]$/i)) {
        setNewPromptInput(e.key);
        setIsTypingPrompt(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [showPromptCenter, generationStatus.isGenerating, isTypingPrompt, isTypingFeedback]);

  return (
    <div
      className="w-full h-screen relative"
      // className="w-full h-screen relative overflow-hidden"
      style={{ backgroundColor: currentScheme.bg }}
    >
      <GenerationStatusBar />
      <CenteredPrompt />

      {!showPromptCenter && (
        <>
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
                <h1 className="text-xl font-bold text-white">different.ible</h1>
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
            {/* Container with proper transform for nodes and connections */}
            <div
              className="relative w-full h-full overflow-visible"
              style={{
                transform: `scale(${camera.zoom}) translate(${camera.x}px, ${camera.y}px)`,
                transformOrigin: 'center center'
              }}
            >
              {/* SVG for connections with proper transform handling */}
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{
                  overflow: 'visible'
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
                      fill={currentScheme.accent}
                    />
                  </marker>
                </defs>

                {connections.map((conn, index) => (
                  <ConnectionComponent
                    key={index}
                    fromNode={nodes.at(conn.from)}
                    toNode={nodes.at(conn.to)}
                  />
                ))}
              </svg>

              {/* Nodes container with proper transform */}
              {nodes.map(node => (
                <NodeComponent
                  key={node.id}
                  node={node}
                  isCurrent={node.id === currentNodeId}
                  onClick={handleNodeClick}
                  onFeedback={handleFeedback}
                />
              ))}
            </div>
          </div>

          {/* Node Details Panel */}
          {nodeDetails && (
            <div className="absolute top-24 left-4 bg-black/90 backdrop-blur rounded-lg border border-gray-600 p-6 max-w-md z-50 details-panel">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">{nodeDetails.label}</h3>
                <button
                  onClick={() => setNodeDetails(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-gray-300 text-sm mb-2">
                <strong>Type:</strong> {nodeDetails.type}
              </p>
              <p className="text-gray-300 text-sm mb-2">
                <strong>Position:</strong> ({Math.round(nodeDetails.worldX)}, {Math.round(nodeDetails.worldY)})
              </p>
              <p className="text-gray-300 text-sm mb-2">
                <strong>Batch:</strong> {nodeDetails.batchId}
              </p>
              <p className="text-gray-300 text-sm mb-4">{nodeDetails.description}</p>

              <div className="bg-gray-800 p-4 rounded-lg">
                <p className="text-white font-semibold mb-2">Content:</p>
                <div className="text-gray-200 text-sm max-h-40 overflow-y-auto">
                  {nodeDetails.content}
                </div>
              </div>

              {/* Feedback history for this node */}
              {feedbackHistory.filter(f => f.nodeId === nodeDetails.id).length > 0 && (
                <div className="mt-4 bg-gray-800 p-4 rounded-lg">
                  <p className="text-white font-semibold mb-2">Feedback History:</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {feedbackHistory
                      .filter(f => f.nodeId === nodeDetails.id)
                      .slice(-3)
                      .map((feedback, index) => (
                        <div key={index} className="text-xs">
                          <span className={`px-2 py-1 rounded ${feedback.isPositive ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                            {feedback.isPositive ? '👍' : '👎'}
                          </span>
                          <span className="text-gray-300 ml-2">{feedback.text}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Controls HUD */}
          <div className="absolute bottom-4 left-4 bg-black/90 backdrop-blur rounded-lg p-4 text-white">
            <h3 className="font-semibold mb-2">Navigation</h3>
            <div className="text-sm space-y-1">
              <div>Current: {nodes.find(n => n.id === currentNodeId)?.label || 'None'}</div>
              <div>Current by idx: {nodes.at(currentNodeId)?.label || 'None'}</div>
              <div>Nodes: {nodes.length}</div>
              <div>Connections: {connections.length}</div>
              <div>Zoom: {(camera.zoom * 100).toFixed(0)}%</div>
              <div className="text-xs text-gray-400">
                Feedback: {feedbackHistory.length} interactions
              </div>
              <div className="text-xs text-gray-400 border-t border-gray-600 pt-2 mt-2">
                <div>Shift + WASD: Free camera</div>
                <div>WASD: Snap to nodes</div>
                <div>Mouse: Drag & zoom</div>
                <div>Type: New prompt</div>
              </div>
            </div>
          </div>

          {/* Enhanced Minimap with dynamic scaling */}
          {nodes.length > 0 && (
            <div
              className="absolute bottom-4 right-4 bg-black/90 backdrop-blur rounded-lg border border-gray-600 transition-all duration-300 minimap-container"
              style={{
                width: minimapExpanded ? 400 : 200,
                height: minimapExpanded ? 400 : 180,
                zIndex: 100
              }}
            >
              <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 border-b border-gray-600"
                onClick={() => setMinimapExpanded(!minimapExpanded)}
              >
                <span className="text-white text-sm font-semibold">Graph Overview</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{nodes.length} nodes</span>
                  {minimapExpanded ? <Minimize2 size={14} className="text-white" /> : <Maximize2 size={14} className="text-white" />}
                </div>
              </div>

              <div className="relative overflow-hidden" style={{ height: minimapExpanded ? 350 : 130 }}>
                <svg
                  className="w-full h-full cursor-crosshair"
                  viewBox={(() => {
                    const bounds = getMinimapBounds();
                    return `${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`;
                  })()}
                  onClick={handleMinimapClick}
                  onWheel={(e) => {
                    if (!minimapExpanded) return;
                    e.preventDefault();
                    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
                    setMinimapZoom(prev => Math.max(0.5, Math.min(prev * zoomDelta, 2.0)));
                  }}
                >
                  {/* Minimap connections */}
                  {connections.map((conn, index) => {
                    if (conn.from >= nodes.length || conn.to >= nodes.length) return null;
                    const fromNode = nodes.at(conn.from);
                    const toNode = nodes.at(conn.to);
                    if (!fromNode || !toNode) {
                      console.log('Failed in minimap connections. Did not find both nodes.')
                      return null;
                    }

                    return (
                      <line
                        key={index}
                        x1={fromNode.worldX}
                        y1={fromNode.worldY}
                        x2={toNode.worldX}
                        y2={toNode.worldY}
                        stroke={currentScheme.accent}
                        strokeWidth="2"
                        opacity="0.6"
                      />
                    );
                  })}

                  {/* Minimap nodes */}
                  {nodes.map(node => (
                    <g key={node.id}>
                      <circle
                        cx={node.worldX}
                        cy={node.worldY}
                        r={node.id === currentNodeId ? "20" : "12"}
                        fill={node.type === 'root' ? '#FCD34D' : (node.id === currentNodeId ? currentScheme.accent : currentScheme.primary)}
                        stroke={node.type === 'root' ? '#F59E0B' : currentScheme.secondary}
                        strokeWidth="2"
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToNode(node.id);
                        }}
                      />
                      {minimapExpanded && (
                        <text
                          x={node.worldX}
                          y={node.worldY + 4}
                          fontSize="10"
                          fill="white"
                          textAnchor="middle"
                          className="pointer-events-none select-none"
                        >
                          {node.label.slice(0, 6)}
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Viewport indicator */}
                  <rect
                    x={-camera.x - (window.innerWidth / 2) / camera.zoom}
                    y={-camera.y - (window.innerHeight / 2) / camera.zoom}
                    width={window.innerWidth / camera.zoom}
                    height={window.innerHeight / camera.zoom}
                    fill="none"
                    stroke="yellow"
                    strokeWidth="3"
                    opacity="0.8"
                    rx="5"
                  />
                </svg>

                {minimapExpanded && (
                  <div className="absolute bottom-2 left-2 right-2 text-xs text-gray-400 bg-black/50 p-2 rounded">
                    Click to navigate • Scroll to zoom • Yellow box shows current view
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <FeedbackModal />
      <NewPromptBox />
      <SaveLoadModal />
    </div>
  );
};

export default Graphible;
