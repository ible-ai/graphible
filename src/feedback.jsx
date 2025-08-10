const [uiPersonality, setUiPersonality] = useState({
  colorScheme: 'blue',
  fontFamily: 'system',
  nodeStyle: 'rounded',
  animationStyle: 'smooth',
  layoutPattern: 'hierarchical',
  customCSS: '',
  theme: 'tech'
});

const [adaptivePrompts, setAdaptivePrompts] = useState([]);

// Function to analyze user input for UI adaptation cues
const analyzeForUIAdaptation = async (userInput) => {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:4b',
        prompt: `Analyze this user input for UI/visual style preferences: "${userInput}"

        Look for mentions of:
        - Colors (red, blue, dark, bright, neon, pastel, etc.)
        - Styles (gothic, minimalist, retro, cyberpunk, elegant, playful, etc.)
        - Fonts (serif, sans-serif, monospace, handwritten, bubble letters, etc.)
        - Layout preferences (compact, spacious, grid, organic, etc.)
        - Animation preferences (fast, slow, bouncy, smooth, static, etc.)
        - Visual themes (corporate, creative, academic, gaming, etc.)

        Respond with JSON ONLY:
        {
          "hasUIPreferences": true/false,
          "changes": {
            "colorScheme": "primary_color_name",
            "fontFamily": "font_style",
            "nodeStyle": "visual_style",
            "animationStyle": "animation_type",
            "theme": "overall_theme",
            "customCSS": "any specific CSS rules needed"
          },
          "reasoning": "brief explanation of detected preferences"
        }`,
        stream: false
      })
    });

    if (response.ok) {
      const data = await response.json();
      const [analysis] = extractJsonFromLlmResponse(data.response);
      
      if (analysis && analysis.hasUIPreferences) {
        return analysis;
      }
    }
  } catch (error) {
    console.log('UI adaptation analysis failed:', error);
  }
  return null;
};

// Function to apply UI adaptations
const applyUIAdaptations = async (adaptations) => {
  if (!adaptations || !adaptations.changes) return;

  const newPersonality = { ...uiPersonality };
  
  // Apply color scheme changes
  if (adaptations.changes.colorScheme) {
    const colorMap = {
      'red': 'orange', 'crimson': 'orange', 'blood': 'orange',
      'green': 'green', 'nature': 'green', 'forest': 'green',
      'purple': 'purple', 'violet': 'purple', 'royal': 'purple',
      'blue': 'blue', 'ocean': 'blue', 'sky': 'blue',
      'dark': 'blue', 'black': 'blue',
      'bright': 'orange', 'neon': 'purple'
    };
    
    const detectedColor = adaptations.changes.colorScheme.toLowerCase();
    const mappedColor = colorMap[detectedColor] || 'blue';
    newPersonality.colorScheme = mappedColor;
  }

  // Apply font changes
  if (adaptations.changes.fontFamily) {
    newPersonality.fontFamily = adaptations.changes.fontFamily;
  }

  // Apply custom CSS for special effects
  if (adaptations.changes.customCSS) {
    newPersonality.customCSS = adaptations.changes.customCSS;
  }

  // Store the reasoning for this adaptation
  setAdaptivePrompts(prev => [...prev, {
    userInput: adaptations.reasoning,
    adaptations: adaptations.changes,
    timestamp: Date.now()
  }]);

  setUiPersonality(newPersonality);
  
  console.log('Applied UI adaptations:', adaptations);
};

