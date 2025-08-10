import extractJsonFromLlmResponse from "./llmJson.jsx";

const detectDiagramRequest = async (content) => {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:4b',
        prompt: `Analyze this text to determine if it's describing something that would benefit from a visual diagram, chart, or illustration:

        "${content}"

        Consider if this describes:
        - Processes, workflows, or sequences
        - Relationships between concepts
        - Structures, hierarchies, or organizations
        - Spatial arrangements or layouts
        - Data that could be visualized
        - Abstract concepts that benefit from visual representation
        - Anything that mentions visualization explicitly

        Respond with JSON ONLY:
        {
          "needsDiagram": true/false,
          "diagramType": "flowchart|network|hierarchy|timeline|structure|chart|map|other",
          "visualDescription": "what should be shown visually",
          "complexity": "simple|medium|complex"
        }`,
        stream: false
      })
    });

    if (response.ok) {
      const data = await response.json();
      const [analysis] = extractJsonFromLlmResponse(data.response);
      return analysis;
    }
  } catch (error) {
    console.log('Diagram detection failed:', error);
  }
  return { needsDiagram: false };
};

const generateDiagramPrompt = async (content, diagramAnalysis) => {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:4b',
        prompt: `You need to create a detailed prompt for generating an SVG diagram. 

        Original content: "${content}"
        Diagram type: ${diagramAnalysis.diagramType}
        What to visualize: ${diagramAnalysis.visualDescription}
        Complexity: ${diagramAnalysis.complexity}

        Create a comprehensive prompt that will guide SVG generation for this specific concept. The prompt should:
        1. Specify exact visual elements needed
        2. Describe layout and positioning
        3. Define colors, shapes, and styling appropriate for the concept
        4. Include text labels and annotations
        5. Specify connections, arrows, or relationships
        6. Account for the subject matter's unique requirements

        Respond with JSON ONLY:
        {
          "svgPrompt": "detailed prompt for SVG generation",
          "suggestedDimensions": "WIDTHxHEIGHT",
          "styleNotes": "color and styling guidance"
        }`,
        stream: false
      })
    });

    if (response.ok) {
      const data = await response.json();
      const [promptData] = extractJsonFromLlmResponse(data.response);
      return promptData;
    }
  } catch (error) {
    console.log('Prompt generation failed:', error);
  }
  return null;
};

const generateAdaptiveDiagram = async (promptData, nodeId) => {
  if (!promptData) return null;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:4b',
        prompt: `${promptData.svgPrompt}

        Additional requirements:
        - Output ONLY valid SVG code, no explanations
        - Use viewBox="0 0 ${promptData.suggestedDimensions?.split('x')[0] || '400'} ${promptData.suggestedDimensions?.split('x')[1] || '300'}"
        - Style for dark backgrounds (light text, good contrast)
        - Include proper xmlns="http://www.w3.org/2000/svg"
        - Make text readable and elements clearly distinguished
        - ${promptData.styleNotes || 'Use professional, clean styling'}

        Generate the complete SVG:`,
        stream: false
      })
    });

    if (response.ok) {
      const data = await response.json();
      let svgContent = data.response.trim();
      
      // Extract SVG content more robustly
      if (svgContent.includes('<svg')) {
        const svgStart = svgContent.indexOf('<svg');
        const svgEnd = svgContent.lastIndexOf('</svg>') + 6;
        if (svgStart !== -1 && svgEnd > svgStart) {
          svgContent = svgContent.substring(svgStart, svgEnd);
        }
      }
      
      // Validate basic SVG structure
      if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
        console.error('Invalid SVG generated');
        return null;
      }
      
      // Store the generated diagram with metadata
      setGeneratedDiagrams(prev => new Map(prev.set(nodeId, {
        svg: svgContent,
        originalContent: promptData.svgPrompt,
        diagramType: promptData.diagramType || 'unknown',
        timestamp: Date.now(),
        dimensions: promptData.suggestedDimensions
      })));
      
      return svgContent;
    }
  } catch (error) {
    console.error('SVG generation failed:', error);
  }
  return null;
};

