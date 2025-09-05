// Contextual conversation utils

// Builds conversation context up to a specific node, including all predecessor nodes but excluding
// any nodes that come after it in the conversation flow
export const buildContextUpToNode = (targetNodeId, allNodes, connections) => {
    if (!targetNodeId || !allNodes.length) return [];

    const targetNode = allNodes[targetNodeId];
    if (!targetNode || !connections) return [];

    // Build a graph representation for efficient traversal
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const predecessors = new Map(); // nodeId -> Set of predecessor nodeIds
    const successors = new Map(); // nodeId -> Set of successor nodeIds

    // Initialize maps
    allNodes.map(node => {
        predecessors.set(node.id, new Set());
        successors.set(node.id, new Set());
    });

    // Build the graph from connections
    connections.forEach(conn => {
        successors.get(conn.from)?.add(conn.to);
        predecessors.get(conn.to)?.add(conn.from);
    });

    // Find all nodes that should be included in context (ancestors + self)
    const contextNodeIds = new Set();
    const visited = new Set();

    const addAncestors = (nodeId) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        contextNodeIds.add(nodeId);

        // Recursively add all predecessors
        const preds = predecessors.get(nodeId) || new Set();
        preds.forEach(predId => addAncestors(predId));
    };

    // Start from target node and work backwards
    addAncestors(targetNodeId);

    // Convert to sorted array maintaining conversation flow order
    const contextNodes = Array.from(contextNodeIds)
        .map(id => nodeMap.get(id))
        .filter(node => node != null)
        .sort((a, b) => {
            // Sort by batch first, then by ID to maintain temporal order
            if (a.batchId !== b.batchId) return a.batchId - b.batchId;
            return a.id - b.id;
        });

    return contextNodes;
};

// Builds a context string for LLM generation based on selected node and conversation history
export const buildContextString = (targetNodeId, allNodes, connections, options = {}) => {
    const {
        includeFullContent = true,
        maxContextLength = 4000,
        prioritizeRecent = true
    } = options;

    const contextNodes = buildContextUpToNode(targetNodeId, allNodes, connections);

    if (contextNodes.length === 0) return '';

    let contextParts = [];

    // Add conversation history in chronological order
    contextNodes.map((node, index) => {
        const isTargetNode = node.id === targetNodeId;
        const prefix = isTargetNode ? "Current focus" :
            node.type === 'root' ? "Initial topic" :
                `Step ${index + 1}`;

        let nodeContent = '';
        if (includeFullContent) {
            nodeContent = `${prefix}: "${node.label}"\nDescription: ${node.description}`;
            if (node.content && node.content !== node.description) {
                nodeContent += `\nContent: ${node.content}`;
            }
        } else {
            nodeContent = `${prefix}: "${node.label}" - ${node.description}`;
        }

        contextParts.push(nodeContent);
    });

    let fullContext = contextParts.join('\n\n');

    // Truncate if too long, preserving the most important parts
    if (fullContext.length > maxContextLength) {
        if (prioritizeRecent) {
            // Keep the target node and work backwards
            const targetNodeContext = contextParts[contextParts.length - 1];
            let truncatedContext = targetNodeContext;
            let remainingLength = maxContextLength - targetNodeContext.length - 100; // Buffer

            for (let i = contextParts.length - 2; i >= 0 && remainingLength > 0; i--) {
                const part = contextParts[i];
                if (part.length <= remainingLength) {
                    truncatedContext = part + '\n\n' + truncatedContext;
                    remainingLength -= part.length + 2;
                } else {
                    // Add truncated version of this part
                    const truncatedPart = part.substring(0, remainingLength - 20) + '...';
                    truncatedContext = truncatedPart + '\n\n' + truncatedContext;
                    break;
                }
            }

            fullContext = truncatedContext;
        } else {
            fullContext = fullContext.substring(0, maxContextLength - 20) + '...';
        }
    }

    return fullContext;
};

// Builds a summary-focused context string that emphasizes what's been covered
// rather than providing full content that might be duplicated
export const buildContextSummaryString = (targetNodeId, allNodes, connections, options = {}) => {
    const {
        maxContextLength = 2000, // Shorter for summaries
    } = options;

    const contextNodes = buildContextUpToNode(targetNodeId, allNodes, connections);

    if (contextNodes.length === 0) return '';

    // Group nodes by type for better organization
    const nodesByType = {
        root: contextNodes.filter(n => n.type === 'root'),
        concept: contextNodes.filter(n => n.type === 'concept'),
        example: contextNodes.filter(n => n.type === 'example'),
        detail: contextNodes.filter(n => n.type === 'detail')
    };

    let contextParts = [];

    // Add root topics (main subjects covered)
    if (nodesByType.root.length > 0) {
        const rootTopics = nodesByType.root.map(node =>
            `"${node.label}" - ${node.description}`
        ).join(', ');
        contextParts.push(`Main Topics Covered: ${rootTopics}`);
    }

    // Add concept summaries (what has been explained)
    if (nodesByType.concept.length > 0) {
        const concepts = nodesByType.concept.map(node =>
            `• ${node.label}: ${node.description}`
        ).join('\n');
        contextParts.push(`Concepts Explained:\n${concepts}`);
    }

    // Add examples and details as brief lists
    if (nodesByType.example.length > 0) {
        const examples = nodesByType.example.map(node => node.label).join(', ');
        contextParts.push(`Examples Provided: ${examples}`);
    }

    if (nodesByType.detail.length > 0) {
        const details = nodesByType.detail.map(node => node.label).join(', ');
        contextParts.push(`Details Covered: ${details}`);
    }

    let fullContext = contextParts.join('\n\n');

    // Truncate if too long
    if (fullContext.length > maxContextLength) {
        fullContext = fullContext.substring(0, maxContextLength - 20) + '...';
    }

    return fullContext;
};

