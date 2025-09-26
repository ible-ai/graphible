// Graph overview and navigation

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, Layers } from 'lucide-react';
import { getMinimapBounds } from '../utils/coordinateUtils';
import { applyClustering, getClusterColor, setLabelGenerator } from '../utils/clusteringUtils';

const Minimap = ({
  nodes,
  connections,
  currentNodeId,
  camera,
  onNavigateToNode,
  onCameraMove,
  generateWithLLM, // Added for cluster label generation
  currentModel // Added to pass to label generator
}) => {
  const [minimapExpanded, setMinimapExpanded] = useState(false);
  const [minimapZoom, setMinimapZoom] = useState(1.0);
  const [clusteringMode, setClusteringMode] = useState('none');
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  // State for async clustering
  const [clusterState, setClusterState] = useState({ clusters: [], showClusters: false });

  // Set up label generator when component mounts
  useEffect(() => {
    if (generateWithLLM && currentModel) {
      const labelGenerator = async (prompt) => {
        try {
          const response = await generateWithLLM(prompt, false, currentModel);
          if (response.ok) {
            const text = await response.text();
            return text.trim();
          }
          return 'Cluster';
        } catch (error) {
          console.warn('Label generation failed:', error);
          return 'Cluster';
        }
      };
      setLabelGenerator(labelGenerator);
    }
  }, [generateWithLLM, currentModel]);

  // Apply clustering with async support
  useEffect(() => {
    let cancelled = false;

    const runClustering = async () => {
      if (nodes.length === 0 || clusteringMode === 'none') {
        if (!cancelled) setClusterState({ clusters: [], showClusters: false });
        return;
      }

      try {
        const result = await applyClustering(nodes, connections, clusteringMode);
        if (!cancelled) setClusterState(result);
      } catch (error) {
        console.warn('Clustering failed:', error);
        if (!cancelled) setClusterState({ clusters: [], showClusters: false });
      }
    };

    runClustering();

    return () => {
      cancelled = true;
    };
  }, [nodes, connections, clusteringMode]);

  const { clusters, showClusters } = clusterState;

  // Calculate zoomed bounds with memoization
  const zoomedBounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const bounds = getMinimapBounds(nodes);
    const centerX = (bounds.minX + bounds.maxX) / 2 + panOffset.x;
    const centerY = (bounds.minY + bounds.maxY) / 2 + panOffset.y;
    const zoomedWidth = (bounds.maxX - bounds.minX) / minimapZoom;
    const zoomedHeight = (bounds.maxY - bounds.minY) / minimapZoom;

    return {
      minX: centerX - zoomedWidth / 2,
      maxX: centerX + zoomedWidth / 2,
      minY: centerY - zoomedHeight / 2,
      maxY: centerY + zoomedHeight / 2
    };
  }, [nodes, panOffset, minimapZoom]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e) => {
      if (!minimapExpanded) return;
      e.preventDefault();
      e.stopPropagation();
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      setMinimapZoom(prev => Math.max(0.5, Math.min(prev * zoomDelta, 3.0)));
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [minimapExpanded]);

  const handleMouseDown = useCallback((e) => {
    if (!minimapExpanded) return;
    setIsPanning(true);
    setLastPanPoint({ x: e.clientX, y: e.clientY });
    e.preventDefault();
    e.stopPropagation(); // Prevent propagation to main graph
  }, [minimapExpanded]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning || !minimapExpanded) return;

    e.preventDefault();
    e.stopPropagation(); // Prevent propagation to main graph

    const deltaX = e.clientX - lastPanPoint.x;
    const deltaY = e.clientY - lastPanPoint.y;

    // Convert screen delta to world delta
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const worldDeltaX = (deltaX / rect.width) * (zoomedBounds.maxX - zoomedBounds.minX);
      const worldDeltaY = (deltaY / rect.height) * (zoomedBounds.maxY - zoomedBounds.minY);

      setPanOffset(prev => ({
        x: prev.x - worldDeltaX,
        y: prev.y - worldDeltaY
      }));
    }

    setLastPanPoint({ x: e.clientX, y: e.clientY });
  }, [isPanning, minimapExpanded, lastPanPoint, zoomedBounds]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isPanning) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
      };
    }
  }, [isPanning, handleMouseMove, handleMouseUp]);

  // Enhanced hierarchical label visibility with aggregate priority
  const getClusterLabelVisibility = useCallback((cluster, minimapZoom, clusterRank) => {
    const nodeCount = cluster.nodes.length;
    const hasRootNode = cluster.nodes.some(n => n.type === 'root');
    const isTopTier = clusterRank < 3; // Top 3 most important clusters

    // Calculate aggregate importance score
    const aggregateImportance = nodeCount + (hasRootNode ? 10 : 0) + (isTopTier ? 5 : 0);

    // Define zoom thresholds with special handling for aggregates
    const zoomThresholds = {
      // High-level aggregates should always be visible
      topAggregate: 0.1,   // Top tier clusters: always visible
      aggregate: 0.3,      // Important aggregates: visible when slightly zoomed out
      veryLarge: 0.5,      // Large clusters: visible at medium zoom out
      large: 0.8,          // Medium clusters: visible at closer to normal zoom
      medium: 1.2,         // Small clusters: visible at normal zoom
      small: 1.8,          // Very small clusters: only when zoomed in
      single: 2.5          // Single nodes: only when very zoomed in
    };

    let threshold;
    if (isTopTier && aggregateImportance >= 8) {
      // Top tier clusters with high importance - always show
      threshold = zoomThresholds.topAggregate;
    } else if (aggregateImportance >= 12 || nodeCount >= 8) {
      // High importance aggregates
      threshold = zoomThresholds.aggregate;
    } else if (nodeCount >= 6) {
      threshold = zoomThresholds.veryLarge;
    } else if (nodeCount >= 4) {
      threshold = zoomThresholds.large;
    } else if (nodeCount >= 2) {
      threshold = zoomThresholds.medium;
    } else if (nodeCount === 1) {
      threshold = zoomThresholds.single;
    } else {
      threshold = zoomThresholds.small;
    }

    const isVisible = minimapZoom >= threshold;

    // Calculate opacity with smooth fade transitions
    const fadeZone = 0.25; // Slightly larger fade zone for smoother transitions
    const fadeStart = threshold - fadeZone;
    const opacity = isVisible ?
      Math.min(1, Math.max(0.1, (minimapZoom - fadeStart) / fadeZone)) : 0;

    return { isVisible, opacity, importance: aggregateImportance };
  }, []);

  // Calculate cluster visibility in viewport
  const calculateClusterViewportRelevance = useCallback((cluster, viewport) => {
    let visibleNodes = 0;
    let totalWeight = 0;

    for (const node of cluster.nodes) {
      const isInViewport =
        node.worldX >= viewport.minX && node.worldX <= viewport.maxX &&
        node.worldY >= viewport.minY && node.worldY <= viewport.maxY;

      if (isInViewport) {
        visibleNodes++;
        // Weight root nodes higher
        totalWeight += node.type === 'root' ? 3 : 1;
      }
    }

    const visibilityRatio = visibleNodes / cluster.nodes.length;
    const centroidInViewport =
      cluster.centroid.x >= viewport.minX && cluster.centroid.x <= viewport.maxX &&
      cluster.centroid.y >= viewport.minY && cluster.centroid.y <= viewport.maxY;

    return {
      visibleNodes,
      visibilityRatio,
      totalWeight,
      centroidInViewport,
      relevanceScore: (visibilityRatio * 100) + totalWeight + (centroidInViewport ? 20 : 0)
    };
  }, []);

  // Smart label positioning that avoids overlaps
  const calculateSmartLabelPositions = useCallback((visibleClusters, viewport, textScaleFactor) => {
    const labelPadding = 50 * textScaleFactor;
    const labelSpacing = 80 * textScaleFactor; // Minimum distance between labels
    const positions = [];

    for (let i = 0; i < visibleClusters.length; i++) {
      const cluster = visibleClusters[i];
      let labelX = cluster.centroid.x;
      let labelY = cluster.centroid.y - (100 * textScaleFactor);

      // Start with ideal position, clamped to viewport
      labelX = Math.max(viewport.minX + labelPadding,
               Math.min(labelX, viewport.maxX - labelPadding));
      labelY = Math.max(viewport.minY + labelPadding,
               Math.min(labelY, viewport.maxY - labelPadding));

      // Check for collisions with existing labels
      let hasCollision = true;
      let attempts = 0;
      const maxAttempts = 12;

      while (hasCollision && attempts < maxAttempts) {
        hasCollision = false;

        // Check distance to all previously positioned labels
        for (const existingPos of positions) {
          const distance = Math.sqrt(
            Math.pow(labelX - existingPos.x, 2) +
            Math.pow(labelY - existingPos.y, 2)
          );

          if (distance < labelSpacing) {
            hasCollision = true;
            break;
          }
        }

        if (hasCollision) {
          // Try different positions in a spiral pattern
          const angle = (attempts * Math.PI * 2) / 8; // 8 directions
          const radius = labelSpacing * (1 + Math.floor(attempts / 8));

          labelX = cluster.centroid.x + Math.cos(angle) * radius;
          labelY = cluster.centroid.y + Math.sin(angle) * radius;

          // Re-clamp to viewport after spiral positioning
          labelX = Math.max(viewport.minX + labelPadding,
                   Math.min(labelX, viewport.maxX - labelPadding));
          labelY = Math.max(viewport.minY + labelPadding,
                   Math.min(labelY, viewport.maxY - labelPadding));
        }

        attempts++;
      }

      positions.push({ x: labelX, y: labelY, cluster });
    }

    return positions;
  }, []);

  // Sort clusters by viewport relevance and importance
  const getVisibleClusters = useCallback((clusters, minimapZoom, viewport) => {
    if (clusters.length === 0) return [];

    // Calculate viewport relevance for each cluster
    const clustersWithRelevance = clusters.map(cluster => {
      const viewportRelevance = calculateClusterViewportRelevance(cluster, viewport);
      const hasRootNode = cluster.nodes.some(n => n.type === 'root');

      // Combine viewport relevance with global importance
      const globalImportance = cluster.nodes.length + (hasRootNode ? 10 : 0);
      const combinedScore = (viewportRelevance.relevanceScore * 2) + globalImportance;

      return {
        ...cluster,
        viewportRelevance,
        combinedScore
      };
    });

    // Sort by combined relevance score (viewport visibility + importance)
    const sortedClusters = clustersWithRelevance.sort((a, b) =>
      b.combinedScore - a.combinedScore
    );

    // More conservative limits to prevent overcrowding
    const baseLimit = Math.max(2, Math.min(3, sortedClusters.length));
    const zoomBonus = Math.floor(minimapZoom * 4);
    const maxClusters = Math.min(sortedClusters.length, baseLimit + zoomBonus);

    return sortedClusters.slice(0, maxClusters);
  }, [calculateClusterViewportRelevance]);

  if (nodes.length === 0) return null;

  // Determine if we should show clusters as merged nodes (when zoomed out)
  const shouldShowMergedClusters = showClusters && minimapZoom < 1.5;

  // Calculate text scale factor - text should get bigger when zoomed out
  const textScaleFactor = 1 / minimapZoom;

  // Smart text truncation that respects word boundaries
  const truncateAtWordBoundary = (text, maxLength) => {
    if (!text || text.length <= maxLength) return text;

    const words = text.split(' ');
    let result = '';

    for (const word of words) {
      if ((result + ' ' + word).trim().length <= maxLength) {
        result = result ? result + ' ' + word : word;
      } else {
        break;
      }
    }

    return result || words[0].substring(0, maxLength); // Fallback if first word is too long
  };

  const handleMinimapClick = (e) => {
    if (isPanning) return; // Don't navigate if we were dragging

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const worldX = zoomedBounds.minX + (zoomedBounds.maxX - zoomedBounds.minX) * x;
    const worldY = zoomedBounds.minY + (zoomedBounds.maxY - zoomedBounds.minY) * y;

    onCameraMove(-worldX, -worldY);
  };

  return (
    <div
      className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/50 transition-all duration-300 minimap-container shadow-lg font-inter"
      style={{
        width: minimapExpanded ? 600 : 280,
        height: minimapExpanded ? 400 : 200,
        zIndex: 100
      }}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="p-4 flex items-center justify-between border-b border-slate-200/50 rounded-t-2xl transition-colors duration-200"
      >
        <span
          className="text-slate-800 text-sm font-medium cursor-pointer hover:bg-slate-50/50 px-2 py-1 rounded transition-colors"
          onClick={() => setMinimapExpanded(!minimapExpanded)}
        >
          Graph Overview
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
            {nodes.length} nodes
          </span>
          {minimapExpanded && (
            <>
              <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMinimapZoom(prev => Math.max(0.5, prev * 0.8));
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut size={12} />
                </button>
                <span className="text-xs text-slate-600 px-1 min-w-[32px] text-center">
                  {Math.round(minimapZoom * 100)}%
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMinimapZoom(prev => Math.min(3.0, prev * 1.25));
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn size={12} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1">
                <Layers size={12} className="text-slate-600" />
                <select
                  value={clusteringMode}
                  onChange={(e) => {
                    e.stopPropagation();
                    setClusteringMode(e.target.value);
                  }}
                  className="text-xs bg-transparent text-slate-600 border-none outline-none cursor-pointer"
                  title="Clustering mode"
                >
                  <option value="none">None</option>
                  <option value="semantic">Topic</option>
                  <option value="temporal">Time</option>
                  <option value="spatial">Space</option>
                  <option value="hierarchical">Level</option>
                </select>
              </div>
            </>
          )}
          <button
            onClick={() => setMinimapExpanded(!minimapExpanded)}
            className="p-1 hover:bg-slate-50/50 rounded transition-colors"
            title={minimapExpanded ? "Minimize" : "Maximize"}
          >
            {minimapExpanded ?
              <Minimize2 size={16} className="text-slate-600" /> :
              <Maximize2 size={16} className="text-slate-600" />
            }
          </button>
        </div>
      </div>

      <div className="relative" style={{ height: minimapExpanded ? 340 : 140, overflow: 'visible' }}>
        <svg
          ref={svgRef}
          className={`w-full h-full ${isPanning ? 'cursor-grabbing' : (minimapExpanded ? 'cursor-grab' : 'cursor-crosshair')}`}
          viewBox={`${zoomedBounds.minX} ${zoomedBounds.minY} ${zoomedBounds.maxX - zoomedBounds.minX} ${zoomedBounds.maxY - zoomedBounds.minY}`}
          onClick={handleMinimapClick}
          onMouseDown={handleMouseDown}
        >
          {/* Cluster gaussian glows - only show when not using merged clusters */}
          {showClusters && !shouldShowMergedClusters && (() => {
            const visibleClusters = getVisibleClusters(clusters, minimapZoom, zoomedBounds);
            const smartPositions = minimapExpanded ? calculateSmartLabelPositions(visibleClusters, zoomedBounds, textScaleFactor) : [];

            return visibleClusters.map((cluster, index) => {
            // Get cluster color
            const clusterColor = getClusterColor(cluster.type, index);

            return (
              <g key={cluster.id}>
                {/* Create multiple gaussian layers for each node in the cluster */}
                {cluster.nodes.map((node, nodeIndex) => (
                  <g key={`${cluster.id}-node-${nodeIndex}`}>
                    {/* Multiple concentric gaussian layers for smooth falloff */}
                    <circle
                      cx={node.worldX}
                      cy={node.worldY}
                      r={400 * textScaleFactor}
                      fill={clusterColor.replace('0.2', '0.05')}
                      stroke="none"
                      className="pointer-events-none"
                      style={{
                        filter: `blur(${80 * textScaleFactor}px)`
                      }}
                    />
                    <circle
                      cx={node.worldX}
                      cy={node.worldY}
                      r={250 * textScaleFactor}
                      fill={clusterColor.replace('0.2', '0.08')}
                      stroke="none"
                      className="pointer-events-none"
                      style={{
                        filter: `blur(${50 * textScaleFactor}px)`
                      }}
                    />
                    <circle
                      cx={node.worldX}
                      cy={node.worldY}
                      r={150 * textScaleFactor}
                      fill={clusterColor.replace('0.2', '0.12')}
                      stroke="none"
                      className="pointer-events-none"
                      style={{
                        filter: `blur(${30 * textScaleFactor}px)`
                      }}
                    />
                  </g>
                ))}

                {/* Cluster label - positioned with smart collision avoidance */}
                {minimapExpanded && (() => {
                  const nodeCount = cluster.nodes.length;
                  const clusterRank = index; // Use map index as rank
                  const visibility = getClusterLabelVisibility(cluster, minimapZoom, clusterRank);

                  if (!visibility.isVisible || visibility.opacity < 0.01) return null;

                  const fontWeight = Math.min(900, 400 + (nodeCount - 1) * 100);
                  const fontSize = Math.max(64, 72 + (nodeCount - 1) * 8) * textScaleFactor;

                  // Adaptive text length based on zoom
                  const maxTextLength = Math.round(15 + (minimapZoom * 15));

                  // Use smart positioning that avoids overlaps
                  const smartPosition = smartPositions.find(pos => pos.cluster.id === cluster.id);
                  const labelX = smartPosition ? smartPosition.x : cluster.centroid.x;
                  const labelY = smartPosition ? smartPosition.y : cluster.centroid.y - (100 * textScaleFactor);

                  return (
                    <text
                      x={labelX}
                      y={labelY}
                      fontSize={fontSize}
                      fill="rgb(51, 65, 85)"
                      textAnchor="middle"
                      className="cluster-label pointer-events-none"
                      style={{
                        fontWeight,
                        opacity: visibility.opacity,
                        textShadow: `${3 * textScaleFactor}px ${3 * textScaleFactor}px ${6 * textScaleFactor}px rgba(255,255,255,0.9)`,
                        transition: 'opacity 0.3s ease-out'
                      }}
                    >
                      {truncateAtWordBoundary(cluster.label, maxTextLength)}
                    </text>
                  );
                })()}
              </g>
            );
            });
          })()}

          {/* Minimap connections */}
          {connections.map((conn, index) => {
            if (conn.from >= nodes.length || conn.to >= nodes.length) return null;
            const fromNode = nodes.at(conn.from);
            const toNode = nodes.at(conn.to);
            if (!fromNode || !toNode) return null;

            return (
              <line
                key={index}
                x1={fromNode.worldX}
                y1={fromNode.worldY}
                x2={toNode.worldX}
                y2={toNode.worldY}
                stroke="rgb(203, 213, 225)"
                strokeWidth="3"
                opacity="0.4"
                strokeLinecap="round"
              />
            );
          })}

          {/* Minimap nodes - show either individual nodes or merged clusters */}
          {shouldShowMergedClusters ? (
            // Show merged cluster nodes with gaussian distribution
            (() => {
              const visibleClusters = getVisibleClusters(clusters, minimapZoom, zoomedBounds);
              const smartPositions = minimapExpanded ? calculateSmartLabelPositions(visibleClusters, zoomedBounds, textScaleFactor) : [];

              return visibleClusters.map((cluster, index) => {
              const isCurrentCluster = cluster.nodes.some(node => node.id === currentNodeId);
              const clusterColor = getClusterColor(cluster.type, index);

              // Create organic cluster shape by placing gaussian distributions at each node position
              return (
                <g key={cluster.id}>
                  {/* Gaussian distribution based on actual node positions */}
                  {cluster.nodes.map((node, nodeIndex) => (
                    <g key={`merged-${cluster.id}-node-${nodeIndex}`}>
                      {/* Outer gaussian layer - very soft */}
                      <circle
                        cx={node.worldX}
                        cy={node.worldY}
                        r={600 * textScaleFactor}
                        fill={clusterColor.replace('0.2', '0.03')}
                        stroke="none"
                        className="pointer-events-none"
                        style={{
                          filter: `blur(${120 * textScaleFactor}px)`
                        }}
                      />
                      {/* Middle gaussian layer */}
                      <circle
                        cx={node.worldX}
                        cy={node.worldY}
                        r={350 * textScaleFactor}
                        fill={clusterColor.replace('0.2', '0.06')}
                        stroke="none"
                        className="pointer-events-none"
                        style={{
                          filter: `blur(${70 * textScaleFactor}px)`
                        }}
                      />
                      {/* Inner gaussian layer */}
                      <circle
                        cx={node.worldX}
                        cy={node.worldY}
                        r={200 * textScaleFactor}
                        fill={clusterColor.replace('0.2', '0.1')}
                        stroke="none"
                        className="pointer-events-none"
                        style={{
                          filter: `blur(${40 * textScaleFactor}px)`
                        }}
                      />
                    </g>
                  ))}

                  {/* Current cluster indicator */}
                  {isCurrentCluster && (
                    <circle
                      cx={cluster.centroid.x}
                      cy={cluster.centroid.y}
                      r={400 * textScaleFactor}
                      fill="rgba(99, 102, 241, 0.1)"
                      stroke="none"
                      className="pointer-events-none"
                      style={{
                        filter: `blur(${60 * textScaleFactor}px)`
                      }}
                    />
                  )}

                  {/* Invisible clickable area */}
                  <circle
                    cx={cluster.centroid.x}
                    cy={cluster.centroid.y}
                    r={Math.max(300 * textScaleFactor, cluster.nodes.length * 50 + 150)}
                    fill="transparent"
                    stroke="none"
                    className="cursor-pointer hover:opacity-60 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToNode(cluster.nodes[0].id);
                    }}
                  />

                  {/* Cluster label - positioned with smart collision avoidance */}
                  {minimapExpanded && (() => {
                    const nodeCount = cluster.nodes.length;
                    const clusterRank = index; // Use map index as rank
                    const visibility = getClusterLabelVisibility(cluster, minimapZoom, clusterRank);

                    if (!visibility.isVisible || visibility.opacity < 0.01) return null;

                    const fontWeight = Math.min(900, 400 + (nodeCount - 1) * 100);
                    const fontSize = Math.max(110, 128 + (nodeCount - 1) * 12) * textScaleFactor;

                    // Adaptive text length - more detail when zoomed in
                    const maxTextLength = Math.round(10 + (minimapZoom * 20));

                    // Use smart positioning that avoids overlaps
                    const smartPosition = smartPositions.find(pos => pos.cluster.id === cluster.id);
                    const labelX = smartPosition ? smartPosition.x : cluster.centroid.x;
                    const labelY = smartPosition ? smartPosition.y : cluster.centroid.y + (15 * textScaleFactor);

                    return (
                      <text
                        x={labelX}
                        y={labelY}
                        fontSize={fontSize}
                        fill="rgb(51, 65, 85)"
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                        style={{
                          fontWeight,
                          opacity: visibility.opacity,
                          textShadow: `${3 * textScaleFactor}px ${3 * textScaleFactor}px ${6 * textScaleFactor}px rgba(255,255,255,0.9)`,
                          letterSpacing: `${2 * textScaleFactor}px`,
                          transition: 'opacity 0.3s ease-out'
                        }}
                      >
                        {truncateAtWordBoundary(cluster.label, maxTextLength)}
                      </text>
                    );
                  })()}
                </g>
              );
              });
            })()
          ) : (
            // Show individual nodes
            // Create heat map effect with subtle node glows
            nodes.map(node => {
              const isRoot = node.type === 'root';
              const isCurrent = node.id === currentNodeId;

              // Get base color for this node type
              const nodeColors = {
                root: 'rgb(99, 102, 241)', // indigo-500
                concept: 'rgb(148, 163, 184)', // slate-400
                example: 'rgb(156, 163, 175)', // gray-400
                detail: 'rgb(148, 163, 184)', // slate-400
                default: 'rgb(156, 163, 175)' // gray-400
              };

              const baseColor = nodeColors[node.type] || nodeColors.default;

              return (
                <g key={node.id}>
                  {/* Current node indicator - glowing shadow only */}
                  {isCurrent && (
                    <circle
                      cx={node.worldX}
                      cy={node.worldY}
                      r={300 * textScaleFactor}
                      fill="rgba(99, 102, 241, 0.15)"
                      stroke="none"
                      className="pointer-events-none"
                      style={{
                        filter: `blur(${40 * textScaleFactor}px)`
                      }}
                    />
                  )}

                  {/* Subtle node presence - semi-transparent glow */}
                  <circle
                    cx={node.worldX}
                    cy={node.worldY}
                    r={120 * textScaleFactor}
                    fill={baseColor.replace('rgb', 'rgba').replace(')', ', 0.2)')}
                    stroke="none"
                    className="cursor-pointer hover:opacity-60 transition-opacity pointer-events-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToNode(node.id);
                    }}
                    style={{
                      filter: `blur(${20 * textScaleFactor}px)`
                    }}
                  />

                  {/* Root node gets a slightly more prominent glow */}
                  {isRoot && (
                    <circle
                      cx={node.worldX}
                      cy={node.worldY}
                      r={160 * textScaleFactor}
                      fill="rgba(99, 102, 241, 0.3)"
                      stroke="none"
                      className="pointer-events-none"
                      style={{
                        filter: `blur(${30 * textScaleFactor}px)`
                      }}
                    />
                  )}
                </g>
              );
            })
          )}

          {/* Viewport indicator */}
          <rect
            x={-camera.x - (window.innerWidth / 2) / camera.zoom}
            y={-camera.y - (window.innerHeight / 2) / camera.zoom}
            width={window.innerWidth / camera.zoom}
            height={window.innerHeight / camera.zoom}
            fill="none"
            stroke="rgb(99, 102, 241)"
            strokeWidth="4"
            opacity="0.6"
            rx="8"
            strokeDasharray="8,4"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(99, 102, 241, 0.2))'
            }}
          />
        </svg>
      </div>
    </div>
  );
};

export default Minimap;