import type {
  CentralityMetric,
  ColorMode,
  CytoscapeElement,
  GeneOverlayMode,
  GraphArtifactResponse,
} from "../types";
import { getCentralityColor, getCentralityMetricValue, getCommunityColor } from "./color";

export type ArcFilterMode = "all" | "strongest" | "path" | "neighborhood";

type BuildGenomeArcElementsParams = {
  graph: GraphArtifactResponse | null;
  selectedNodeId: string | null;
  selectedCommunityId: number | null;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  colorMode: ColorMode;
  centralityMetric: CentralityMetric;
  geneOverlayMode: GeneOverlayMode;
  hoveredNodeId: string | null;
  arcFilterMode: ArcFilterMode;
  strongestRatio: number;
};

type GenomeArcBuildResult = {
  elements: CytoscapeElement[];
  nodeCount: number;
  edgeCount: number;
  longRangeCount: number;
  shortRangeCount: number;
};

function normalizedEdgeWidth(weight: number): number {
  const safeWeight = Number.isFinite(weight) ? Math.max(weight, 0) : 0;
  const scaled = Math.log10(safeWeight + 1);
  return Math.max(0.7, Math.min(6, 0.9 + scaled));
}

function quantile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const clamped = Math.max(0, Math.min(1, ratio));
  const index = Math.floor((sorted.length - 1) * clamped);
  return sorted[index] ?? 0;
}

