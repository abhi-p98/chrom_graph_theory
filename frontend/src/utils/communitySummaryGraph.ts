import type { CytoscapeElement, GraphArtifactResponse } from "../types";
import { getCommunityColor } from "./color";

export type CommunityNodeColorMetric = "community" | "gene_count" | "avg_degree";
export type CommunityEdgeWeightMode = "total" | "average";

type BuildCommunitySummaryGraphParams = {
  graph: GraphArtifactResponse | null;
  selectedCommunityId: number | null;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  colorMetric: CommunityNodeColorMetric;
  edgeWeightMode: CommunityEdgeWeightMode;
  showEdgeLabels: boolean;
};

type CommunityNodeAggregate = {
  communityId: number;
  nodeCount: number;
  geneCount: number;
  avgDegree: number;
  avgBetweenness: number;
  avgCloseness: number;
};

type CommunityEdgeAggregate = {
  sourceCommunity: number;
  targetCommunity: number;
  contactCount: number;
  totalWeight: number;
  avgWeight: number;
};

export type CommunitySummaryGraphBuildResult = {
  elements: CytoscapeElement[];
  communityCount: number;
  interCommunityEdgeCount: number;
  nodeAggregates: CommunityNodeAggregate[];
  edgeAggregates: CommunityEdgeAggregate[];
};

function pairKey(left: number, right: number): string {
  return left < right ? `${left}::${right}` : `${right}::${left}`;
}

function safeDiv(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function toScaledSize(value: number, min: number, max: number): number {
  return min + (max - min) * clamp01(value);
}

function interpolateBlueOrange(normalized: number): string {
  const t = clamp01(normalized);
  const start = { r: 30, g: 58, b: 138 };
  const end = { r: 245, g: 158, b: 11 };
  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function normalizeByRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0;
  }
  return clamp01((value - min) / (max - min));
}

