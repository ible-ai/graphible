// Program graph state

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { NODE_SIZE, RESPONSE_MODES } from '../constants/graphConstants';
import { applyForceDirectedLayout, calculateNodePosition } from '../utils/coordinateUtils';
import { extractJsonFromLlmResponse, createFallbackNode, extractMultipleJsonFromResponse, resetStreamingParser, deriveHeadingFromText, deriveSummaryFromText } from '../utils/llmUtils';
import { hasAssembledContext } from '../utils/contextUtils';

export const useGraphState = (generateWithLLM, onError = null) => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [currNodeDepth, setCurrNodeDepth] = useState(0);
  const [generationBatch, setGenerationBatch] = useState(0);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentStreamingNodeId, setCurrentStreamingNodeId] = useState(null);

  // Memory optimization: Use refs for values that don't need to trigger re-renders
  const generationStateRef = useRef({
    isGenerating: false,
    currentNodeId: null,
    tokensGenerated: 0,
    startTime: null,
    elapsedTime: 0
  });

  const [generationStatus, setGenerationStatus] = useState(generationStateRef.current);

  // Cleanup intervals on unmount
  const intervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Ids must never be reused. They were derived from the array length, so
  // deleting two nodes and generating three could mint an id that already
  // existed - silent corruption, since edges, selection, the deletion store and
  // saved graphs all key on id. A counter only ever moves forward.
  const nextNodeIdRef = useRef(0);
  // The last node created within the current batch, for chaining.
  const precedingNodeIdRef = useRef(null);

  const claimNodeId = useCallback(() => {
    const id = nextNodeIdRef.current;
    nextNodeIdRef.current += 1;
    return id;
  }, []);

  // Loading a graph adopts ids that were assigned elsewhere, so the counter has
  // to clear the highest of them.
  const reserveNodeId = useCallback((id) => {
    if (Number.isFinite(id) && id >= nextNodeIdRef.current) {
      nextNodeIdRef.current = id + 1;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Timer for generation status with cleanup
  useEffect(() => {
    if (generationStatus.isGenerating && generationStatus.startTime) {
      intervalRef.current = setInterval(() => {
        const newElapsedTime = Date.now() - generationStatus.startTime;

        setGenerationStatus(prev => {
          const updated = { ...prev, elapsedTime: newElapsedTime };
          generationStateRef.current = updated;
          return updated;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [generationStatus.isGenerating, generationStatus.startTime]);

  // Memoized node lookup for better performance
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(node => map.set(node.id, node));
    return map;
  }, [nodes]);

  // Optimized node creation with memory pooling considerations
  const createNode = useCallback((id, label, type, description, content, prevWorldX, prevWorldY, batchId, parentNodeId, nodeDepth, context = '', preceedingSiblingNodes = []) => {
    let position = calculateNodePosition(content, description, preceedingSiblingNodes, nodeDepth);

    if (preceedingSiblingNodes.length === 0 && prevWorldX !== undefined && prevWorldY !== undefined) {
      position.worldX += prevWorldX;
      position.worldY += prevWorldY;
    }

    // Return frozen object to prevent accidental mutations
    return Object.freeze({
      id: Number(id),
      label: label || `Node ${id}`,
      type: type || 'concept',
      description: description || '',
      content: content || '',
      context: context,
      worldX: position.worldX,
      worldY: position.worldY,
      batchId: batchId,
      parentNodeId: parentNodeId,
      depth: nodeDepth,
      width: NODE_SIZE.width,
      // Add timestamp for debugging and potential cleanup
      createdAt: Date.now()
    });
  }, []);

  const addNode = useCallback((nodeData) => {
    reserveNodeId(nodeData?.id);
    setNodes(prev => {
      // Prevent duplicate nodes
      if (prev.some(node => node.id === nodeData.id)) {
        console.warn(`Attempted to add duplicate node: ${nodeData.id}`);
        return prev;
      }
      return [...prev, nodeData];
    });
  }, [reserveNodeId]);

  // Enhanced reset with proper cleanup
  const resetGraph = useCallback(() => {
    // Clear any ongoing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Abort any ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Reset all state
    setNodes([]);
    setConnections([]);
    setCurrentNodeId(null);
    setStreamingContent('');
    setCurrentStreamingNodeId(null);
    setGenerationBatch(0);
    setCurrNodeDepth(0);
    nextNodeIdRef.current = 0;

    const resetStatus = {
      isGenerating: false,
      currentNodeId: null,
      tokensGenerated: 0,
      startTime: null,
      elapsedTime: 0
    };

    generationStateRef.current = resetStatus;
    setGenerationStatus(resetStatus);
  }, []);

  // Optimized connection cleanup
  const cleanupOrphanedConnections = useCallback(() => {
    const nodeIds = new Set(nodes.map(n => n.id));

    setConnections(prev =>
      prev.filter(conn =>
        nodeIds.has(conn.from) && nodeIds.has(conn.to)
      )
    );
  }, [nodes]);

  // Automatic cleanup when nodes change
  useEffect(() => {
    if (nodes.length > 0) {
      cleanupOrphanedConnections();
    }
  }, [nodes, cleanupOrphanedConnections]);

  const parseStreamResponse = (chunk) => {
    try {
      const decoded = JSON.parse(chunk);
      return decoded.response || '';
    } catch (e) {
      console.error('Error parsing stream response:', e);
      return '';
    }
  };

  const processNewNode = async (parsedData, nodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes, sourceNodeId = null) => {
    const uniqueNodeId = claimNodeId();
    const previousNodeId = precedingNodeIdRef.current;
    precedingNodeIdRef.current = uniqueNodeId;
    const nodeDepth = currNodeDepth;

    // Mirror the edge created below, so parentNodeId always names the node
    // this one is actually connected to.
    const parentNodeId = (nodeCount === 0 && sourceNodeId !== null)
      ? sourceNodeId
      : previousNodeId;

    const newNode = createNode(
      uniqueNodeId,
      parsedData.label,
      parsedData.type,
      parsedData.description,
      parsedData.content,
      prevWorldX,
      prevWorldY,
      currentBatch,
      parentNodeId,
      nodeDepth,
      "",
      preceedingSiblingNodes
    );

    preceedingSiblingNodes.push(newNode);
    setNodes(prevNodes => [...prevNodes, newNode]);
    setCurrentNodeId(uniqueNodeId);
    setCurrentStreamingNodeId(uniqueNodeId);
    setGenerationStatus(prev => ({ ...prev, currentNodeId: uniqueNodeId }));

    // Create connections: first node connects to sourceNodeId, subsequent nodes connect to previous
    if (nodeCount === 0 && sourceNodeId !== null) {
      // First node of a new subgraph - connect to the source node
      setConnections(prevConnections => [...prevConnections, {
        from: sourceNodeId,
        to: uniqueNodeId
      }]);
    } else if (nodeCount > 0 && previousNodeId !== null) {
      // Subsequent nodes chain to the previous node created in this batch.
      setConnections(prevConnections => [...prevConnections, {
        from: previousNodeId,
        to: uniqueNodeId
      }]);
    }
  };

  const updateGenerationStatus = useCallback((updates) => {
    setGenerationStatus(prev => {
      const updated = { ...prev, ...updates };
      generationStateRef.current = updated;
      return updated;
    });
  }, []);

  // Replaces a node in place. Nodes are frozen, so single-response streaming
  // swaps the object rather than mutating it.
  const updateNode = useCallback((nodeId, changes) => {
    setNodes(prev => prev.map(n => (n.id === nodeId ? Object.freeze({ ...n, ...changes }) : n)));
  }, []);

  const generateGraphWithLLM = async (
    prompt,
    prevWorldX = null,
    prevWorldY = null,
    modelConfig,
    sourceNodeId = null,
    responseMode = RESPONSE_MODES.GRAPH
  ) => {
    console.log('generateGraphWithLLM starting with prompt:', prompt);
    console.log('Using model config:', modelConfig);

    // Reset the streaming parser for a new generation
    resetStreamingParser();

    // Create new abort controller for this generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const currentBatch = generationBatch;
    setGenerationBatch(prev => prev + 1);

    updateGenerationStatus({
      isGenerating: true,
      currentNodeId: null,
      tokensGenerated: 0,
      startTime: Date.now(),
      elapsedTime: 0
    });

    let preceedingSiblingNodes = [];
    let rawResponseBuffer = '';
    let fallbackNodeCount = 0;
    let newNodeCount = 0;
    let singleNodeId = null;
    precedingNodeIdRef.current = null;

    try {
      // composePrompt in contextUtils writes these markers; that is the other
      // half of this handshake.
      const isContextAware = hasAssembledContext(prompt);
      const singleNode = responseMode === RESPONSE_MODES.SINGLE;

      // Single mode asks for a normal answer and keeps it whole; the graph is
      // then built by branching, not by splitting one reply.
      const fullPrompt = singleNode ?
        `${prompt}

Answer directly and completely in Markdown. Do not split the answer into
separate documents or JSON objects.` :

        isContextAware ?
        // Context-aware prompt - be more explicit about generating NEW content
        `${prompt}

GENERATION INSTRUCTIONS:
Create NEW learning nodes that address the user's request. Each node should be a separate JSON object.

CRITICAL: Do not duplicate or recreate any concepts mentioned in the context above. Generate fresh, original content.

Format each node exactly like this:
{
  "label": "NEW concept title (not mentioned in context)",
  "type": "root|concept|example|detail",
  "description": "One sentence summary of this NEW node's purpose",
  "content": "Detailed educational content for this NEW specific aspect"
}

Requirements:
- Generate 3-5 nodes with completely NEW content
- Use "concept" for main ideas, "example" for illustrations, "detail" for specifics
- Each node should cover ground NOT already covered in the context
- Separate each JSON object with exactly 4 newlines

Generate NEW nodes now:` :

        // Regular prompt for fresh topics
        `Generate a structured learning graph that provides a step-by-step response to: ${prompt}.

Create multiple interconnected learning nodes. Each node should be a separate JSON object.

Format each node exactly like this:
{
  "label": "Brief descriptive title",
  "type": "root|concept|example|detail",
  "description": "One sentence summary of this node's purpose",
  "content": "Detailed educational content for this specific aspect"
}

Requirements:
- First node must have type "root" and contain the main topic
- Use "concept" for main ideas, "example" for illustrations, "detail" for specifics
- Each node should be complete and self-contained
- Separate each JSON object with exactly 4 newlines

Generate 3-6 nodes total. Start now:`;

      // Pass the model config explicitly to generateWithLLM
      const response = await generateWithLLM(fullPrompt, true, modelConfig);

      if (!response.ok) {
        throw new Error(`Generation request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        // Check for abort signal
        if (abortControllerRef.current?.signal.aborted) {
          console.log('Generation aborted by user');
          reader.cancel().catch(() => { });
          updateGenerationStatus({ isGenerating: false, currentNodeId: null });
          setStreamingContent('');
          setCurrentStreamingNodeId(null);
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream finished');

          if (singleNode) {
            // Title and summary can only be derived once the answer is whole.
            if (singleNodeId !== null) {
              updateNode(singleNodeId, {
                label: deriveHeadingFromText(rawResponseBuffer, prompt),
                description: deriveSummaryFromText(rawResponseBuffer),
                content: rawResponseBuffer,
              });
              newNodeCount = 1;
            }

            updateGenerationStatus({ isGenerating: false });
            setStreamingContent('');
            setCurrentStreamingNodeId(null);
            setCurrNodeDepth(prev => (prev + 1));
            console.log(`Generation complete: ${newNodeCount} node (single response)`);
            break;
          }

          // Process any remaining buffered content
          const finalResult = extractMultipleJsonFromResponse(rawResponseBuffer);

          for (const nodeData of finalResult.nodes) {
            await processNewNode(nodeData, newNodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes, sourceNodeId);
            newNodeCount++;
          }

          // A model that ignores the JSON format streams to completion and
          // parses to nothing. Keeping the reply as one node is far better
          // than returning the user to an empty canvas.
          if (newNodeCount === 0 && rawResponseBuffer.trim().length > 0) {
            console.warn('No JSON nodes parsed; keeping the reply as a single node');
            await processNewNode(
              {
                label: deriveHeadingFromText(rawResponseBuffer, prompt),
                type: sourceNodeId === null ? 'root' : 'concept',
                description: deriveSummaryFromText(rawResponseBuffer),
                content: rawResponseBuffer,
              },
              0, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes, sourceNodeId
            );
            newNodeCount++;
            fallbackNodeCount++;
          }

          updateGenerationStatus({ isGenerating: false });
          setStreamingContent('');
          setCurrentStreamingNodeId(null);
          setCurrNodeDepth(prev => (prev + 1));

          console.log(`Generation complete: ${newNodeCount} nodes created${fallbackNodeCount > 0 ? ` (${fallbackNodeCount} fallback nodes)` : ''}`);
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        let chunk = parseStreamResponse(chunkText);

        if (!chunk) continue;

        const chunkTokens = chunk.length;
        updateGenerationStatus({
          tokensGenerated: generationStateRef.current.tokensGenerated + chunkTokens
        });

        rawResponseBuffer += chunk;
        setStreamingContent(rawResponseBuffer);

        if (singleNode) {
          // Create the node on the first real content, then grow it in place so
          // the answer streams into the graph as it arrives.
          if (singleNodeId === null) {
            singleNodeId = nextNodeIdRef.current;
            await processNewNode(
              {
                label: deriveHeadingFromText('', prompt),
                type: sourceNodeId === null ? 'root' : 'concept',
                description: '',
                content: rawResponseBuffer,
              },
              0, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes, sourceNodeId
            );
          } else {
            updateNode(singleNodeId, { content: rawResponseBuffer });
          }
          continue;
        }

        // Use streaming parser to extract JSON
        const [parsedData, newRawResponseBuffer] = extractJsonFromLlmResponse(rawResponseBuffer);

        if (parsedData) {
          console.log('Successfully parsed node data:', parsedData);

          await processNewNode(parsedData, newNodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes, sourceNodeId);
          newNodeCount++;

          // Update buffer - the parser already removed the extracted content
          rawResponseBuffer = newRawResponseBuffer;
          setStreamingContent('');
        }
      }
    } catch (error) {
      console.error('LLM streaming fetch error:', error);

      if (rawResponseBuffer) {
        console.error('Raw response buffer at error:', rawResponseBuffer.substring(0, 500));

        // Try to extract any partial content using the enhanced parser
        const finalResult = extractMultipleJsonFromResponse(rawResponseBuffer);

        if (finalResult.nodes.length > 0) {
          for (const nodeData of finalResult.nodes) {
            await processNewNode(nodeData, newNodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes, sourceNodeId);
            newNodeCount++;
          }
        } else if (rawResponseBuffer.trim().length > 20) {
          // Create fallback node from the failed response
          const fallbackNode = createFallbackNode(rawResponseBuffer, nodes.length);
          await processNewNode(fallbackNode, 0, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes, sourceNodeId);
          fallbackNodeCount++;
        }
      }

      updateGenerationStatus({ isGenerating: false, currentNodeId: null });

      // Reported in-app rather than through window.alert, which froze the page
      // and threw away the reason.
      if (error.name !== 'AbortError') {
        onError?.({
          title: 'Generation failed',
          detail: error.message,
          hint: 'Check the model in the menu at the top left, or try again.',
        });
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const applyLayoutOptimization = useCallback(() => {
    if (nodes.length > 1) {
      const optimizedNodes = applyForceDirectedLayout(nodes, connections, {
        linkDistance: 250,
        nodeStrength: -600,
        iterations: 200
      });
      setNodes(optimizedNodes);
    }
  }, [nodes, connections]);

  // Method to cancel ongoing generation
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Method to get node by ID efficiently
  const getNodeById = useCallback((nodeId) => {
    return nodeMap.get(nodeId) || null;
  }, [nodeMap]);

  // Method to get connected nodes
  const getConnectedNodes = useCallback((nodeId) => {
    const connectedIds = new Set();
    connections.forEach(conn => {
      if (conn.from === nodeId) connectedIds.add(conn.to);
      if (conn.to === nodeId) connectedIds.add(conn.from);
    });

    return Array.from(connectedIds).map(id => nodeMap.get(id)).filter(Boolean);
  }, [connections, nodeMap]);

  return {
    // State
    nodes,
    connections,
    generationStatus,
    streamingContent,
    currentNodeId,
    currentStreamingNodeId,
    nodeMap,

    // State setters
    setCurrentNodeId,
    setConnections,
    setNodes,

    // Node operations
    addNode,
    createNode,
    getNodeById,
    getConnectedNodes,

    // Graph operations
    resetGraph,
    generateWithLLM: generateGraphWithLLM,
    applyLayoutOptimization,
    cancelGeneration,

    // Cleanup
    cleanupOrphanedConnections
  };
};