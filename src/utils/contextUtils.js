// Contextual conversation utils

// Builds conversation context up to a specific node, including all predecessor nodes but excluding
// any nodes that come after it in the conversation flow
export const buildContextUpToNode = (targetNodeId, allNodes, connections) => {
    // Node 0 is the root, so guard on null/undefined rather than falsiness.
    if (targetNodeId === null || targetNodeId === undefined || !allNodes.length) return [];

    // Resolve by id: deletion filters the array without reindexing, so a
    // node's id and its position diverge as soon as anything is removed.
    const targetNode = allNodes.find(n => n.id === targetNodeId);
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


// Assembles the prompt actually sent for a follow-up.
//
// This used to live inline in NewPromptBox, which built the CONTEXT: and
// SELECTED NODES CONTEXT: blocks by hand while useGraphState sniffed the same
// strings to choose a template. Keeping both halves of that handshake in one
// place means the markers cannot drift apart.
export const CONTEXT_MARKER = 'CONTEXT:';
export const SELECTION_MARKER = 'SELECTED NODES CONTEXT:';

export const composePrompt = ({
    request,
    targetNodeId = null,
    nodes = [],
    connections = [],
    selectedNodeIds = null,
    includeContext = true,
    includeSelection = true,
} = {}) => {
    const parts = [];

    if (includeContext && targetNodeId !== null && targetNodeId !== undefined && nodes.length) {
        const covered = buildContextUpToNode(targetNodeId, nodes, connections);

        if (covered.length) {
            const topics = covered.map(n => `"${n.label}"`).join(', ');
            const concepts = covered
                .filter(n => n.type === 'root' || n.type === 'concept')
                .map(n => `- ${n.label}: ${n.description}`)
                .join('\n');

            parts.push(`${CONTEXT_MARKER} We have already covered these topics: ${topics}

Previous main concepts:
${concepts}

IMPORTANT: Do not recreate or duplicate the above topics. Instead, build NEW content that extends or relates to them.`);
        }
    }

    if (includeSelection && selectedNodeIds?.size) {
        const selected = nodes.filter(n => selectedNodeIds.has(n.id));

        if (selected.length) {
            const topics = selected.map(n => `"${n.label}"`).join(', ');
            const summaries = selected.map(n => `- ${n.label}: ${n.description}`).join('\n');

            parts.push(`${SELECTION_MARKER} The user has specifically selected these ${selected.length} nodes for reference: ${topics}

Selected concepts summary:
${summaries}

IMPORTANT: These are provided as BACKGROUND CONTEXT only. Do not recreate these topics. Generate NEW nodes that either:
1. Explore deeper aspects of these topics
2. Show practical applications
3. Connect these concepts to new areas
4. Provide related but distinct concepts`);
        }
    }

    if (!parts.length) return request;

    return `${parts.join('\n\n')}

NEW REQUEST: ${request}

Generate NEW content that addresses the user's request while building upon (not duplicating) the context provided above.`;
};

// True when a prompt already carries assembled context, which is how
// useGraphState decides between its two templates.
export const hasAssembledContext = (prompt = '') =>
    prompt.includes(CONTEXT_MARKER) || prompt.includes('SELECTED NODES');