export function buildCommunitySummaryGraph({
  graph,
  selectedCommunityId,
  highlightedNodeIds,
  highlightedEdgeIds,
  colorMetric,
  edgeWeightMode,
  showEdgeLabels,
}: BuildCommunitySummaryGraphParams): CommunitySummaryGraphBuildResult {
  if (!graph) {
    return {
      elements: [],
      communityCount: 0,
      interCommunityEdgeCount: 0,
      nodeAggregates: [],
      edgeAggregates: [],
    };
  }

  const nodesByCommunity = new Map<number, GraphArtifactResponse["nodes"]>();
  const nodeToCommunity = new Map<string, number>();

  for (const node of graph.nodes) {
    const communityId = node.data.community_id;
    if (!nodesByCommunity.has(communityId)) {
      nodesByCommunity.set(communityId, []);
    }
    nodesByCommunity.get(communityId)?.push(node);
    nodeToCommunity.set(node.data.id, communityId);
  }

  const nodeAggregates: CommunityNodeAggregate[] = Array.from(nodesByCommunity.entries())
    .map(([communityId, memberNodes]) => {
      const nodeCount = memberNodes.length;
      const geneCount = memberNodes.reduce((sum, node) => sum + node.data.gene_count, 0);
      const avgDegree = safeDiv(memberNodes.reduce((sum, node) => sum + node.data.degree_norm, 0), nodeCount);
      const avgBetweenness = safeDiv(
        memberNodes.reduce((sum, node) => sum + node.data.betweenness_norm, 0),
        nodeCount,
      );
      const avgCloseness = safeDiv(memberNodes.reduce((sum, node) => sum + node.data.closeness_norm, 0), nodeCount);

      return {
        communityId,
        nodeCount,
        geneCount,
        avgDegree,
        avgBetweenness,
        avgCloseness,
      };
    })
    .sort((left, right) => left.communityId - right.communityId);

  const edgeAccumulator = new Map<string, { sourceCommunity: number; targetCommunity: number; totalWeight: number; contactCount: number; pathEdge: boolean }>();

  for (const edge of graph.edges) {
    const sourceCommunity = nodeToCommunity.get(edge.data.source);
    const targetCommunity = nodeToCommunity.get(edge.data.target);
    if (sourceCommunity === undefined || targetCommunity === undefined || sourceCommunity === targetCommunity) {
      continue;
    }

    const key = pairKey(sourceCommunity, targetCommunity);
    if (!edgeAccumulator.has(key)) {
      edgeAccumulator.set(key, {
        sourceCommunity,
        targetCommunity,
        totalWeight: 0,
        contactCount: 0,
        pathEdge: false,
      });
    }

    const aggregate = edgeAccumulator.get(key);
    if (!aggregate) {
      continue;
    }
    aggregate.totalWeight += edge.data.weight;
    aggregate.contactCount += 1;
    if (highlightedEdgeIds.has(edge.data.id)) {
      aggregate.pathEdge = true;
    }
  }

  const edgeAggregates: CommunityEdgeAggregate[] = Array.from(edgeAccumulator.values())
    .map((edge) => ({
      sourceCommunity: edge.sourceCommunity,
      targetCommunity: edge.targetCommunity,
      contactCount: edge.contactCount,
      totalWeight: edge.totalWeight,
      avgWeight: safeDiv(edge.totalWeight, edge.contactCount),
    }))
    .sort((left, right) => right.totalWeight - left.totalWeight);

  const nodeCountValues = nodeAggregates.map((node) => node.nodeCount);
  const geneCountValues = nodeAggregates.map((node) => node.geneCount);
  const avgDegreeValues = nodeAggregates.map((node) => node.avgDegree);
  const nodeCountMin = Math.min(...nodeCountValues, 0);
  const nodeCountMax = Math.max(...nodeCountValues, 1);
  const geneCountMin = Math.min(...geneCountValues, 0);
  const geneCountMax = Math.max(...geneCountValues, 1);
  const avgDegreeMin = Math.min(...avgDegreeValues, 0);
  const avgDegreeMax = Math.max(...avgDegreeValues, 1);

  const pathCommunities = new Set<number>();
  for (const nodeId of highlightedNodeIds) {
    const communityId = nodeToCommunity.get(nodeId);
    if (communityId !== undefined) {
      pathCommunities.add(communityId);
    }
  }

  const nodeElements: CytoscapeElement[] = nodeAggregates.map((aggregate) => {
    const selected = selectedCommunityId === aggregate.communityId;
    const pathNode = pathCommunities.has(aggregate.communityId);

    const normalizedGeneCount = normalizeByRange(aggregate.geneCount, geneCountMin, geneCountMax);
    const normalizedDegree = normalizeByRange(aggregate.avgDegree, avgDegreeMin, avgDegreeMax);

    const baseColor =
      colorMetric === "community"
        ? getCommunityColor(aggregate.communityId)
        : colorMetric === "gene_count"
          ? interpolateBlueOrange(normalizedGeneCount)
          : interpolateBlueOrange(normalizedDegree);

    const sizeBasis = colorMetric === "gene_count" ? normalizedGeneCount : normalizeByRange(aggregate.nodeCount, nodeCountMin, nodeCountMax);

    return {
      data: {
        id: `community:${aggregate.communityId}`,
        communityId: aggregate.communityId,
        label: `C${aggregate.communityId}`,
        detailLabel: `C${aggregate.communityId} · ${aggregate.nodeCount} bins · ${aggregate.geneCount} genes`,
        nodeCount: aggregate.nodeCount,
        geneCount: aggregate.geneCount,
        avgDegree: aggregate.avgDegree,
        avgBetweenness: aggregate.avgBetweenness,
        avgCloseness: aggregate.avgCloseness,
        color: baseColor,
        size: toScaledSize(sizeBasis, 28, 74),
        selected: selected ? 1 : 0,
        pathNode: pathNode ? 1 : 0,
      },
    };
  });

  const edgeValues = edgeAggregates.map((edge) => (edgeWeightMode === "average" ? edge.avgWeight : edge.totalWeight));
  const edgeMin = Math.min(...edgeValues, 0);
  const edgeMax = Math.max(...edgeValues, 1);

  const edgeElements: CytoscapeElement[] = edgeAggregates.map((aggregate) => {
    const key = pairKey(aggregate.sourceCommunity, aggregate.targetCommunity);
    const pathEdge = edgeAccumulator.get(key)?.pathEdge ?? false;
    const metricValue = edgeWeightMode === "average" ? aggregate.avgWeight : aggregate.totalWeight;
    const normalizedValue = normalizeByRange(metricValue, edgeMin, edgeMax);

    const edgeLabel = showEdgeLabels
      ? edgeWeightMode === "average"
        ? `avg ${aggregate.avgWeight.toFixed(2)}`
        : `Σ ${aggregate.totalWeight.toFixed(1)}`
      : "";

    return {
      data: {
        id: `community-edge:${aggregate.sourceCommunity}:${aggregate.targetCommunity}`,
        source: `community:${aggregate.sourceCommunity}`,
        target: `community:${aggregate.targetCommunity}`,
        contactCount: aggregate.contactCount,
        totalWeight: aggregate.totalWeight,
        avgWeight: aggregate.avgWeight,
        metricValue,
        normalizedMetric: normalizedValue,
        width: toScaledSize(normalizedValue, 1.6, 9),
        label: edgeLabel,
        pathEdge: pathEdge ? 1 : 0,
      },
    };
  });

  return {
    elements: [...nodeElements, ...edgeElements],
    communityCount: nodeElements.length,
    interCommunityEdgeCount: edgeElements.length,
    nodeAggregates,
    edgeAggregates,
  };
}