const processNodeForDiagrams = async (node) => {
  console.log('Processing node for diagrams:', node.label);
  
  // Step 1: Detect if diagram is needed
  const diagramAnalysis = await detectDiagramRequest(node.content + ' ' + node.description);
  
  if (!diagramAnalysis?.needsDiagram) {
    console.log('No diagram needed for node:', node.label);
    return;
  }

  console.log('Diagram needed:', diagramAnalysis);

  // Step 2: Generate specialized prompt
  const promptData = await generateDiagramPrompt(node.content, diagramAnalysis);
  
  if (!promptData) {
    console.log('Failed to generate diagram prompt');
    return;
  }

  console.log('Generated diagram prompt:', promptData);

  // Step 3: Add to diagram requests queue
  setDiagramRequests(prev => [...prev, {
    nodeId: node.id,
    analysis: diagramAnalysis,
    promptData: promptData,
    status: 'queued',
    timestamp: Date.now()
  }]);

  // Step 4: Generate diagram (can be async)
  setTimeout(async () => {
    console.log('Starting diagram generation for:', node.label);
    const svg = await generateAdaptiveDiagram(promptData, node.id);
    
    if (svg) {
      console.log('Successfully generated diagram for:', node.label);
      // Update request status
      setDiagramRequests(prev => prev.map(req => 
        req.nodeId === node.id 
          ? { ...req, status: 'completed' }
          : req
      ));
    } else {
      console.log('Failed to generate diagram for:', node.label);
      setDiagramRequests(prev => prev.map(req => 
        req.nodeId === node.id 
          ? { ...req, status: 'failed' }
          : req
      ));
    }
  }, 1000);
};

  const nodeComponent = ({ node, isCurrent, onClick, onFeedback }) => {
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

// 5. ENHANCED NODE COMPONENT WITH DIAGRAM INTELLIGENCE
const NodeComponent = ({ node, isCurrent, onClick, onFeedback }) => {
  const [showDiagram, setShowDiagram] = useState(false);
  const [diagramStatus, setDiagramStatus] = useState('unknown');
  
  const diagramRequest = diagramRequests.find(req => req.nodeId === node.id);
  const existingDiagram = generatedDiagrams.get(node.id);
  
  useEffect(() => {
    if (diagramRequest) {
      setDiagramStatus(diagramRequest.status);
    } else if (existingDiagram) {
      setDiagramStatus('completed');
    } else {
      setDiagramStatus('unknown');
    }
  }, [diagramRequest, existingDiagram]);

  const handleDiagramAction = async () => {
    if (existingDiagram) {
      setShowDiagram(!showDiagram);
    } else if (diagramStatus === 'unknown') {
      // Trigger analysis and generation
      await processNodeForDiagrams(node);
    }
  };

  const getDiagramButtonText = () => {
    switch (diagramStatus) {
      case 'queued': return '📊 Analyzing...';
      case 'generating': return '🔄 Creating...';
      case 'completed': return showDiagram ? '📊 Hide Visual' : '📊 Show Visual';
      case 'failed': return '❌ Generation Failed';
      default: return '📊 Create Visual';
    }
  };

  const getDiagramButtonColor = () => {
    switch (diagramStatus) {
      case 'completed': return 'bg-green-600 hover:bg-green-700';
      case 'failed': return 'bg-red-600 hover:bg-red-700';
      case 'queued':
      case 'generating': return 'bg-yellow-600 hover:bg-yellow-700';
      default: return 'bg-purple-600 hover:bg-purple-700';
    }
  };

  // Your existing node rendering code...
  
  return (
    <div className="node-component" /* your existing props */>
      {/* Your existing node content */}
      {nodeComponent(node, isCurrent, onClick, onFeedback)}
      
      {/* Intelligent diagram controls */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDiagramAction();
          }}
          disabled={diagramStatus === 'queued' || diagramStatus === 'generating'}
          className={`px-2 py-1 text-white text-xs rounded transition-colors ${getDiagramButtonColor()}`}
        >
          {getDiagramButtonText()}
        </button>
        
        {diagramRequest && (
          <div className="text-xs text-gray-400">
            {diagramRequest.analysis.diagramType}
          </div>
        )}
      </div>
      
      {/* Adaptive diagram display */}
      {showDiagram && existingDiagram && (
        <div className="mt-3 p-2 bg-gray-800 rounded border">
          <div className="text-xs text-gray-300 mb-2">
            Type: {existingDiagram.diagramType} | Generated: {new Date(existingDiagram.timestamp).toLocaleTimeString()}
          </div>
          <div 
            className="w-full overflow-auto bg-white/5 rounded p-2"
            dangerouslySetInnerHTML={{ __html: existingDiagram.svg }}
          />
          <button
            onClick={() => {
              // Allow regeneration
              setDiagramStatus('unknown');
              processNodeForDiagrams(node);
            }}
            className="mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            🔄 Regenerate
          </button>
        </div>
      )}
      
      {/* Your existing feedback buttons */}
    </div>
  );
};

// 6. EXAMPLE USAGE SCENARIOS
const exampleScenarios = {
  biology: "The mitochondria has an inner and outer membrane, with cristae folding inward to increase surface area for ATP production",
  
  cooking: "To make bread, you mix flour and water, knead the dough, let it rise, shape it, and bake it at 450°F for 30 minutes",
  
  social: "In a typical organization, there's a CEO at the top, followed by VPs, then directors, managers, and individual contributors",
  
  physics: "When light hits a prism, it separates into different wavelengths - red bends least, violet bends most, creating a rainbow spectrum",
  
  programming: "In a REST API, the client sends HTTP requests to specific endpoints, the server processes them, queries the database, and returns JSON responses"
};

// Each of these would trigger different diagram types:
// - Biology: labeled structure diagram
// - Cooking: process flowchart with steps
// - Social: hierarchical org chart
// - Physics: ray diagram showing light paths
// - Programming: system architecture diagram

console.log('Robust diagram system ready for any content type!');

export default NodeComponent;