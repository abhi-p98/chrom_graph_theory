import { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type {
  CentralityMetric,
  ColorMode,
  CytoscapeElement,
  GeneOverlayMode,
  GraphArtifactResponse,
} from "../types/graph";
import { getCentralityColor, getCentralityMetricValue, getCommunityColor } from "../utils/color";

type GraphViewProps = {
  graph: GraphArtifactResponse | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
  selectedNodeId?: string | null;
  highlightedNodeIds?: Set<string>;
  highlightedEdgeIds?: Set<string>;
  selectedCommunityId?: number | null;
  centralityMetric?: CentralityMetric;
  colorMode?: ColorMode;
  geneOverlayMode?: GeneOverlayMode;
  focusedNodeId?: string | null;
  focusRequestId?: number;
  resetViewRequestId?: number;
  loading?: boolean;
  error?: string | null;
};

type CytoscapeTapEvent = {
  target: {
    id: () => string;
  };
};

type CytoscapeInstance = {
  removeAllListeners: (eventName: string) => void;
  on: {
    (eventName: string, selector: string, handler: (event: CytoscapeTapEvent) => void): void;
    (eventName: string, handler: () => void): void;
  };
  zoom: () => number;
  animate: (options: {
    center?: { eles: unknown };
    zoom?: number;
    duration?: number;
  }) => void;
  getElementById: (id: string) => {
    length: number;
  };
  fit: (eles?: unknown, padding?: number) => void;
  style: () => {
    selector: (selector: string) => {
      style: (name: string, value: string) => {
        update: () => void;
      };
    };
  };
};

const LABEL_ZOOM_THRESHOLD = 1.2;

function normalizedEdgeWidth(weight: number): number {
  const safeWeight = Number.isFinite(weight) ? Math.max(weight, 0) : 0;
  const scaled = Math.log10(safeWeight + 1);
  return Math.max(1, Math.min(8, 1 + scaled));
}

function convertGraphToElements({
  graph,
  selectedNodeId,
  highlightedNodeIds,
  highlightedEdgeIds,
  selectedCommunityId,
  centralityMetric,
  colorMode,
  geneOverlayMode,
}: {
  graph: GraphArtifactResponse | null;
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  selectedCommunityId: number | null;
  centralityMetric: CentralityMetric;
  colorMode: ColorMode;
  geneOverlayMode: GeneOverlayMode;
}): CytoscapeElement[] {
  if (!graph) {
    return [];
  }

  const filteredNodes =
    geneOverlayMode === "only" ? graph.nodes.filter((node) => node.data.gene_count > 0) : graph.nodes;

  const nodeElements = filteredNodes.map((node) => {
      const metricValue = getCentralityMetricValue(node.data, centralityMetric);
      const color =
        colorMode === "community"
          ? getCommunityColor(node.data.community_id)
          : getCentralityColor(metricValue);

      const isSelected = selectedNodeId === node.data.id;
      const isPathNode = highlightedNodeIds.has(node.data.id);
      const communityMatch = selectedCommunityId !== null && node.data.community_id === selectedCommunityId;
      const isGeneBin = node.data.gene_count > 0;

      const communityDimmed = selectedCommunityId !== null && !communityMatch;
      const geneDimmed = geneOverlayMode === "emphasize" && !isGeneBin;
      const dimmed = communityDimmed || geneDimmed;

      return {
        data: {
          ...node.data,
          label: node.data.label || node.data.id,
          color,
          size: 16 + metricValue * 20,
          selected: isSelected ? 1 : 0,
          pathNode: isPathNode ? 1 : 0,
          communityMatch: communityMatch ? 1 : 0,
          geneBin: isGeneBin ? 1 : 0,
          dimmed: dimmed ? 1 : 0,
        },
      };
    });

  const nodeById = new Map(nodeElements.map((node) => [String(node.data.id), node]));

  const edgeElements = graph.edges
    .filter((edge) => nodeById.has(String(edge.data.source)) && nodeById.has(String(edge.data.target)))
    .map((edge) => {
      const isPathEdge = highlightedEdgeIds.has(edge.data.id);
      const leftNode = nodeById.get(String(edge.data.source));
      const rightNode = nodeById.get(String(edge.data.target));
      const leftDimmed = Number(leftNode?.data.dimmed ?? 0) === 1;
      const rightDimmed = Number(rightNode?.data.dimmed ?? 0) === 1;
      const dimmed = leftDimmed || rightDimmed;
      return {
        data: {
          ...edge.data,
          pathEdge: isPathEdge ? 1 : 0,
          strokeWidth: normalizedEdgeWidth(edge.data.weight),
          dimmed: dimmed ? 1 : 0,
        },
      };
    });

  return [...nodeElements, ...edgeElements];
}

const stylesheet = [
  {
    selector: "node",
    style: {
      label: "",
      "background-color": "data(color)",
      color: "#e2e8f0",
      "font-size": 9,
      "text-outline-color": "#0f172a",
      "text-outline-width": 2,
      width: "data(size)",
      height: "data(size)",
      "border-width": "mapData(selected, 0, 1, 1, 5)",
      "border-color": "#f8fafc",
      opacity: "mapData(dimmed, 0, 1, 1, 0.2)",
    },
  },
  {
    selector: "node[communityMatch = 1]",
    style: {
      "border-color": "#e2e8f0",
      "border-width": 4,
      opacity: 1,
    },
  },
  {
    selector: "node[pathNode = 1]",
    style: {
      "border-color": "#f97316",
      "border-width": 6,
      opacity: 1,
    },
  },
  {
    selector: "node[geneBin = 1]",
    style: {
      "overlay-color": "#22c55e",
      "overlay-opacity": 0.12,
      "overlay-padding": 2,
    },
  },
  {
    selector: "edge",
    style: {
      width: "data(strokeWidth)",
      "line-color": "#64748b",
      "curve-style": "bezier",
      opacity: "mapData(dimmed, 0, 1, 0.82, 0.1)",
    },
  },
  {
    selector: "edge[pathEdge = 1]",
    style: {
      "line-color": "#f97316",
      width: 5,
      opacity: 1,
    },
  },
];

export function GraphView({
  graph,
  onNodeSelect,
  onNodeHover,
  selectedNodeId = null,
  highlightedNodeIds = new Set<string>(),
  highlightedEdgeIds = new Set<string>(),
  selectedCommunityId = null,
  centralityMetric = "degree",
  colorMode = "community",
  geneOverlayMode = "all",
  focusedNodeId = null,
  focusRequestId = 0,
  resetViewRequestId = 0,
  loading = false,
  error = null,
}: GraphViewProps) {
  const cyRef = useRef<CytoscapeInstance | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const elements = useMemo(
    () =>
      convertGraphToElements({
        graph,
        selectedNodeId,
        highlightedNodeIds,
        highlightedEdgeIds,
        selectedCommunityId,
        centralityMetric,
        colorMode,
        geneOverlayMode,
      }),
    [
      colorMode,
      centralityMetric,
      geneOverlayMode,
      graph,
      highlightedEdgeIds,
      highlightedNodeIds,
      selectedCommunityId,
      selectedNodeId,
    ],
  );

  useEffect(() => {
    if (!focusedNodeId || !cyRef.current) {
      return;
    }

    const cy = cyRef.current;
    const target = cy.getElementById(focusedNodeId);
    if (target.length === 0) {
      return;
    }

    cy.animate({
      center: { eles: target },
      zoom: 2.2,
      duration: 350,
    });
  }, [focusRequestId, focusedNodeId]);

  useEffect(() => {
    if (!cyRef.current) {
      return;
    }
    cyRef.current.fit(undefined, 30);
  }, [resetViewRequestId]);

  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId || !graph) {
      return null;
    }
    return graph.nodes.find((node) => node.data.id === hoveredNodeId)?.data ?? null;
  }, [graph, hoveredNodeId]);

  if (loading) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Hi-C Graph</h2>
        <p className="muted">Loading graph and community data…</p>
      </div>
    );
  }

  if (error && !graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Hi-C Graph</h2>
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Hi-C Graph</h2>
        <p className="muted">Load a chromosome to render the graph.</p>
      </div>
    );
  }

  return (
    <div className="panel graph-panel">
      <h2>Hi-C Graph</h2>
      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%", height: "520px", borderRadius: "0.75rem" }}
        layout={{
          name: "cose",
          animate: false,
          fit: true,
          padding: 24,
          randomize: true,
          componentSpacing: 40,
        }}
        stylesheet={stylesheet}
        cy={(cy: CytoscapeInstance) => {
          cyRef.current = cy;
          cy.removeAllListeners("tap");
          cy.removeAllListeners("mouseover");
          cy.removeAllListeners("mouseout");
          cy.removeAllListeners("zoom");

          const applyLabelVisibility = () => {
            const zoomLevel = cy.zoom();
            const nodeLabel = zoomLevel >= LABEL_ZOOM_THRESHOLD ? "data(label)" : "";
            cy.style().selector("node").style("label", nodeLabel).update();
          };

          applyLabelVisibility();
          cy.on("zoom", () => {
            applyLabelVisibility();
          });

          cy.on("tap", "node", (event: CytoscapeTapEvent) => {
            const nodeId = String(event.target.id());
            onNodeSelect(nodeId);
          });

          cy.on("mouseover", "node", (event: CytoscapeTapEvent) => {
            const id = String(event.target.id());
            setHoveredNodeId(id);
            onNodeHover?.(id);
          });

          cy.on("mouseout", "node", () => {
            setHoveredNodeId(null);
            onNodeHover?.(null);
          });
        }}
        userZoomingEnabled
        userPanningEnabled
        minZoom={0.15}
        maxZoom={6}
        wheelSensitivity={0.22}
      />

      {hoveredNode ? (
        <div className="graph-tooltip">
          <strong>{hoveredNode.label || hoveredNode.id}</strong>
          <p className="muted">{hoveredNode.id}</p>
          <p className="muted">
            Community #{hoveredNode.community_id} · Genes {hoveredNode.gene_count}
          </p>
        </div>
      ) : null}
    </div>
  );
}
