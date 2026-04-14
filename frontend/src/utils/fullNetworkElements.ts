import type {
  CentralityMetric,
  ColorMode,
  CytoscapeElement,
  GeneOverlayMode,
  GraphArtifactResponse,
} from "../types";
import { getCentralityColor, getCentralityMetricValue, getCommunityColor } from "./color";

export type EdgeFilterMode = "all" | "strongest" | "topk";

function normalizedEdgeWidth(weight: number): number {
  const safeWeight = Number.isFinite(weight) ? Math.max(weight, 0) : 0;
  const scaled = Math.log10(safeWeight + 1);
  return Math.max(0.8, Math.min(8, 0.9 + scaled));
}

type BuildFullNetworkElementsParams = {
  graph: GraphArtifactResponse | null;
  selectedNodeId: string | null;
  selectedCommunityId: number | null;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  colorMode: ColorMode;
  centralityMetric: CentralityMetric;
  geneOverlayMode: GeneOverlayMode;
  hoveredNodeId: string | null;
  edgeFilterMode: EdgeFilterMode;
  topKNeighbors: number;
  showEdgeLabels: boolean;
};

function applyEdgeFilterMode(
  edges: GraphArtifactResponse["edges"],
  mode: EdgeFilterMode,
  topKNeighbors: number,
  highlightedEdgeIds: Set<string>,
): GraphArtifactResponse["edges"] {
  if (mode === "all") {
    return edges;
  }

  if (mode === "strongest") {
    const sorted = [...edges].sort((left, right) => right.data.weight - left.data.weight);
    const keepCount = Math.max(1, Math.ceil(sorted.length * 0.2));
    const strongest = new Set(sorted.slice(0, keepCount).map((edge) => edge.data.id));
    for (const id of highlightedEdgeIds) {
      strongest.add(id);
    }
    return edges.filter((edge) => strongest.has(edge.data.id));
  }

  const byNode = new Map<string, GraphArtifactResponse["edges"]>();
  for (const edge of edges) {
    byNode.set(edge.data.source, [...(byNode.get(edge.data.source) ?? []), edge]);
    byNode.set(edge.data.target, [...(byNode.get(edge.data.target) ?? []), edge]);
  }

  const kept = new Set<string>();
  for (const [_, nodeEdges] of byNode) {
    const top = [...nodeEdges]
      .sort((left, right) => right.data.weight - left.data.weight)
      .slice(0, Math.max(1, topKNeighbors));
    for (const edge of top) {
      kept.add(edge.data.id);
    }
  }

  for (const id of highlightedEdgeIds) {
    kept.add(id);
  }

  return edges.filter((edge) => kept.has(edge.data.id));
}

export function buildFullNetworkElements({
  graph,
  selectedNodeId,
  selectedCommunityId,
  highlightedNodeIds,
  highlightedEdgeIds,
  colorMode,
  centralityMetric,
  geneOverlayMode,
  hoveredNodeId,
  edgeFilterMode,
  topKNeighbors,
  showEdgeLabels,
}: BuildFullNetworkElementsParams): CytoscapeElement[] {
  if (!graph) {
    return [];
  }

  const filteredNodes =
    geneOverlayMode === "only" ? graph.nodes.filter((node) => node.data.gene_count > 0) : graph.nodes;
  const filteredNodeIds = new Set(filteredNodes.map((node) => node.data.id));

  const visibleEdges = graph.edges.filter(
    (edge) => filteredNodeIds.has(edge.data.source) && filteredNodeIds.has(edge.data.target),
  );

  const filteredEdges = applyEdgeFilterMode(visibleEdges, edgeFilterMode, topKNeighbors, highlightedEdgeIds);

  const adjacency = new Map<string, Set<string>>();
  for (const node of filteredNodes) {
    adjacency.set(node.data.id, new Set<string>());
  }
  for (const edge of filteredEdges) {
    adjacency.get(edge.data.source)?.add(edge.data.target);
    adjacency.get(edge.data.target)?.add(edge.data.source);
  }

  const neighborhood = new Set<string>();
  if (hoveredNodeId && adjacency.has(hoveredNodeId)) {
    neighborhood.add(hoveredNodeId);
    for (const neighbor of adjacency.get(hoveredNodeId) ?? []) {
      neighborhood.add(neighbor);
    }
  }

  const nodeElements = filteredNodes.map((node) => {
    const metricValue = getCentralityMetricValue(node.data, centralityMetric);
    const color =
      colorMode === "community"
        ? getCommunityColor(node.data.community_id)
        : getCentralityColor(metricValue);

    const selected = selectedNodeId === node.data.id;
    const pathNode = highlightedNodeIds.has(node.data.id);
    const communityDimmed = selectedCommunityId !== null && node.data.community_id !== selectedCommunityId;
    const geneDimmed = geneOverlayMode === "emphasize" && node.data.gene_count === 0;
    const hoverDimmed = hoveredNodeId !== null && !neighborhood.has(node.data.id);
  const hovered = hoveredNodeId === node.data.id;
  const dimmed = !selected && !hovered && !pathNode && (communityDimmed || geneDimmed || hoverDimmed);

    const geneBoost = Math.min(node.data.gene_count, 25) / 25;
    const size = 14 + node.data.degree_norm * 16 + geneBoost * 6;

    return {
      data: {
        ...node.data,
        label: node.data.label || node.data.id,
        color,
        size,
        selected: selected ? 1 : 0,
        hovered: hovered ? 1 : 0,
        pathNode: pathNode ? 1 : 0,
        neighborFocus: hoveredNodeId !== null && neighborhood.has(node.data.id) ? 1 : 0,
        dimmed: dimmed ? 1 : 0,
      },
    };
  });

  const nodeMap = new Map(nodeElements.map((node) => [String(node.data.id), node]));

  const edgeElements = filteredEdges.map((edge) => {
    const source = nodeMap.get(edge.data.source);
    const target = nodeMap.get(edge.data.target);
    const sourceDimmed = Number(source?.data.dimmed ?? 0) === 1;
    const targetDimmed = Number(target?.data.dimmed ?? 0) === 1;
    const pathEdge = highlightedEdgeIds.has(edge.data.id);

    const neighborFocus =
      hoveredNodeId !== null &&
      (edge.data.source === hoveredNodeId || edge.data.target === hoveredNodeId);

    const dimmed = !pathEdge && (sourceDimmed || targetDimmed);
    const weightLabel = edge.data.weight.toFixed(0);

    return {
      data: {
        ...edge.data,
        strokeWidth: normalizedEdgeWidth(edge.data.weight),
        pathEdge: pathEdge ? 1 : 0,
        neighborFocus: neighborFocus ? 1 : 0,
        dimmed: dimmed ? 1 : 0,
        edgeLabel: showEdgeLabels ? weightLabel : "",
      },
    };
  });

  return [...nodeElements, ...edgeElements];
}