export function buildGenomeArcElements({
  graph,
  selectedNodeId,
  selectedCommunityId,
  highlightedNodeIds,
  highlightedEdgeIds,
  colorMode,
  centralityMetric,
  geneOverlayMode,
  hoveredNodeId,
  arcFilterMode,
  strongestRatio,
}: BuildGenomeArcElementsParams): GenomeArcBuildResult {
  if (!graph) {
    return { elements: [], nodeCount: 0, edgeCount: 0, longRangeCount: 0, shortRangeCount: 0 };
  }

  const filteredNodes =
    geneOverlayMode === "only" ? graph.nodes.filter((node) => node.data.gene_count > 0) : graph.nodes;

  const orderedNodes = [...filteredNodes].sort((left, right) => {
    if (left.data.start !== right.data.start) {
      return left.data.start - right.data.start;
    }
    return left.data.id.localeCompare(right.data.id);
  });

  const startX = 30;
  const baselineY = 260;

  const indexByNode = new Map<string, number>();
  orderedNodes.forEach((node, index) => {
    indexByNode.set(node.data.id, index);
  });

  const filteredNodeIds = new Set(orderedNodes.map((node) => node.data.id));
  const sourceEdges = graph.edges.filter(
    (edge) => filteredNodeIds.has(edge.data.source) && filteredNodeIds.has(edge.data.target),
  );

  let filteredEdges = sourceEdges;
  if (arcFilterMode === "strongest") {
    const targetCount = Math.max(1, Math.ceil(sourceEdges.length * Math.max(0.05, Math.min(strongestRatio, 0.8))));
    filteredEdges = [...sourceEdges]
      .sort((left, right) => right.data.weight - left.data.weight)
      .slice(0, targetCount);
  } else if (arcFilterMode === "path") {
    filteredEdges = sourceEdges.filter((edge) => highlightedEdgeIds.has(edge.data.id));
  } else if (arcFilterMode === "neighborhood") {
    if (selectedNodeId && filteredNodeIds.has(selectedNodeId)) {
      filteredEdges = sourceEdges.filter(
        (edge) => edge.data.source === selectedNodeId || edge.data.target === selectedNodeId,
      );
    } else {
      filteredEdges = [];
    }
  }

  const filterNodeIds = new Set<string>();
  if (arcFilterMode === "all" || arcFilterMode === "strongest") {
    for (const node of orderedNodes) {
      filterNodeIds.add(node.data.id);
    }
  } else {
    for (const edge of filteredEdges) {
      filterNodeIds.add(edge.data.source);
      filterNodeIds.add(edge.data.target);
    }
    for (const nodeId of highlightedNodeIds) {
      if (filteredNodeIds.has(nodeId)) {
        filterNodeIds.add(nodeId);
      }
    }
    if (selectedNodeId && filteredNodeIds.has(selectedNodeId)) {
      filterNodeIds.add(selectedNodeId);
    }
  }

  const orderedVisibleNodes = orderedNodes.filter((node) => filterNodeIds.has(node.data.id));

  const adjacency = new Map<string, Set<string>>();
  for (const node of orderedVisibleNodes) {
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

  const visibleSpacing = Math.max(12, Math.min(28, 2200 / Math.max(orderedVisibleNodes.length, 1)));
  const distanceValues = filteredEdges.map((edge) => edge.data.distance);
  const shortThreshold = quantile(distanceValues, 0.33);
  const longThreshold = quantile(distanceValues, 0.67);

  const nodeElements: CytoscapeElement[] = orderedVisibleNodes.map((node, index) => {
    const metricValue = getCentralityMetricValue(node.data, centralityMetric);
    const color =
      colorMode === "community"
        ? getCommunityColor(node.data.community_id)
        : getCentralityColor(metricValue);

    const selected = selectedNodeId === node.data.id;
    const hovered = hoveredNodeId === node.data.id;
    const pathNode = highlightedNodeIds.has(node.data.id);
    const communityDimmed = selectedCommunityId !== null && node.data.community_id !== selectedCommunityId;
    const geneDimmed = geneOverlayMode === "emphasize" && node.data.gene_count === 0;
    const hoverDimmed = hoveredNodeId !== null && !neighborhood.has(node.data.id);
    const dimmed = !selected && !hovered && !pathNode && (communityDimmed || geneDimmed || hoverDimmed);

    const geneBoost = Math.min(node.data.gene_count, 25) / 25;
    const size = 10 + node.data.degree_norm * 10 + geneBoost * 4;

    return {
      data: {
        ...node.data,
        label: node.data.label || node.data.id,
        orderIndex: index,
        color,
        size,
        selected: selected ? 1 : 0,
        hovered: hovered ? 1 : 0,
        pathNode: pathNode ? 1 : 0,
        neighborFocus: hoveredNodeId !== null && neighborhood.has(node.data.id) ? 1 : 0,
        dimmed: dimmed ? 1 : 0,
      },
      position: {
        x: startX + index * visibleSpacing,
        y: baselineY,
      },
    };
  });

  const nodeMap = new Map(nodeElements.map((node) => [String(node.data.id), node]));

  let longRangeCount = 0;
  let shortRangeCount = 0;

  const edgeElements: CytoscapeElement[] = filteredEdges.map((edge) => {
    const sourceIndex = indexByNode.get(edge.data.source) ?? 0;
    const targetIndex = indexByNode.get(edge.data.target) ?? 0;
    const delta = Math.abs(targetIndex - sourceIndex);

    const source = nodeMap.get(edge.data.source);
    const target = nodeMap.get(edge.data.target);
    const sourceDimmed = Number(source?.data.dimmed ?? 0) === 1;
    const targetDimmed = Number(target?.data.dimmed ?? 0) === 1;
    const pathEdge = highlightedEdgeIds.has(edge.data.id);
    const neighborFocus =
      hoveredNodeId !== null &&
      (edge.data.source === hoveredNodeId || edge.data.target === hoveredNodeId);

    const dimmed = !pathEdge && (sourceDimmed || targetDimmed);

    const arcHeight = Math.max(14, Math.min(300, 12 + delta * 9));
    const isLongRange = edge.data.distance >= longThreshold;
    const isShortRange = edge.data.distance <= shortThreshold;

    if (isLongRange) {
      longRangeCount += 1;
    }
    if (isShortRange) {
      shortRangeCount += 1;
    }

    const thicknessBoost = isLongRange ? 1.4 : isShortRange ? 0.85 : 1;

    return {
      data: {
        ...edge.data,
        strokeWidth: normalizedEdgeWidth(edge.data.weight) * thicknessBoost,
        pathEdge: pathEdge ? 1 : 0,
        neighborFocus: neighborFocus ? 1 : 0,
        dimmed: dimmed ? 1 : 0,
        arcHeight,
        longRange: isLongRange ? 1 : 0,
        shortRange: isShortRange ? 1 : 0,
      },
    };
  });

  return {
    elements: [...nodeElements, ...edgeElements],
    nodeCount: nodeElements.length,
    edgeCount: edgeElements.length,
    longRangeCount,
    shortRangeCount,
  };
}
