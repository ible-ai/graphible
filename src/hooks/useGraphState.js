// Graph nodes, connections, and LLM generation - FIXED VERSION
import { useState, useEffect, useCallback } from 'react';
import { NODE_SIZE } from '../constants/graphConstants';
import { applyForceDirectedLayout, calculateNodePosition } from '../utils/coordinateUtils';
import { extractJsonFromLlmResponse, validateNodeJson, debugJsonParsing } from '../utils/llmUtils';

export const useGraphState = (generateWithLLM) => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [currNodeDepth, setCurrNodeDepth] = useState(0);
  const [generationBatch, setGenerationBatch] = useState(0);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentStreamingNodeId, setCurrentStreamingNodeId] = useState(null);

  const [generationStatus, setGenerationStatus] = useState({
    isGenerating: false,
    currentNodeId: null,
    tokensGenerated: 0,
    startTime: null,
    elapsedTime: 0
  });

  // Timer for generation status
  useEffect(() => {
    let interval;
    if (generationStatus.isGenerating && generationStatus.startTime) {
      interval = setInterval(() => {
        setGenerationStatus(prev => ({
          ...prev,
          elapsedTime: Date.now() - prev.startTime
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [generationStatus.isGenerating, generationStatus.startTime]);

  const createNode = (id, label, type, description, content, prevWorldX, prevWorldY, batchId, parentNodeId, nodeDepth, context = '', preceedingSiblingNodes = []) => {
    let position;
    position = calculateNodePosition(content, description, preceedingSiblingNodes, nodeDepth);

    if (preceedingSiblingNodes.length === 0 && prevWorldX !== undefined && prevWorldY !== undefined) {
      position.worldX += prevWorldX;
      position.worldY += prevWorldY;
    }

    return {
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
    };
  };

  const addNode = (nodeData) => {
    setNodes(prev => [...prev, nodeData]);
  };

  const resetGraph = () => {
    setNodes([]);
    setConnections([]);
    setCurrentNodeId(null);
    setStreamingContent('');
    setCurrentStreamingNodeId(null);
    setGenerationBatch(0);
    setCurrNodeDepth(0);
    setGenerationStatus({
      isGenerating: false,
      currentNodeId: null,
      tokensGenerated: 0,
      startTime: null,
      elapsedTime: 0
    });
  };

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

  const generateGraphWithLLM = async (prompt, prevWorldX = null, prevWorldY = null, modelConfig) => {
    console.log('generateGraphWithLLM starting with prompt:', prompt);
    console.log('Using model config:', modelConfig);

    const currentBatch = generationBatch;
    setGenerationBatch(prev => prev + 1);

    setGenerationStatus({
      isGenerating: true,
      currentNodeId: null,
      tokensGenerated: 0,
      startTime: Date.now(),
      elapsedTime: 0
    });

    let preceedingSiblingNodes = [];
    let rawResponseBuffer = '';

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
              }
            }
          }

          setGenerationStatus(prev => ({ ...prev, isGenerating: false }));
          setStreamingContent('');
          setCurrentStreamingNodeId(null);
          setCurrNodeDepth(prev => (prev + 1));
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        let chunk = parseStreamResponse(chunkText);

        if (!chunk) continue;

        setGenerationStatus(prev => ({
          ...prev,
          tokensGenerated: prev.tokensGenerated + chunk.split(' ').length
        }));

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
            continue;
          }

          await processNewNode(parsedData, newNodeCount, currentBatch, prevWorldX, prevWorldY, preceedingSiblingNodes);
          newNodeCount++;

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
      }

      setGenerationStatus(prev => ({ ...prev, isGenerating: false, currentNodeId: null }));
      alert(`Failed to generate graph: ${error.message}\n\nPlease check your model configuration and connection.`);
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

  return {
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
  };
};