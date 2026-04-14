import { useVisualizationState } from "../../context/VisualizationContext";
import { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import {
  buildLocalGraphElements,
  type LocalNeighborhoodDepth,
} from "../../utils/localGraphElements";
import { getLocalGraphStylesheet } from "../../utils/localGraphStyles";
import { TabHelpLegend } from "./TabHelpLegend";
import { SelectionStatusBar } from "./SelectionStatusBar";

type CytoscapeTapEvent = {
  target: {
    id: () => string;
  };
};

type CytoscapeInstance = {
  fit: (eles?: unknown, padding?: number) => void;
  getElementById: (id: string) => {
    length: number;
  };
  animate: (options: {
    center?: { eles: unknown };
    zoom?: number;
    duration?: number;
  }) => void;
  removeAllListeners: (eventName: string) => void;
  on: {
    (eventName: string, selector: string, handler: (event: CytoscapeTapEvent) => void): void;
    (eventName: string, selector: string, handler: () => void): void;
  };
};

export function LocalGraphView() {
  const state = useVisualizationState();
  const cyRef = useRef<CytoscapeInstance | null>(null);
  const [depth, setDepth] = useState<LocalNeighborhoodDepth>(1);
  const [includeWeakEdges, setIncludeWeakEdges] = useState<boolean>(true);
  const [localCenterNodeId, setLocalCenterNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    setLocalCenterNodeId(null);
  }, [state.selectedNodeId, state.selectedGene, state.graph?.meta?.chromosome]);

  const localGraph = useMemo(
    () =>
      buildLocalGraphElements({
        graph: state.graph,
        selectedNodeId: state.selectedNodeId,
        selectedGene: state.selectedGene,
        preferredCenterNodeId: localCenterNodeId,
        neighborhoodDepth: depth,
        colorMode: state.colorMode,
        centralityMetric: state.centralityMetric,
        geneOverlayMode: state.geneOverlayMode,
        selectedCommunityId: state.selectedCommunityId,
        highlightedNodeIds: state.highlightedNodeIds,
        highlightedEdgeIds: state.highlightedEdgeIds,
        includeWeakEdges,
      }),
    [
      depth,
      includeWeakEdges,
      localCenterNodeId,
      state.centralityMetric,
      state.colorMode,
      state.geneOverlayMode,
      state.graph,
      state.highlightedEdgeIds,
      state.highlightedNodeIds,
      state.selectedCommunityId,
      state.selectedGene,
      state.selectedNodeId,
    ],
  );

  const stylesheet = useMemo(() => getLocalGraphStylesheet(), []);

  useEffect(() => {
    state.onLocalGraphCenterChange(localGraph.centerNodeId, localGraph.immediateNeighborCount);
  }, [localGraph.centerNodeId, localGraph.immediateNeighborCount, state]);

  useEffect(() => {
    if (!cyRef.current) {
      return;
    }
    cyRef.current.fit(undefined, 34);
  }, [state.resetViewRequestId, localGraph.nodeCount, depth]);

  useEffect(() => {
    if (!state.focusedNodeId || !cyRef.current) {
      return;
    }

    const cy = cyRef.current;
    const target = cy.getElementById(state.focusedNodeId);
    if (target.length > 0) {
      cy.animate({ center: { eles: target }, zoom: 2, duration: 260 });
      return;
    }

    if (state.graph?.nodes.some((node) => node.data.id === state.focusedNodeId)) {
      setLocalCenterNodeId(state.focusedNodeId);
    }
  }, [state.focusRequestId, state.focusedNodeId, state.graph]);

  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId || !state.graph) {
      return null;
    }
    return state.graph.nodes.find((node) => node.data.id === hoveredNodeId)?.data ?? null;
  }, [hoveredNodeId, state.graph]);

  function handleResetCenterToSelection() {
    setLocalCenterNodeId(null);
  }

  const pathFullyVisible = useMemo(() => {
    if (!state.shortestPath || localGraph.localNodeIds.length === 0) {
      return false;
    }
    const visibleNodeIds = new Set(localGraph.localNodeIds);
    return visibleNodeIds.has(state.shortestPath.source_node) && visibleNodeIds.has(state.shortestPath.target_node);
  }, [localGraph.localNodeIds, state.shortestPath]);

  if (state.loading) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Local Graph View</h2>
        <p className="muted">Loading local neighborhood graph…</p>
      </div>
    );
  }

  if (state.error && !state.graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Local Graph View</h2>
        <p className="error">{state.error}</p>
      </div>
    );
  }

  if (!state.graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Local Graph View</h2>
        <p className="muted">Load a chromosome to inspect local neighborhoods.</p>
      </div>
    );
  }

  if (!localGraph.centerNodeId) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Local Graph View</h2>
        <p className="muted">Select a node in a graph view or search/select a gene to open its local ego graph.</p>
      </div>
    );
  }

  return (
    <div className="panel graph-panel">
      <h2>Local Graph View</h2>
      <TabHelpLegend
        summary="Ego-graph view: inspect a center node and its immediate (1-hop) or extended (2-hop) neighborhood."
        items={[
          { label: "Center node", value: "Current focus bin (white ring)" },
          { label: "Neighborhood", value: "Depth controls how many hops are included" },
          { label: "Use case", value: "Clarifies local structure around node/gene" },
        ]}
      />
      <SelectionStatusBar
        selectedNodeId={state.selectedNodeId}
        selectedGene={state.selectedGene}
        selectedCommunityId={state.selectedCommunityId}
        hasShortestPath={Boolean(state.shortestPath)}
        onResetHighlights={state.onResetHighlights}
      />

      <div className="full-network-toolbar">
        <div className="filter-group">
          <span className="muted">Neighborhood depth</span>
          <div className="inline-toggle">
            <button
              type="button"
              className={depth === 1 ? "toggle-chip is-active" : "toggle-chip"}
              onClick={() => setDepth(1)}
            >
              1-hop
            </button>
            <button
              type="button"
              className={depth === 2 ? "toggle-chip is-active" : "toggle-chip"}
              onClick={() => setDepth(2)}
            >
              2-hop
            </button>
          </div>
        </div>

        <label className="inline-control checkbox-control">
          <input
            type="checkbox"
            checked={includeWeakEdges}
            onChange={(event) => setIncludeWeakEdges(event.target.checked)}
          />
          <span className="muted">Include weak edges</span>
        </label>

        <button type="button" onClick={handleResetCenterToSelection}>
          Reset local focus
        </button>

        <button
          type="button"
          onClick={() => {
            cyRef.current?.fit(undefined, 34);
          }}
        >
          Fit graph
        </button>
      </div>

      <div className="full-network-meta muted">
        Center node {localGraph.centerNodeId} ({localGraph.centerSource ?? "selection"}) · {localGraph.nodeCount} nodes · {localGraph.edgeCount} edges
      </div>

      {state.shortestPath ? (
        <p className="muted arc-view-note">
          {pathFullyVisible
            ? "Shortest path is fully visible in this local graph (orange nodes/edges)."
            : "Shortest path is only partially visible; increase depth or recenter near path endpoints."}
        </p>
      ) : null}

      <CytoscapeComponent
        elements={localGraph.elements}
        style={{ width: "100%" }}
        className="graph-canvas"
        layout={{
          name: "concentric",
          fit: true,
          animate: false,
          padding: 28,
          concentric: (node: { data: (key: string) => number }) => 3 - Number(node.data("hopDistance") ?? 0),
          levelWidth: () => 1,
          minNodeSpacing: 22,
        }}
        stylesheet={stylesheet}
        cy={(cy: CytoscapeInstance) => {
          cyRef.current = cy;
          cy.removeAllListeners("tap");
          cy.removeAllListeners("mouseover");
          cy.removeAllListeners("mouseout");

          cy.on("tap", "node", (event: CytoscapeTapEvent) => {
            const nodeId = String(event.target.id());
            setLocalCenterNodeId(nodeId);
            state.onNodeSelect(nodeId);
          });

          cy.on("mouseover", "node", (event: CytoscapeTapEvent) => {
            setHoveredNodeId(String(event.target.id()));
          });

          cy.on("mouseout", "node", () => {
            setHoveredNodeId(null);
          });
        }}
        userZoomingEnabled
        userPanningEnabled
        minZoom={0.25}
        maxZoom={4}
        wheelSensitivity={0.2}
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
