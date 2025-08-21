// Graph nodes, connections, and LLM generation

import { useState, useEffect } from 'react';
import { LLM_CONFIG } from '../constants/graphConstants';
import { calculateNodePosition } from '../utils/coordinateUtils';
import { extractJsonFromLlmResponse, countCharacter } from '../utils/llmUtils';

export const useGraphState = () => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [currentRootPromptNodeId, setCurrentRootPromptNodeId] = useState(null);
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
    
    // Override with provided coordinates if explicitly set
    if (prevWorldX !== undefined && prevWorldY !== undefined) {
      position.worldX += prevWorldX;
      position.worldY += prevWorldY;
      console.log(position)
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
      depth: nodeDepth
    };
  };

  const addNode = (nodeData) => {
    setNodes(prev => [...prev, nodeData]);
  };

  const updateGenerationStatus = (updates) => {
    setGenerationStatus(prev => ({ ...prev, ...updates }));
  };

  const resetGraph = () => {
    setNodes([]);
    setConnections([]);
    setCurrentNodeId(null);
    setCurrentRootPromptNodeId(null);
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

  const generateWithLLM = async (prompt, prevWorldX = null, prevWorldY = null) => {
    console.log('Starting generation with prompt:', prompt);

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

    try {
      const response = await fetch(`${LLM_CONFIG.BASE_URL}${LLM_CONFIG.GENERATE_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LLM_CONFIG.MODEL,
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
        if (!chunk) continue;

        setGenerationStatus(prev => ({
          ...prev,
          tokensGenerated: prev.tokensGenerated + chunk.split(' ').length
        }));

        leftBracesSeen += countCharacter(chunk, '{');
        rightBracesSeen += countCharacter(chunk, '}');
        rawResponseBuffer += chunk;

        setStreamingContent(rawResponseBuffer);

        if (rightBracesSeen !== leftBracesSeen || leftBracesSeen < 1) {
          continue;
        }

        const [parsedData, newRawResponseBuffer] = extractJsonFromLlmResponse(rawResponseBuffer);
        rawResponseBuffer = newRawResponseBuffer;
        leftBracesSeen = countCharacter(newRawResponseBuffer, '{');
        rightBracesSeen = countCharacter(newRawResponseBuffer, '}');

        if (!parsedData) continue;

        console.log('Successfully parsed node data:', parsedData);
        rawResponseBuffer = '';
        setStreamingContent('');
        
        const uniqueNodeId = nodes.length + newNodeCount;
        const previousNodeId = uniqueNodeId ? uniqueNodeId - 1 : null;
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
        
        newNodeCount = newNodeCount + 1;
        preceedingSiblingNodes.push(newNode);
        setNodes(prevNodes => [...prevNodes, newNode]);
        setCurrentNodeId(uniqueNodeId);
        setCurrentStreamingNodeId(uniqueNodeId);
        setGenerationStatus(prev => ({ ...prev, currentNodeId: uniqueNodeId }));

        if (uniqueNodeId > 0) {
          setCurrentRootPromptNodeId(uniqueNodeId);
          setConnections(prevConnections => [...prevConnections, {
            from: uniqueNodeId - 1,
            to: uniqueNodeId
          }]);
        }
      }
    } catch (error) {
      console.error('LLM streaming fetch error:', error);
      setGenerationStatus(prev => ({ ...prev, isGenerating: false, currentNodeId: null }));
      alert(`Failed to generate graph: ${error.message}\n\nPlease check that your LLM server is running at ${LLM_CONFIG.BASE_URL}`);
    }
  };

  return {
    nodes,
    connections,
    generationStatus,
    streamingContent,
    currentStreamingNodeId,
    addNode,
    updateGenerationStatus,
    resetGraph,
    generateWithLLM,
    setConnections
  };
};