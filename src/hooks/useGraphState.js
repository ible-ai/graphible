// Complete useGraphState.js - Full Implementation with memory management
// This is a complete replacement for your existing useGraphState.js

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { NODE_SIZE } from '../constants/graphConstants';
import { applyForceDirectedLayout, calculateNodePosition } from '../utils/coordinateUtils';
import { extractJsonFromLlmResponse, validateNodeJson, debugJsonParsing, createFallbackNode } from '../utils/llmUtils';

export const useGraphState = (generateWithLLM) => {
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
    setNodes(prev => {
      // Prevent duplicate nodes
      if (prev.some(node => node.id === nodeData.id)) {
        console.warn(`Attempted to add duplicate node: ${nodeData.id}`);
        return prev;
      }
      return [...prev, nodeData];
    });
  }, []);

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

  const processNewNode = async (parsedData, nodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes) => {
    const uniqueNodeId = nodes.length + nodeCount;
    const previousNodeId = uniqueNodeId > 0 ? uniqueNodeId - 1 : null;
    const nodeDepth = currNodeDepth;

    const newNode = createNode(
      uniqueNodeId,
      parsedData.label,
      parsedData.type,
      parsedData.description,
      parsedData.content,
      prevWorldX,
      prevWorldY,
      currentBatch,
      previousNodeId > 0 ? previousNodeId : null,
      nodeDepth,
      "",
      preceedingSiblingNodes
    );

    preceedingSiblingNodes.push(newNode);
    setNodes(prevNodes => [...prevNodes, newNode]);
    setCurrentNodeId(uniqueNodeId);
    setCurrentStreamingNodeId(uniqueNodeId);
    setGenerationStatus(prev => ({ ...prev, currentNodeId: uniqueNodeId }));

    if (nodeCount > 0) {
      setConnections(prevConnections => [...prevConnections, {
        from: uniqueNodeId - 1,
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

  const generateGraphWithLLM = async (prompt, prevWorldX = null, prevWorldY = null, modelConfig) => {
    console.log('generateGraphWithLLM starting with prompt:', prompt);
    console.log('Using model config:', modelConfig);

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

    try {
      const fullPrompt = `Generate a structured learning graph that provides a step-by-step response to: ${prompt}.
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
Your response must be completely JSON parseable so never include excess characters or descriptions beyond your JSON-compatible response.`;

      // Pass the model config explicitly to generateWithLLM
      const response = await generateWithLLM(fullPrompt, true, modelConfig);

      if (!response.ok) {
        throw new Error(`Generation request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let newNodeCount = 0;
      let lastProcessedLength = 0;

      while (true) {
        // Check for abort signal
        if (abortControllerRef.current?.signal.aborted) {
          console.log('Generation aborted by user');
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream finished');

          // Try to process any remaining content
          if (rawResponseBuffer.length > lastProcessedLength) {
            const remainingContent = rawResponseBuffer.substring(lastProcessedLength);
            const [finalNode, _] = extractJsonFromLlmResponse(remainingContent);
            if (finalNode) {
              const validation = validateNodeJson(finalNode);
              if (validation.valid) {
                await processNewNode(finalNode, newNodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes);
                newNodeCount++;
              } else {
                console.warn('Invalid final node JSON:', validation.error);
                // Create fallback node from remaining content
                const fallbackNode = createFallbackNode(remainingContent, nodes.length + newNodeCount);
                await processNewNode(fallbackNode, newNodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes);
                newNodeCount++;
                fallbackNodeCount++;
              }
            } else if (remainingContent.trim().length > 20) {
              // Create fallback node if we have substantial remaining content
              const fallbackNode = createFallbackNode(remainingContent, nodes.length + newNodeCount);
              await processNewNode(fallbackNode, newNodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes);
              newNodeCount++;
              fallbackNodeCount++;
            }
          }

          updateGenerationStatus({ isGenerating: false });
          setStreamingContent('');
          setCurrentStreamingNodeId(null);
          setCurrNodeDepth(prev => (prev + 1));

          // Log generation summary
          console.log(`Generation complete: ${newNodeCount} nodes created${fallbackNodeCount > 0 ? ` (${fallbackNodeCount} fallback nodes)` : ''}`);
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        const chunkTokens = chunkText.length;
        updateGenerationStatus({
          tokensGenerated: generationStateRef.current.tokensGenerated + chunkTokens
        });

        let chunk = parseStreamResponse(chunkText);

        if (!chunk) continue;


        rawResponseBuffer += chunk;
        setStreamingContent(rawResponseBuffer);

        // Try to extract JSON from the accumulated buffer
        const [parsedData, newRawResponseBuffer] = extractJsonFromLlmResponse(rawResponseBuffer);

        if (parsedData) {
          console.log('Successfully parsed node data:', parsedData);

          // Validate the parsed node
          const validation = validateNodeJson(parsedData);
          if (!validation.valid) {
            console.warn('Invalid node JSON:', validation.error, parsedData);
            // Try to create a fallback node
            const fallbackNode = createFallbackNode(JSON.stringify(parsedData), nodes.length + newNodeCount);
            await processNewNode(fallbackNode, newNodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes);
            newNodeCount++;
            fallbackNodeCount++;
          } else {
            await processNewNode(parsedData, newNodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes);
            newNodeCount++;
          }

          // Update buffer and tracking
          rawResponseBuffer = newRawResponseBuffer;
          lastProcessedLength = 0;
          setStreamingContent('');
        }
      }
    } catch (error) {
      console.error('LLM streaming fetch error:', error);

      if (rawResponseBuffer) {
        console.error('Raw response buffer at error:', rawResponseBuffer.substring(0, 500));
        debugJsonParsing(rawResponseBuffer);

        // Try to create at least one fallback node from the failed response
        if (rawResponseBuffer.trim().length > 20) {
          const fallbackNode = createFallbackNode(rawResponseBuffer, nodes.length);
          await processNewNode(fallbackNode, 0, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes);
        }
      }

      updateGenerationStatus({ isGenerating: false, currentNodeId: null });

      // More user-friendly error message
      const errorMessage = error.name === 'AbortError' ?
        'Generation was cancelled.' :
        `Failed to generate graph: ${error.message}\n\nPlease check your model configuration and connection.`;

      if (error.name !== 'AbortError') {
        alert(errorMessage);
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
    nodeMap, // Expose the optimized node lookup

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