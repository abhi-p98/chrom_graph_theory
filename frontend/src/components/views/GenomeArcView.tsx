import { useVisualizationState } from "../../context/VisualizationContext";
import { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import { buildGenomeArcElements, type ArcFilterMode } from "../../utils/genomeArcElements";
import { getGenomeArcStylesheet } from "../../utils/genomeArcStyles";
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
  zoom: (zoomLevel?: number) => number;
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

const LABEL_ZOOM_THRESHOLD = 1.6;
const DEFAULT_STRONGEST_RATIO = 0.2;

function formatDistance(distance: number): string {
  if (!Number.isFinite(distance)) {
    return "n/a";
  }
  if (distance >= 1_000_000) {
    return `${(distance / 1_000_000).toFixed(2)} Mb`;
  }
  if (distance >= 1_000) {
    return `${(distance / 1_000).toFixed(1)} kb`;
  }
  return `${Math.round(distance)} bp`;
}

export function GenomeArcView() {
  const state = useVisualizationState();
  const cyRef = useRef<CytoscapeInstance | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [arcFilterMode, setArcFilterMode] = useState<ArcFilterMode>("all");
  const [strongestRatio, setStrongestRatio] = useState<number>(DEFAULT_STRONGEST_RATIO);

  const arcBuild = useMemo(
    () =>
      buildGenomeArcElements({
        graph: state.graph,
        selectedNodeId: state.selectedNodeId,
        selectedCommunityId: state.selectedCommunityId,
        highlightedNodeIds: state.highlightedNodeIds,
        highlightedEdgeIds: state.highlightedEdgeIds,
        colorMode: state.colorMode,
        centralityMetric: state.centralityMetric,
        geneOverlayMode: state.geneOverlayMode,
        hoveredNodeId,
        arcFilterMode,
        strongestRatio,
      }),
    [
      arcFilterMode,
      hoveredNodeId,
      strongestRatio,
      state.centralityMetric,
      state.colorMode,
      state.geneOverlayMode,
      state.graph,
      state.highlightedEdgeIds,
      state.highlightedNodeIds,
      state.selectedCommunityId,
      state.selectedNodeId,
    ],
  );

  const stylesheet = useMemo(() => getGenomeArcStylesheet(), []);

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
      zoom: 2.1,
      duration: 320,
    });
  }, [state.focusRequestId, state.focusedNodeId]);

  useEffect(() => {
    if (!state.selectedGene || !state.selectedNodeId || !cyRef.current) {
      return;
    }
    const cy = cyRef.current;
    const target = cy.getElementById(state.selectedNodeId);
    if (target.length === 0) {
      return;
    }
    cy.animate({
      center: { eles: target },
      zoom: 2.4,
      duration: 260,
    });
  }, [state.selectedGene, state.selectedNodeId]);

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

  const hoveredEdge = useMemo(() => {
    if (!hoveredEdgeId || !state.graph) {
      return null;
    }
    return state.graph.edges.find((edge) => edge.data.id === hoveredEdgeId)?.data ?? null;
  }, [hoveredEdgeId, state.graph]);

  function handleZoom(delta: number) {
    if (!cyRef.current) {
      return;
    }
    const cy = cyRef.current;
    const current = cy.zoom();
    const nextZoom = Math.max(0.2, Math.min(7, current + delta));
    cy.animate({ zoom: nextZoom, duration: 180 });
  }

  function handleFitView() {
    if (!cyRef.current) {
      return;
    }
    cyRef.current.fit(undefined, 30);
  }

  if (state.loading) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Genome Arc View</h2>
        <p className="muted">Loading genomic arc visualization…</p>
      </div>
    );
  }

  if (state.error && !state.graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Genome Arc View</h2>
        <p className="error">{state.error}</p>
      </div>
    );
  }

  if (!state.graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Genome Arc View</h2>
        <p className="muted">Load a chromosome to render the arc diagram.</p>
      </div>
    );
  }

  return (
    <div className="panel graph-panel">
      <h2>Genome Arc View</h2>
      <TabHelpLegend
        summary="Genomic-order view: nodes are laid out left→right by position, arcs show chromatin contacts."
        items={[
          { label: "Genomic order", value: "Left to right follows start coordinate" },
          { label: "Arc meaning", value: "Each arc = interaction between two bins" },
          { label: "Arc encoding", value: "Higher/warmer arcs indicate longer-range contacts" },
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
          <span className="muted">Arcs</span>
          <div className="inline-toggle">
            <button
              type="button"
              className={arcFilterMode === "all" ? "toggle-chip is-active" : "toggle-chip"}
              onClick={() => setArcFilterMode("all")}
            >
              All
            </button>
            <button
              type="button"
              className={arcFilterMode === "strongest" ? "toggle-chip is-active" : "toggle-chip"}
              onClick={() => setArcFilterMode("strongest")}
            >
              Strongest only
            </button>
            <button
              type="button"
              className={arcFilterMode === "path" ? "toggle-chip is-active" : "toggle-chip"}
              onClick={() => setArcFilterMode("path")}
            >
              Path only
            </button>
            <button
              type="button"
              className={arcFilterMode === "neighborhood" ? "toggle-chip is-active" : "toggle-chip"}
              onClick={() => setArcFilterMode("neighborhood")}
            >
              Selected neighborhood
            </button>
          </div>
        </div>

        {arcFilterMode === "strongest" ? (
          <label className="inline-control">
            <span className="muted">Top %</span>
            <input
              type="number"
              min={5}
              max={80}
              value={Math.round(strongestRatio * 100)}
              onChange={(event) => {
                const value = Number(event.target.value);
                const clamped = Number.isFinite(value) ? Math.max(5, Math.min(80, value)) : 20;
                setStrongestRatio(clamped / 100);
              }}
            />
          </label>
        ) : null}

        <div className="inline-toggle">
          <button type="button" className="toggle-chip" onClick={() => handleZoom(0.28)}>
            Zoom +
          </button>
          <button type="button" className="toggle-chip" onClick={() => handleZoom(-0.28)}>
            Zoom -
          </button>
          <button type="button" className="toggle-chip" onClick={handleFitView}>
            Fit
          </button>
        </div>
      </div>

      <div className="full-network-meta muted">
        Ordered by genomic start · {arcBuild.nodeCount} nodes · {arcBuild.edgeCount} arcs · {arcBuild.longRangeCount} long-range
      </div>

      {arcFilterMode === "path" && !state.shortestPath ? (
        <p className="muted arc-view-note">Path-only filter active: run shortest path to show connecting arcs.</p>
      ) : null}
      {arcFilterMode === "neighborhood" && !state.selectedNodeId ? (
        <p className="muted arc-view-note">Neighborhood-only filter active: select a node or gene to focus its local arcs.</p>
      ) : null}
      {state.selectedGene && state.selectedNodeId ? (
        <p className="muted arc-view-note">
          Focused on selected gene <strong>{state.selectedGene}</strong> at node <strong>{state.selectedNodeId}</strong>.
        </p>
      ) : null}

      <div className="arc-baseline" aria-hidden="true" />
      <CytoscapeComponent
        elements={arcBuild.elements}
        style={{ width: "100%" }}
        className="graph-canvas"
        layout={{ name: "preset", fit: true, padding: 24 }}
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
            state.onNodeSelect(String(event.target.id()));
          });

          cy.on("mouseover", "node", (event: CytoscapeTapEvent) => {
            setHoveredNodeId(String(event.target.id()));
          });

          cy.on("mouseout", "node", () => {
            setHoveredNodeId(null);
          });

          cy.on("mouseover", "edge", (event: CytoscapeTapEvent) => {
            setHoveredEdgeId(String(event.target.id()));
          });

          cy.on("mouseout", "edge", () => {
            setHoveredEdgeId(null);
          });
        }}
        userZoomingEnabled
        userPanningEnabled
        minZoom={0.2}
        maxZoom={7}
        wheelSensitivity={0.2}
      />

      {hoveredEdge ? (
        <div className="graph-tooltip">
          <strong>Arc {hoveredEdge.id}</strong>
          <p className="muted">
            {hoveredEdge.source} → {hoveredEdge.target}
          </p>
          <p className="muted">Contact weight {hoveredEdge.weight.toFixed(3)}</p>
          <p className="muted">Genomic distance {formatDistance(hoveredEdge.distance)}</p>
        </div>
      ) : hoveredNode ? (
        <div className="graph-tooltip">
          <strong>{hoveredNode.label || hoveredNode.id}</strong>
          <p className="muted">{hoveredNode.id}</p>
          <p className="muted">
            Position {hoveredNode.start.toLocaleString()} - {hoveredNode.end.toLocaleString()}
          </p>
        </div>
      ) : null}
    </div>
  );
}