// Enhanced function for selected nodes context
export const buildSelectedNodesContext = (selectedNodeIds, allNodes, options = {}) => {
    const {
        maxLength = 1500,
        focusOnRelationships = true
    } = options;

    if (!selectedNodeIds || selectedNodeIds.size === 0) return '';

    const selectedNodes = allNodes.filter(node => selectedNodeIds.has(node.id));

    if (selectedNodes.length === 0) return '';

    // Create a concise summary of selected nodes
    const summaries = selectedNodes.map(node => {
        const typeEmoji = {
            root: '🎯',
            concept: '💡',
            example: '📝',
            detail: '🔍'
        };

        return `${typeEmoji[node.type] || '•'} ${node.label}: ${node.description}`;
    }).join('\n');

    // Look for common themes or relationships
    let relationshipHint = '';
    if (focusOnRelationships && selectedNodes.length > 1) {
        const labels = selectedNodes.map(n => n.label.toLowerCase());

        // Simple keyword analysis to suggest relationships
        const commonWords = findCommonWords(labels);
        if (commonWords.length > 0) {
            relationshipHint = `\nThese nodes appear to be related through: ${commonWords.join(', ')}`;
        }
    }

    const context = `Selected Nodes (${selectedNodes.length}):\n${summaries}${relationshipHint}`;

    return context.length > maxLength ?
        context.substring(0, maxLength - 20) + '...' :
        context;
};

// Helper function to find common words in labels
function findCommonWords(labels) {
    const words = labels.flatMap(label =>
        label.split(/\s+/)
            .filter(word => word.length > 3)
            .map(word => word.toLowerCase())
    );

    const wordCounts = {};
    words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    return Object.entries(wordCounts)
        .filter(([word, count]) => word && count > 1)
        .map(([word]) => word)
        .slice(0, 3); // Return top 3 common words
};

// Nothing after this point is currently implemented. TODO: get the following implemented.

// const getTargetNode = (targetNodeId, allNodes) => {
//     let targetNode = null;
//     allNodes.ForEach(n => {
//         if (n.id === targetNodeId) {
//             targetNode = n;
//         }
//     });
//     return targetNode;
// };

// Gets all nodes that come after a target node in the conversation flow.
// Used to identify what should be excluded from context
// const getNodesAfterInConversation = (targetNodeId, allNodes, connections) => {
//     const targetNode = getTargetNode(targetNodeId, allNodes);
//     if (!targetNode || !connections) return [];

//     // Build successor map
//     const successors = new Map();
//     allNodes.forEach(node => successors.set(node.id, new Set()));

//     connections.forEach(conn => {
//         successors.get(conn.from)?.add(conn.to);
//     });

//     // Find all descendants of the target node
//     const descendantIds = new Set();
//     const visited = new Set();

//     const addDescendants = (nodeId) => {
//         if (visited.has(nodeId)) return;
//         visited.add(nodeId);

//         const children = successors.get(nodeId) || new Set();
//         children.map(childId => {
//             descendantIds.add(childId);
//             addDescendants(childId);
//         });
//     };

//     addDescendants(targetNodeId);

//     return Array.from(descendantIds)
//         .map(id => allNodes.find(n => n.id === id))
//         .filter(node => node != null);
// };

// // Analyzes the conversation flow to provide insights about the current context
// const analyzeConversationFlow = (targetNodeId, allNodes, connections) => {
//     const contextNodes = buildContextUpToNode(targetNodeId, allNodes, connections);
//     const excludedNodes = getNodesAfterInConversation(targetNodeId, allNodes, connections);
//     const targetNode = allNodes.find(n => n.id === targetNodeId);

//     if (!targetNode) return null;

//     // Calculate conversation depth and branching
//     const batchCounts = new Map();
//     contextNodes.map(node => {
//         const count = batchCounts.get(node.batchId) || 0;
//         batchCounts.set(node.batchId, count + 1);
//     });

//     // Find conversation branches
//     const branches = Array.from(batchCounts.entries())
//         .map(([batchId, count]) => ({ batchId, count }))
//         .sort((a, b) => a.batchId - b.batchId);

