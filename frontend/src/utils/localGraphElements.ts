import type {
  CentralityMetric,
  ColorMode,
  CytoscapeElement,
  GeneOverlayMode,
  GraphArtifactResponse,
} from "../types";
import { getCentralityColor, getCentralityMetricValue, getCommunityColor } from "./color";

export type LocalNeighborhoodDepth = 1 | 2;

type BuildLocalGraphElementsParams = {
  graph: GraphArtifactResponse | null;
  selectedNodeId: string | null;
  selectedGene: string | null;
  preferredCenterNodeId: string | null;
  neighborhoodDepth: LocalNeighborhoodDepth;
  colorMode: ColorMode;
  centralityMetric: CentralityMetric;
  geneOverlayMode: GeneOverlayMode;
  selectedCommunityId: number | null;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  includeWeakEdges: boolean;
};

export type LocalGraphBuildResult = {
  elements: CytoscapeElement[];
  nodeCount: number;
  edgeCount: number;
  centerNodeId: string | null;
  centerSource: "preferred" | "selected-node" | "selected-gene" | null;
  localNodeIds: string[];
  immediateNeighborCount: number;
};

function normalizedEdgeWidth(weight: number): number {
  const safeWeight = Number.isFinite(weight) ? Math.max(weight, 0) : 0;
  const scaled = Math.log10(safeWeight + 1);
  return Math.max(1.1, Math.min(6.8, 1 + scaled));
}

function resolveCenterNode(
  graph: GraphArtifactResponse,
  selectedNodeId: string | null,
  selectedGene: string | null,
  preferredCenterNodeId: string | null,
): { nodeId: string | null; source: LocalGraphBuildResult["centerSource"] } {
  const nodeIds = new Set(graph.nodes.map((node) => node.data.id));

  if (preferredCenterNodeId && nodeIds.has(preferredCenterNodeId)) {
    return { nodeId: preferredCenterNodeId, source: "preferred" };
  }

  if (selectedNodeId && nodeIds.has(selectedNodeId)) {
    return { nodeId: selectedNodeId, source: "selected-node" };
  }

  if (selectedGene) {
    const normalized = selectedGene.trim().toLowerCase();
    const match = graph.nodes.find((node) => node.data.genes.some((gene) => gene.toLowerCase() === normalized));
    if (match) {
      return { nodeId: match.data.id, source: "selected-gene" };
    }
  }

  return { nodeId: null, source: null };
}

