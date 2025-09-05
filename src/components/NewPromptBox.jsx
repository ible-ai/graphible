// Enhanced prompt input with selected nodes - DIRECT REPLACEMENT for NewPromptBox.jsx
import { useState, useCallback, useEffect } from 'react';
import { X, Send, Link, Sparkles, Eye, EyeOff } from 'lucide-react';
import { buildContextUpToNode, buildContextSummaryString } from '../utils/contextUtils';

const NewPromptBox = ({
  initialPromptText,
  currentNodeId,
  nodeDetails,
  generationStatus,
  onGenerate,
  isTypingPrompt,
  setIsTypingPrompt,
  uiPersonality,
  setUiPersonality,
  adaptivePrompts,
  setAdaptivePrompts,
  nodes,
  connections,
  setConnections,
  selectedNodeIds,
}) => {

  const [newPromptInput, setNewPromptInput] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const [includeSelectedNodes, setIncludeSelectedNodes] = useState(true);
  const [showSelectedPreview, setShowSelectedPreview] = useState(true);
  const [showContextPreview, setShowContextPreview] = useState(true);
  const [contextNodeIds, setContextNodeIds] = useState(new Set());
  const [selectedNodes, setSelectedNodes] = useState([]);

  // Update context highlighting
  useEffect(() => {
    if (includeContext && currentNodeId !== null && nodes.length > 0) {
      const contextNodes = buildContextUpToNode(currentNodeId, nodes, connections);
      const contextIds = contextNodes.map((node) => (node.id));
      setContextNodeIds(new Set(contextIds));
    } else {
      setContextNodeIds(new Set());
    }
  }, [includeContext, currentNodeId, nodes, connections]);

  const styleEffect = useCallback((node) => {
    return contextNodeIds.has(node.id) ? 'bg-blue-500' : 'bg-gray-300';
  }, [contextNodeIds]);

  useCallback(() => {
    setSelectedNodes(nodes.filter(node => selectedNodeIds.has(node.id)));
  }, [nodes, selectedNodeIds, setSelectedNodes]);


  // Global typing listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (isTypingPrompt || generationStatus.isGenerating) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key.length === 1 && e.key.match(/^[a-z0-9 ]$/i)) {
        setIsTypingPrompt(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isTypingPrompt, generationStatus.isGenerating, setIsTypingPrompt]);

  const handleClose = useCallback(() => {
    setIsTypingPrompt(false);
    setNewPromptInput('');
  }, [setIsTypingPrompt]);


  const handleSubmit = useCallback(async () => {
    if (!newPromptInput.trim()) return;

    let finalPrompt = newPromptInput;
    let contextSummary = '';

    // Build context if enabled and we have a current node
    if (includeContext && currentNodeId !== null && nodes.length > 0) {
      // Get context nodes
      const contextNodes = buildContextUpToNode(currentNodeId, nodes, connections);

      // Create a summary of what's already been covered (not full content)
      const topicsCovered = contextNodes.map(node => `"${node.label}"`).join(', ');
      const mainTopics = contextNodes
        .filter(node => node.type === 'root' || node.type === 'concept')
        .map(node => `- ${node.label}: ${node.description}`)
        .join('\n');

      contextSummary = `CONTEXT: We have already covered these topics: ${topicsCovered}

Previous main concepts:
${mainTopics}

IMPORTANT: Do not recreate or duplicate the above topics. Instead, build NEW content that extends or relates to them.`;
    }

    // Handle selected nodes context separately and more carefully
    if (includeSelectedNodes && selectedNodeIds.length > 0) {
      const selectedNodes = nodes.filter(node => selectedNodeIds.has(node.id));
      const selectedTopics = selectedNodes.map(node => `"${node.label}"`).join(', ');
      const selectedSummaries = selectedNodes
        .map(node => `- ${node.label}: ${node.description}`)
        .join('\n');

      const selectedContext = `SELECTED NODES CONTEXT: The user has specifically selected these ${selectedNodes.length} nodes for reference: ${selectedTopics}

Selected concepts summary:
${selectedSummaries}

IMPORTANT: These are provided as BACKGROUND CONTEXT only. Do not recreate these topics. Generate NEW nodes that either:
1. Explore deeper aspects of these topics
2. Show practical applications
3. Connect these concepts to new areas
4. Provide related but distinct concepts`;

      contextSummary = contextSummary ? `${contextSummary}\n\n${selectedContext}` : selectedContext;
    }

    // Create the final prompt with clear separation
    if (contextSummary) {
      finalPrompt = `${contextSummary}

NEW REQUEST: ${newPromptInput}

Generate 3-5 NEW learning nodes that address the user's request while building upon (not duplicating) the context provided above. Each node should cover NEW ground that hasn't been explored yet.`;
    }

    setIsTypingPrompt(false);
    const curNode = nodes.find(n => n.id === currentNodeId);
    await onGenerate(finalPrompt, curNode?.worldX, curNode?.worldY);
    setNewPromptInput('');
  }, [
    newPromptInput,
    includeContext,
    includeSelectedNodes,
    currentNodeId,
    nodes,
    connections,
    selectedNodeIds,
    setIsTypingPrompt,
    onGenerate
  ]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }, [handleSubmit, handleClose]);

  if (!isTypingPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center font-inter z-200">
      <div className="w-full max-w-3xl mx-4">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl flex items-center justify-center">
                <Sparkles className="text-indigo-600" size={16} />
              </div>
              <h3 className="text-slate-800 text-lg font-medium">Continue Exploring</h3>
              {selectedNodeIds.length > 0 && (
                <div className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                  {selectedNodeIds.length} node{selectedNodeIds.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100/50"
              title="Close (ESC)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Context indicators */}
            <div className="space-y-3 mb-4">
              {/* Previous context */}
              {includeContext && nodeDetails && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200/30">
                  <div className="flex items-start gap-3">
                    <Link className="text-indigo-500 mt-0.5" size={16} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-indigo-800">
                        Building from: {nodeDetails.label}
                      </p>
                      <p className="text-xs text-indigo-600 mt-1 line-clamp-2">
                        {nodeDetails.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected nodes context */}
              {includeSelectedNodes && selectedNodeIds.length > 0 && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/30">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="text-blue-500" size={16} />
                      <p className="text-sm font-medium text-blue-800">
                        Including {selectedNodeIds.length} selected node{selectedNodeIds.length !== 1 ? 's' : ''} as context
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSelectedPreview(!showSelectedPreview)}
                      className="text-blue-600 hover:text-blue-700 p-1 rounded"
                      title={showSelectedPreview ? "Hide preview" : "Show preview"}
                    >
                      {showSelectedPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  {showSelectedPreview && (
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {selectedNodes.map((node, index) => (
                        <div key={node.id} className="text-xs bg-white/60 rounded p-2">
                          <div className="font-medium text-blue-800">
                            {index + 1}. {node.label || `Node ${node.id}`}
                          </div>
                          <div className="text-blue-600 mt-1 line-clamp-2">
                            {node.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Context Controls */}
            <div className="mb-4 space-y-3">
              <label className="flex items-center text-slate-600 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                  className="mr-3 rounded border-slate-300"
                />
                <span>Include conversation context up to current node</span>
              </label>

              {includeContext && currentNodeId !== null && (
                <div className="pl-7">
                  <button
                    onClick={() => setShowContextPreview(!showContextPreview)}
                    className="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    {showContextPreview ? 'Hide' : 'Show'} context preview
                  </button>

                  {showContextPreview && (
                    <div className="mt-2 p-3 bg-slate-50 rounded border text-sm">
                      <div className="font-medium mb-1">
                        Context nodes ({contextNodeIds.size} selected):
                      </div>
                      {buildContextUpToNode(currentNodeId, nodes, connections).map((node, i) => (
                        <div key={node.id} className="flex items-center gap-2 text-slate-600 py-1">
                          <div className={`w-2 h-2 rounded-full ${styleEffect(node.id)}`} />
                          <span>{i + 1}. "{node.label}"</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input field */}
            <div className="mb-4">
              <textarea
                value={newPromptInput}
                onChange={(e) => setNewPromptInput(e.target.value)}
                placeholder="What would you like to explore next?"
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200/50 rounded-xl text-slate-800 placeholder-slate-500 text-base focus:border-indigo-300 focus:bg-white/80 focus:outline-none transition-all duration-200 shadow-sm resize-none"
                rows="3"
                autoFocus
                onKeyDown={handleKeyPress}
              />
            </div>

            {/* Options */}
            <div className="flex items-center justify-between mb-6 text-sm">
              <div className="space-y-2">
                <label className="flex items-center text-slate-600 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={includeContext}
                      onChange={(e) => setIncludeContext(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded border-2 transition-all duration-200 ${includeContext
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'border-slate-300 group-hover:border-slate-400'
                      }`}>
                      {includeContext && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="ml-3">Include previous context</span>
                </label>

                {selectedNodeIds.length > 0 && (
                  <label className="flex items-center text-slate-600 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={includeSelectedNodes}
                        onChange={(e) => setIncludeSelectedNodes(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border-2 transition-all duration-200 ${includeSelectedNodes
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-slate-300 group-hover:border-slate-400'
                        }`}>
                        {includeSelectedNodes && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="ml-3">Include selected nodes ({selectedNodeIds.length})</span>
                  </label>
                )}
              </div>

              <div className="text-xs text-slate-500">
                Press Enter to continue • ESC to cancel
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!newPromptInput.trim() || generationStatus.isGenerating}
                className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-200 font-medium shadow-lg"
              >
                {generationStatus.isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Continue Exploring
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 font-medium shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewPromptBox;