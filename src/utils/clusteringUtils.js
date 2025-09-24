import { pipeline } from '@huggingface/transformers';

let embeddingPipeline = null;
let llmGenerateLabel = null;

const embeddingCache = new Map();
const CACHE_SIZE_LIMIT = 1000;

const initializeEmbeddings = async () => {
  if (!embeddingPipeline) {
    try {
      embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } catch (error) {
      console.warn('Failed to load embedding model:', error);
      return false;
    }
  }
  return true;
};

export const setLabelGenerator = (generateFn) => {
  llmGenerateLabel = generateFn;
};

const getCachedEmbeddings = async (nodeTexts) => {
  const uncachedTexts = [];
  const uncachedIndices = [];
  const cachedEmbeddings = new Array(nodeTexts.length);

  nodeTexts.forEach((text, index) => {
    const cached = embeddingCache.get(text);
    if (cached) {
      cachedEmbeddings[index] = cached;
    } else {
      uncachedTexts.push(text);
      uncachedIndices.push(index);
    }
  });

  if (uncachedTexts.length > 0) {
    const newEmbeddings = await embeddingPipeline(uncachedTexts, { pooling: 'mean', normalize: true });
    const newEmbeddingVectors = newEmbeddings.tolist();

    newEmbeddingVectors.forEach((embedding, i) => {
      const originalIndex = uncachedIndices[i];
      const text = uncachedTexts[i];

      if (embeddingCache.size >= CACHE_SIZE_LIMIT) {
        const firstKey = embeddingCache.keys().next().value;
        embeddingCache.delete(firstKey);
      }

      embeddingCache.set(text, embedding);
      cachedEmbeddings[originalIndex] = embedding;
    });
  }

  return cachedEmbeddings;
};

const groupByEmbeddingSimilarity = async (nodes, threshold = 0.75) => {
  try {
    const embeddingsReady = await initializeEmbeddings();
    if (!embeddingsReady || nodes.length > 20) {
      return groupByTopicSimilarity(nodes, 0.1);
    }

    const nodeTexts = nodes.map(node => node.label || 'untitled');
    const embeddingVectors = await getCachedEmbeddings(nodeTexts);
    const clusters = [];
    const processedNodes = new Set();

    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
      const node = nodes[nodeIndex];
      if (processedNodes.has(node.id)) continue;

      const cluster = {
        id: `semantic_${clusters.length}`,
        type: 'semantic',
        nodes: [node],
        allKeywords: new Set([node.label])
      };

      const mainEmbedding = embeddingVectors[nodeIndex];

      for (let otherIndex = nodeIndex + 1; otherIndex < nodes.length; otherIndex++) {
        const otherNode = nodes[otherIndex];
        if (!processedNodes.has(otherNode.id)) {
          const otherEmbedding = embeddingVectors[otherIndex];
          const similarity = cosineSimilarity(mainEmbedding, otherEmbedding);

          if (similarity >= threshold) {
            cluster.nodes.push(otherNode);
            cluster.allKeywords.add(otherNode.label);
            processedNodes.add(otherNode.id);
          }
        }
      }

      processedNodes.add(node.id);
      cluster.label = generateSimpleClusterLabel(cluster);
      cluster.centroid = calculateCentroid(cluster.nodes);
      clusters.push(cluster);
    }

    return clusters;

  } catch (error) {
    console.warn('Embedding clustering failed, using fallback:', error);
    return groupByTopicSimilarity(nodes, 0.1);
  }
};

const groupByTopicSimilarity = (nodes, threshold = 0.1) => {
  const clusters = [];
  const processedNodes = new Set();

  const nodeKeywords = new Map();
  nodes.forEach(node => {
    nodeKeywords.set(node.id, extractKeywords(node.label, node.description, node.content));
  });

  nodes.forEach(node => {
    if (processedNodes.has(node.id)) return;

    const cluster = {
      id: `semantic_${clusters.length}`,
      type: 'semantic',
      nodes: [node],
      allKeywords: new Set(nodeKeywords.get(node.id))
    };

    const mainKeywords = nodeKeywords.get(node.id);

    nodes.forEach(otherNode => {
      if (otherNode.id !== node.id && !processedNodes.has(otherNode.id)) {
        const otherKeywords = nodeKeywords.get(otherNode.id);
        const commonCount = mainKeywords.filter(kw => otherKeywords.includes(kw)).length;
        const similarity = commonCount / Math.max(mainKeywords.length, otherKeywords.length, 1);

        if (similarity >= threshold) {
          cluster.nodes.push(otherNode);
          processedNodes.add(otherNode.id);
          otherKeywords.forEach(kw => cluster.allKeywords.add(kw));
        }
      }
    });

    processedNodes.add(node.id);

    cluster.label = generateSimpleClusterLabel(cluster);
    cluster.centroid = calculateCentroid(cluster.nodes);
    clusters.push(cluster);
  });

  return clusters;
};

const groupByTypeSimplified = (nodes) => {
  const typeGroups = new Map();

  nodes.forEach(node => {
    const type = node.type || 'unknown';
    if (!typeGroups.has(type)) {
      typeGroups.set(type, []);
    }
    typeGroups.get(type).push(node);
  });

  return Array.from(typeGroups.entries()).map(([type, nodes]) => ({
    id: `type_${type}`,
    type: 'semantic',
    nodes,
    centroid: calculateCentroid(nodes),
    label: `${type} (${nodes.length})`
  }));
};

const groupByBatchId = (nodes) => {
  const batchGroups = new Map();

  nodes.forEach(node => {
    const batchId = node.batchId || 0;
    if (!batchGroups.has(batchId)) {
      batchGroups.set(batchId, []);
    }
    batchGroups.get(batchId).push(node);
  });

  return Array.from(batchGroups.entries()).map(([batchId, batchNodes]) => {
    // Find the earliest timestamp in this batch for labeling
    const timestamps = batchNodes
      .map(node => node.createdAt || node.timestamp)
      .filter(Boolean)
      .sort();

    let timeLabel = 'Unknown Time';
    if (timestamps.length > 0) {
      const earliestTime = new Date(timestamps[0]);
      const now = new Date();
      const isToday = earliestTime.toDateString() === now.toDateString();

      if (isToday) {
        // Show time for today's nodes
        timeLabel = earliestTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        // Show date for older nodes
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        if (earliestTime.toDateString() === yesterday.toDateString()) {
          timeLabel = 'Yesterday';
        } else {
          timeLabel = earliestTime.toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
          });
        }
      }
    }

    return {
      id: `temporal_${batchId}`,
      type: 'temporal',
      nodes: batchNodes,
      centroid: calculateCentroid(batchNodes),
      label: timeLabel
    };
  });
};

const NATO_PHONETIC = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
  'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
  'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey',
  'Xray', 'Yankee', 'Zulu'
];

const groupByProximity = (nodes, maxDistance = 400) => {
  const clusters = [];
  const processedNodes = new Set();

  nodes.forEach(node => {
    if (processedNodes.has(node.id)) return;

    const cluster = {
      id: `spatial_${clusters.length}`,
      type: 'spatial',
      nodes: [node],
      centroid: { x: node.worldX, y: node.worldY }
    };

    // Find nearby nodes
    nodes.forEach(otherNode => {
      if (otherNode.id !== node.id && !processedNodes.has(otherNode.id)) {
        const distance = Math.sqrt(
          Math.pow(node.worldX - otherNode.worldX, 2) +
          Math.pow(node.worldY - otherNode.worldY, 2)
        );

        if (distance <= maxDistance) {
          cluster.nodes.push(otherNode);
          processedNodes.add(otherNode.id);
        }
      }
    });

    processedNodes.add(node.id);
    cluster.centroid = calculateCentroid(cluster.nodes);

    // Use NATO phonetic alphabet for naming
    const natoName = NATO_PHONETIC[clusters.length % NATO_PHONETIC.length];
    cluster.label = natoName;

    clusters.push(cluster);
  });

  return clusters;
};

const groupByDepthAndConnections = (nodes) => {
  const depthGroups = new Map();

  nodes.forEach(node => {
    const depth = node.depth || 0;
    if (!depthGroups.has(depth)) {
      depthGroups.set(depth, []);
    }
    depthGroups.get(depth).push(node);
  });

  const clusters = [];

  depthGroups.forEach((depthNodes, depth) => {
    if (depthNodes.length > 4) {
      const parentGroups = new Map();

      depthNodes.forEach(node => {
        const parentId = node.parentNodeId || 'root';
        if (!parentGroups.has(parentId)) {
          parentGroups.set(parentId, []);
        }
        parentGroups.get(parentId).push(node);
      });

      parentGroups.forEach((siblingNodes, parentId) => {
        clusters.push({
          id: `hierarchical_${depth}_${parentId}`,
          type: 'hierarchical',
          nodes: siblingNodes,
          centroid: calculateCentroid(siblingNodes),
          label: `${depth}`
        });
      });
    } else {
      clusters.push({
        id: `hierarchical_${depth}`,
        type: 'hierarchical',
        nodes: depthNodes,
        centroid: calculateCentroid(depthNodes),
        label: `${depth}`
      });
    }
  });

  return clusters;
};

// Simple, fast keyword extraction
const extractKeywords = (label = '', description = '', content = '') => {
  const text = `${label} ${description} ${content}`.toLowerCase();
  const words = text.match(/\b[a-z]{3,}\b/g) || [];

  // Basic stop words only
  const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'did', 'way', 'what', 'with', 'that', 'this', 'have', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were'];

  // Count word frequency, prioritize longer words and words from labels
  const wordCounts = {};
  for (const word of words) {
    if (stopWords.includes(word) || word.length < 4) continue;

    let weight = 1;
    if (word.length > 6) weight += 1;
    if (label.toLowerCase().includes(word)) weight += 2;

    wordCounts[word] = (wordCounts[word] || 0) + weight;
  }

  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
};

// Cosine similarity calculation
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};


const generateSimpleClusterLabel = (cluster) => {
  if (!cluster.nodes || cluster.nodes.length === 0) {
    return 'Empty Cluster';
  }

  if (cluster.nodes.length === 1) {
    const nodeLabel = cluster.nodes[0].label || 'Item';
    const words = nodeLabel.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];

    const meaningfulWords = words.filter(word =>
      !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'this', 'that', 'with', 'what', 'when', 'where', 'how', 'why'].includes(word)
    );

    if (meaningfulWords.length > 0) {
      const topWords = meaningfulWords.slice(0, 2)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1));
      return topWords.join(' ');
    }

    return nodeLabel;
  }

  const allLabels = cluster.nodes.map(n => n.label || '').join(' ').toLowerCase();
  const words = allLabels.match(/\b[a-z]{4,}\b/g) || [];

  const wordCounts = {};
  words.forEach(word => {
    if (!['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'this', 'that', 'with'].includes(word)) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  });

  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

  if (topWords.length > 0) {
    return topWords.join(' & ');
  }

  return cluster.nodes[0]?.label || 'Topics';
};

const generateFallbackLabel = (cluster) => {
  return generateSimpleClusterLabel(cluster);
};

const calculateCentroid = (nodes) => {
  if (nodes.length === 0) return { x: 0, y: 0 };

  const sumX = nodes.reduce((sum, node) => sum + node.worldX, 0);
  const sumY = nodes.reduce((sum, node) => sum + node.worldY, 0);

  return {
    x: sumX / nodes.length,
    y: sumY / nodes.length
  };
};

export const clusteringLogic = {
  semantic: groupByEmbeddingSimilarity,
  temporal: groupByBatchId,
  spatial: groupByProximity,
  hierarchical: groupByDepthAndConnections
};

export const applyClustering = async (nodes, _connections, algorithm = 'none', options = {}) => {
  if (algorithm === 'none' || !nodes.length) {
    return { clusters: [], showClusters: false };
  }

  const clusterFn = clusteringLogic[algorithm];
  if (!clusterFn) {
    console.warn(`Unknown clustering algorithm: ${algorithm}`);
    return { clusters: [], showClusters: false };
  }

  const algorithmDefaults = {
    semantic: { threshold: 0.7, showSingleNodes: true },
    temporal: { threshold: 0, showSingleNodes: true },
    spatial: { threshold: 800, showSingleNodes: false },
    hierarchical: { threshold: 0, showSingleNodes: true }
  };

  const mergedOptions = { ...algorithmDefaults[algorithm], ...options };

  let clusters;
  try {
    if (algorithm === 'spatial') {
      clusters = await clusterFn(nodes, mergedOptions.threshold);
    } else {
      clusters = await clusterFn(nodes, mergedOptions.threshold);
    }
  } catch (error) {
    console.warn('Clustering failed:', error);
    clusters = groupByTypeSimplified(nodes);
  }

  if (!mergedOptions.showSingleNodes) {
    clusters = clusters.filter(cluster => cluster.nodes.length > 1);
  }

  return {
    clusters,
    showClusters: clusters.length > 0
  };
};

export const getClusterColor = (clusterType, index = 0) => {
  const colors = {
    semantic: ['rgba(99, 102, 241, 0.2)', 'rgba(139, 69, 19, 0.2)', 'rgba(220, 38, 127, 0.2)'],
    temporal: ['rgba(34, 197, 94, 0.2)', 'rgba(168, 85, 247, 0.2)', 'rgba(245, 158, 11, 0.2)'],
    spatial: ['rgba(236, 72, 153, 0.2)', 'rgba(14, 165, 233, 0.2)', 'rgba(132, 204, 22, 0.2)'],
    hierarchical: ['rgba(249, 115, 22, 0.2)', 'rgba(239, 68, 68, 0.2)', 'rgba(6, 182, 212, 0.2)']
  };

  const typeColors = colors[clusterType] || colors.semantic;
  return typeColors[index % typeColors.length];
};