// Enhanced Node Component with dynamic sizing and adaptive styling
const AdaptiveNodeComponent = ({ node, isCurrent, onClick, onFeedback }) => {
  const screenPos = worldToScreen(node.worldX, node.worldY);
  const isStreaming = currentStreamingNodeId === node.id;
  const isClickable = !generationStatus.isGenerating || node.id <= (currentStreamingNodeId || -1);

  // Calculate dynamic dimensions
  const dimensions = calculateNodeDimensions(node.content, node.type);
  
  // Apply adaptive styling
  const getAdaptiveStyles = () => {
    let styles = {};
    
    // Font family adaptations
    if (uiPersonality.fontFamily.includes('bubble')) {
      styles.fontFamily = '"Comic Sans MS", cursive, sans-serif';
      styles.fontWeight = 'bold';
    } else if (uiPersonality.fontFamily.includes('mono')) {
      styles.fontFamily = '"Courier New", monospace';
    } else if (uiPersonality.fontFamily.includes('serif')) {
      styles.fontFamily = 'Georgia, serif';
    }

    // Theme adaptations
    if (uiPersonality.theme.includes('goth')) {
      styles.backgroundColor = '#1a1a1a';
      styles.color = '#e0e0e0';
      styles.borderColor = '#666';
      styles.boxShadow = '0 0 20px rgba(255, 0, 0, 0.3)';
    }

    return styles;
  };

  return (
    <div
      className={`absolute rounded-xl shadow-lg border-2 p-4 ${isClickable ? 'cursor-pointer' : 'cursor-wait'} node-component transition-all duration-300`}
      style={{
        left: screenPos.x - dimensions.width / 2,
        top: screenPos.y - dimensions.height / 2,
        width: dimensions.width,
        height: dimensions.height,
        minHeight: dimensions.height,
        ...getNodeStyle(node, isCurrent),
        ...getAdaptiveStyles()
      }}
      onClick={() => isClickable && onClick(node)}
    >
      {/* Inject custom CSS if needed */}
      {uiPersonality.customCSS && (
        <style jsx>{uiPersonality.customCSS}</style>
      )}

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

      <div className={`text-xs mb-3 ${node.type === 'root' ? 'text-gray-700' : 'text-white/80'}`}>
        <MarkdownRenderer content={node.description} />
      </div>

      {/* Scrollable content area for long content */}
      <div className="overflow-y-auto max-h-40 mb-3">
        <MarkdownRenderer 
          content={node.content} 
          className={node.type === 'root' ? 'text-gray-700' : 'text-white/90'} 
        />
      </div>

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

// Enhanced prompt handling with UI adaptation
const handleInitialPromptSubmitWithAdaptation = async (prompt) => {
  console.log('Processing prompt with UI adaptation:', prompt);

  // First check for UI adaptations
  const uiAnalysis = await analyzeForUIAdaptation(prompt);
  if (uiAnalysis) {
    await applyUIAdaptations(uiAnalysis);
  }

  // Then proceed with normal graph generation
  await handleInitialPromptSubmit(prompt);
};

// Enhanced feedback submission with UI learning
const submitFeedbackWithLearning = async (feedbackText, quickOption = null) => {
  const inputText = quickOption || feedbackText;
  
  // Check if feedback contains UI preferences
  const uiAnalysis = await analyzeForUIAdaptation(inputText);
  if (uiAnalysis) {
    await applyUIAdaptations(uiAnalysis);
  }

  // Continue with normal feedback processing
  await submitFeedback(feedbackText, quickOption);
};

// Enhanced new prompt handling with adaptation
const handleNewPromptWithAdaptation = async (prompt) => {
  // Check for UI adaptations in new prompts too
  const uiAnalysis = await analyzeForUIAdaptation(prompt);
  if (uiAnalysis) {
    await applyUIAdaptations(uiAnalysis);
  }

  // Continue with normal prompt generation
  return handleSubmit(); // your existing submit logic
};

// Add UI personality display component
const UIPersonalityIndicator = () => (
  <div className="absolute top-4 left-4 bg-black/80 backdrop-blur rounded-lg p-3 text-white text-xs max-w-xs">
    <div className="font-semibold mb-1">Current Style:</div>
    <div>Theme: {uiPersonality.theme}</div>
    <div>Colors: {uiPersonality.colorScheme}</div>
    <div>Font: {uiPersonality.fontFamily}</div>
    {adaptivePrompts.length > 0 && (
      <div className="mt-2 text-gray-300">
        Adaptations: {adaptivePrompts.length}
      </div>
    )}
  </div>
);

