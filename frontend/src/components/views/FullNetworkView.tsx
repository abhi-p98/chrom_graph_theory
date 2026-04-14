import { useVisualizationState } from "../../context/VisualizationContext";
import { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import { buildFullNetworkElements, type EdgeFilterMode } from "../../utils/fullNetworkElements";
import { getFullNetworkStylesheet } from "../../utils/fullNetworkStyles";
import { TabHelpLegend } from "./TabHelpLegend";
import { SelectionStatusBar } from "./SelectionStatusBar";

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
  layout: (options: Record<string, unknown>) => {
    run: () => void;
  };
  style: () => {
    selector: (selector: string) => {
      style: (name: string, value: string) => {
        update: () => void;
      };
    };
  };
};

const LABEL_ZOOM_THRESHOLD = 1.2;

export function FullNetworkView() {
  const state = useVisualizationState();
  const cyRef = useRef<CytoscapeInstance | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [edgeFilterMode, setEdgeFilterMode] = useState<EdgeFilterMode>("all");
  const [topKNeighbors, setTopKNeighbors] = useState<number>(3);
  const [showEdgeLabels, setShowEdgeLabels] = useState<boolean>(false);

  const elements = useMemo(
    () =>
      buildFullNetworkElements({
        graph: state.graph,
        selectedNodeId: state.selectedNodeId,
        selectedCommunityId: state.selectedCommunityId,
        highlightedNodeIds: state.highlightedNodeIds,
        highlightedEdgeIds: state.highlightedEdgeIds,
        colorMode: state.colorMode,
        centralityMetric: state.centralityMetric,
        geneOverlayMode: state.geneOverlayMode,
        hoveredNodeId,
        edgeFilterMode,
        topKNeighbors,
        showEdgeLabels,
      }),
    [
      edgeFilterMode,
      hoveredNodeId,
      showEdgeLabels,
      state.centralityMetric,
      state.colorMode,
      state.geneOverlayMode,
      state.graph,
      state.highlightedEdgeIds,
      state.highlightedNodeIds,
      state.selectedCommunityId,
      state.selectedNodeId,
      topKNeighbors,
    ],
  );

  const stylesheet = useMemo(() => getFullNetworkStylesheet(), []);

  useEffect(() => {
    if (!state.focusedNodeId || !cyRef.current) {
      return;
    }
    const cy = cyRef.current;
    const target = cy.getElementById(state.focusedNodeId);
    if (target.length === 0) {
      return;
    }
    cy.animate({
      center: { eles: target },
      zoom: 2.2,
      duration: 350,
    });
  }, [state.focusRequestId, state.focusedNodeId]);

  useEffect(() => {
    if (!cyRef.current) {
      return;
    }
    cyRef.current.fit(undefined, 30);
  }, [state.resetViewRequestId]);

  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId || !state.graph) {
      return null;
    }
    return state.graph.nodes.find((node) => node.data.id === hoveredNodeId)?.data ?? null;
  }, [hoveredNodeId, state.graph]);

  const visibleNodeCount = useMemo(
    () => elements.filter((element) => typeof element.data.id === "string" && !element.data.source).length,
    [elements],
  );
  const visibleEdgeCount = useMemo(
    () => elements.filter((element) => typeof element.data.source === "string").length,
    [elements],
  );

  function handleResetLayout() {
    if (!cyRef.current) {
      return;
    }
    const cy = cyRef.current;
    cy.layout({
      name: "cose",
      animate: false,
      fit: true,
      padding: 24,
      randomize: true,
      componentSpacing: 40,
    }).run();
    cy.fit(undefined, 30);
  }

  if (state.loading) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Full Network</h2>
        <p className="muted">Loading full filtered network…</p>
      </div>
    );
  }

  if (state.error && !state.graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Full Network</h2>
        <p className="error">{state.error}</p>
      </div>
    );
  }

  if (!state.graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Full Network</h2>
        <p className="muted">Load a chromosome to render the full network.</p>
      </div>
    );
  }

  return (
    <div className="panel graph-panel">
      <h2>Full Network</h2>
      <TabHelpLegend
        summary="Global exploration view: inspect all visible bins and contacts together."
        items={[
          { label: "Node size", value: "Weighted degree + gene density" },
          {
            label: "Node color",
            value: state.colorMode === "community" ? "Community palette" : `${state.centralityMetric} centrality`,
          },
          { label: "Edge thickness", value: "Log-scaled Hi-C contact weight" },
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
          <span className="muted">Edges</span>
          <div className="inline-toggle">
            <button
              type="button"
              className={edgeFilterMode === "all" ? "toggle-chip is-active" : "toggle-chip"}
              onClick={() => setEdgeFilterMode("all")}
            >
              All
            </button>
            <button
              type="button"
              className={edgeFilterMode === "strongest" ? "toggle-chip is-active" : "toggle-chip"}
              onClick={() => setEdgeFilterMode("strongest")}
            >
              Strongest
            </button>
            <button
              type="button"
              className={edgeFilterMode === "topk" ? "toggle-chip is-active" : "toggle-chip"}
              onClick={() => setEdgeFilterMode("topk")}
            >
              Top-k / node
            </button>
          </div>
        </div>

        {edgeFilterMode === "topk" ? (
          <label className="inline-control">
            <span className="muted">k</span>
            <input
              type="number"
              min={1}
              max={12}
              value={topKNeighbors}
              onChange={(event) => {
                const value = Number(event.target.value);
                setTopKNeighbors(Number.isFinite(value) ? Math.max(1, Math.min(12, value)) : 3);
              }}
            />
          </label>
        ) : null}

        <label className="inline-control checkbox-control">
          <input type="checkbox" checked={showEdgeLabels} onChange={(event) => setShowEdgeLabels(event.target.checked)} />
          <span className="muted">Edge labels</span>
        </label>

        <button type="button" onClick={handleResetLayout}>
          Reset layout / fit
        </button>
      </div>

      <div className="full-network-meta muted">
        Showing {visibleNodeCount} nodes · {visibleEdgeCount} edges
      </div>

      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%" }}
        className="graph-canvas"
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