//     return {
//         targetNode,
//         contextNodes,
//         excludedNodes,
//         branches,
//         stats: {
//             totalNodesInContext: contextNodes.length,
//             totalNodesExcluded: excludedNodes.length,
//             conversationDepth: branches.length,
//             targetNodePosition: contextNodes.findIndex(n => n.id === targetNodeId) + 1,
//             isAtConversationEnd: excludedNodes.length === 0,
//             estimatedContextLength: buildContextString(targetNodeId, allNodes, connections, { includeFullContent: false }).length
//         }
//     };
// };

// // Validates that a node selection is appropriate for context continuation
// const validateContextSelection = (targetNodeId, allNodes, connections) => {
//     const analysis = analyzeConversationFlow(targetNodeId, allNodes, connections);
//     if (!analysis) return { valid: false, reason: 'Node not found' };

//     const { stats, excludedNodes } = analysis;

//     // Check if this is a reasonable branching point
//     if (stats.totalNodesInContext === 0) {
//         return { valid: false, reason: 'No context available from this node' };
//     }

//     if (stats.estimatedContextLength > 8000) {
//         return {
//             valid: true,
//             reason: 'Context is very long - consider selecting a more recent node',
//             warning: true
//         };
//     }

//     return {
//         valid: true,
//         reason: `Will include ${stats.totalNodesInContext} node(s) as context${excludedNodes.length > 0 ? ` and exclude ${excludedNodes.length} node(s)` : ''}`,
//         info: {
//             contextNodes: stats.totalNodesInContext,
//             excludedNodes: excludedNodes.length,
//             estimatedContextLength: stats.estimatedContextLength
//         }
//     };
// };

// // Generates a user-friendly description of what will be included in the context
// const describeContextSelection = (targetNodeId, allNodes, connections) => {
//     const validation = validateContextSelection(targetNodeId, allNodes, connections);
//     if (!validation.valid) return validation.reason;

//     const analysis = analyzeConversationFlow(targetNodeId, allNodes, connections);
//     if (!analysis) return 'Unable to analyze context';

//     const { targetNode, stats } = analysis;

//     let description = `Starting from "${targetNode.label}":\n`;

//     if (stats.isAtConversationEnd) {
//         description += `• Will include all ${stats.totalNodesInContext} node(s) in the conversation history`;
//     } else {
//         description += `• Will include ${stats.totalNodesInContext} node(s) leading up to this point\n`;
//         description += `• Will exclude ${stats.totalNodesExcluded} node(s) that come after this point`;
//     }

//     if (stats.conversationDepth > 1) {
//         description += `\n• Spans ${stats.conversationDepth} conversation turn(s)`;
//     }

//     if (validation.warning) {
//         description += `\n⚠️ ${validation.reason}`;
//     }

//     return description;
// };

// // Helper function to format context for different LLM providers
// const formatContextForLLM = (targetNodeId, allNodes, connections, userPrompt, options = {}) => {
//     const {
//         provider = 'generic',
//         includeSystemPrompt = true,
//         maxLength = 4000
//     } = options;

//     const contextString = buildContextString(targetNodeId, allNodes, connections, {
//         maxContextLength: maxLength - userPrompt.length - 200 // Leave room for user prompt and formatting
//     });

//     if (!contextString) {
//         return userPrompt;
//     }

//     const systemPrompt = includeSystemPrompt ?
//         "Continue this conversation based on the context provided. Maintain consistency with the previous discussion." : "";

//     const formattedPrompt = `${systemPrompt ? systemPrompt + '\n\n' : ''}Context from previous conversation:\n${contextString}\n\nNew request: ${userPrompt}`;

//     return formattedPrompt;
// };

// // Optimized context building for large graphs
// const buildOptimizedContext = (targetNodeId, allNodes, connections, options = {}) => {
//     const {
//         maxNodes = 20,
//         priorityTypes = ['root', 'concept'],
//         recentBias = 0.7
//     } = options;

//     const allContext = buildContextUpToNode(targetNodeId, allNodes, connections);

//     if (allContext.length <= maxNodes) {
//         return allContext;
//     }

//     // Score nodes for importance
//     const scoredNodes = allContext.map(node => {
//         let score = 0;

//         // Type priority
//         if (priorityTypes.includes(node.type)) score += 2;

//         // Recency bias (more recent = higher score)
//         const recencyFactor = node.id / Math.max(...allContext.map(n => n.id));
//         score += recencyFactor * recentBias;

//         // Content richness
//         const contentScore = (node.content || '').length + (node.description || '').length;
//         score += Math.min(contentScore / 1000, 1);

//         return { node, score };
//     });

//     // Sort by score and take top nodes, but always include the target node
//     const sortedNodes = scoredNodes.sort((a, b) => b.score - a.score);
//     const selectedNodes = sortedNodes.slice(0, maxNodes - 1).map(item => item.node);

//     // Ensure target node is included
//     const targetNode = allContext.find(n => n.id === targetNodeId);
//     if (targetNode && !selectedNodes.find(n => n.id === targetNodeId)) {
//         selectedNodes.push(targetNode);
//     }

//     // Re-sort by original order
//     return selectedNodes.sort((a, b) => {
//         if (a.batchId !== b.batchId) return a.batchId - b.batchId;
//         return a.id - b.id;
//     });
// };