export function buildLocalGraphElements({
  graph,
  selectedNodeId,
  selectedGene,
  preferredCenterNodeId,
  neighborhoodDepth,
  colorMode,
  centralityMetric,
  geneOverlayMode,
  selectedCommunityId,
  highlightedNodeIds,
  highlightedEdgeIds,
  includeWeakEdges,
}: BuildLocalGraphElementsParams): LocalGraphBuildResult {
  if (!graph) {
    return {
      elements: [],
      nodeCount: 0,
      edgeCount: 0,
      centerNodeId: null,
      centerSource: null,
      localNodeIds: [],
      immediateNeighborCount: 0,
    };
  }

  const center = resolveCenterNode(graph, selectedNodeId, selectedGene, preferredCenterNodeId);
  if (!center.nodeId) {
    return {
      elements: [],
      nodeCount: 0,
      edgeCount: 0,
      centerNodeId: null,
      centerSource: null,
      localNodeIds: [],
      immediateNeighborCount: 0,
    };
  }

  const filteredNodes =
    geneOverlayMode === "only"
      ? graph.nodes.filter((node) => node.data.gene_count > 0 || node.data.id === center.nodeId)
      : graph.nodes;

  const filteredNodeIds = new Set(filteredNodes.map((node) => node.data.id));
  const filteredEdges = graph.edges.filter(
    (edge) => filteredNodeIds.has(edge.data.source) && filteredNodeIds.has(edge.data.target),
  );

  const adjacency = new Map<string, Set<string>>();
  for (const nodeId of filteredNodeIds) {
    adjacency.set(nodeId, new Set<string>());
  }
  for (const edge of filteredEdges) {
    adjacency.get(edge.data.source)?.add(edge.data.target);
    adjacency.get(edge.data.target)?.add(edge.data.source);
  }

  if (!filteredNodeIds.has(center.nodeId)) {
    return {
      elements: [],
      nodeCount: 0,
      edgeCount: 0,
      centerNodeId: null,
      centerSource: null,
      localNodeIds: [],
      immediateNeighborCount: 0,
    };
  }

  const depthByNode = new Map<string, number>();
  const queue: string[] = [center.nodeId];
  depthByNode.set(center.nodeId, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const currentDepth = depthByNode.get(current) ?? 0;
    if (currentDepth >= neighborhoodDepth) {
      continue;
    }

    for (const neighbor of adjacency.get(current) ?? []) {
      if (!depthByNode.has(neighbor)) {
        depthByNode.set(neighbor, currentDepth + 1);
        queue.push(neighbor);
      }
    }
  }

  const localNodeIds = new Set(depthByNode.keys());
  const localNodes = filteredNodes.filter((node) => localNodeIds.has(node.data.id));
  const extractedEdges = filteredEdges.filter(
    (edge) => localNodeIds.has(edge.data.source) && localNodeIds.has(edge.data.target),
  );

  const immediateNeighbors = adjacency.get(center.nodeId) ?? new Set<string>();

  const sortedWeights = [...extractedEdges]
    .map((edge) => edge.data.weight)
    .filter((weight) => Number.isFinite(weight))
    .sort((left, right) => left - right);
  const weakThreshold = sortedWeights.length > 0 ? sortedWeights[Math.floor(sortedWeights.length * 0.35)] : 0;

  const localEdges = includeWeakEdges
    ? extractedEdges
    : extractedEdges.filter((edge) => {
        if (highlightedEdgeIds.has(edge.data.id)) {
          return true;
        }
        if (edge.data.source === center.nodeId || edge.data.target === center.nodeId) {
          return true;
        }
        return edge.data.weight >= weakThreshold;
      });

  const visibleNodeIds = new Set<string>();
  visibleNodeIds.add(center.nodeId);
  for (const nodeId of highlightedNodeIds) {
    if (localNodeIds.has(nodeId)) {
      visibleNodeIds.add(nodeId);
    }
  }
  for (const edge of localEdges) {
    visibleNodeIds.add(edge.data.source);
    visibleNodeIds.add(edge.data.target);
  }

  const visibleLocalNodes = localNodes.filter((node) => visibleNodeIds.has(node.data.id));

  const nodeElements: CytoscapeElement[] = visibleLocalNodes.map((node) => {
    const metricValue = getCentralityMetricValue(node.data, centralityMetric);
    const color =
      colorMode === "community"
        ? getCommunityColor(node.data.community_id)
        : getCentralityColor(metricValue);

    const isCenter = node.data.id === center.nodeId;
    const depth = depthByNode.get(node.data.id) ?? neighborhoodDepth;
    const pathNode = highlightedNodeIds.has(node.data.id);
    const communityDimmed = selectedCommunityId !== null && node.data.community_id !== selectedCommunityId;
    const geneDimmed = geneOverlayMode === "emphasize" && node.data.gene_count === 0;
    const dimmed = !isCenter && !pathNode && (communityDimmed || geneDimmed);

    const hopBoost = depth === 0 ? 10 : depth === 1 ? 5 : 0;
    const baseSize = 13 + node.data.degree_norm * 12 + Math.min(node.data.gene_count, 25) / 5;

    return {
      data: {
        ...node.data,
        label: node.data.label || node.data.id,
        color,
        size: baseSize + hopBoost,
        center: isCenter ? 1 : 0,
        selected: selectedNodeId === node.data.id ? 1 : 0,
        pathNode: pathNode ? 1 : 0,
        hopDistance: depth,
        dimmed: dimmed ? 1 : 0,
      },
    };
  });

  const edgeElements: CytoscapeElement[] = localEdges.map((edge) => {
    const pathEdge = highlightedEdgeIds.has(edge.data.id);
    return {
      data: {
        ...edge.data,
        strokeWidth: normalizedEdgeWidth(edge.data.weight),
        pathEdge: pathEdge ? 1 : 0,
      },
    };
  });

  return {
    elements: [...nodeElements, ...edgeElements],
    nodeCount: nodeElements.length,
    edgeCount: edgeElements.length,
    centerNodeId: center.nodeId,
    centerSource: center.source,
    localNodeIds: visibleLocalNodes.map((node) => node.data.id),
    immediateNeighborCount: [...immediateNeighbors].filter((nodeId) => visibleNodeIds.has(nodeId)).length,
  };
}
