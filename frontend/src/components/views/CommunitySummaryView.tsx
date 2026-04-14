import { useVisualizationState } from "../../context/VisualizationContext";
import { useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import {
  buildCommunitySummaryGraph,
  type CommunityEdgeWeightMode,
  type CommunityNodeColorMetric,
} from "../../utils/communitySummaryGraph";
import { getCommunitySummaryStylesheet } from "../../utils/communitySummaryStyles";
import { TabHelpLegend } from "./TabHelpLegend";
import { SelectionStatusBar } from "./SelectionStatusBar";

type CytoscapeTapEvent = {
  target: {
    id: () => string;
    data: (key: string) => string | number | undefined;
  };
};

type CytoscapeInstance = {
  fit: (eles?: unknown, padding?: number) => void;
};

export function CommunitySummaryView() {
  const state = useVisualizationState();
  const cyRef = useRef<CytoscapeInstance | null>(null);
  const [hoveredCommunityId, setHoveredCommunityId] = useState<number | null>(null);
  const [nodeColorMetric, setNodeColorMetric] = useState<CommunityNodeColorMetric>("community");
  const [edgeWeightMode, setEdgeWeightMode] = useState<CommunityEdgeWeightMode>("total");
  const [showEdgeLabels, setShowEdgeLabels] = useState<boolean>(false);

  const graphBuild = useMemo(
    () =>
      buildCommunitySummaryGraph({
        graph: state.graph,
        selectedCommunityId: state.selectedCommunityId,
        highlightedNodeIds: state.highlightedNodeIds,
        highlightedEdgeIds: state.highlightedEdgeIds,
        colorMetric: nodeColorMetric,
        edgeWeightMode,
        showEdgeLabels,
      }),
    [
      edgeWeightMode,
      nodeColorMetric,
      showEdgeLabels,
      state.graph,
      state.highlightedEdgeIds,
      state.highlightedNodeIds,
      state.selectedCommunityId,
    ],
  );

  const stylesheet = useMemo(() => getCommunitySummaryStylesheet(), []);

  const hoveredAggregate = useMemo(() => {
    if (hoveredCommunityId === null) {
      return null;
    }
    return graphBuild.nodeAggregates.find((entry) => entry.communityId === hoveredCommunityId) ?? null;
  }, [graphBuild.nodeAggregates, hoveredCommunityId]);

  const selectedAggregate = useMemo(() => {
    if (state.selectedCommunityId === null) {
      return null;
    }
    return graphBuild.nodeAggregates.find((entry) => entry.communityId === state.selectedCommunityId) ?? null;
  }, [graphBuild.nodeAggregates, state.selectedCommunityId]);

  if (state.loading) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Community Summary View</h2>
        <p className="muted">Loading community supernode graph…</p>
      </div>
    );
  }

  if (state.error && !state.graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Community Summary View</h2>
        <p className="error">{state.error}</p>
      </div>
    );
  }

  if (!state.graph) {
    return (
      <div className="panel graph-panel graph-state">
        <h2>Community Summary View</h2>
        <p className="muted">Load a chromosome to render the community summary graph.</p>
      </div>
    );
  }

  return (
    <div className="panel graph-panel">
      <h2>Community Summary View</h2>
      <TabHelpLegend
        summary="Module-level view: each supernode is a detected community, edges aggregate cross-community interactions."
        items={[
          { label: "Supernode", value: "One node per community" },
          { label: "Supernode size", value: "Community size (or gene count mode)" },
          { label: "Superedge", value: "Aggregated inter-community Hi-C connectivity" },
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
        <label className="inline-control">
          <span className="muted">Node color</span>
          <select
            value={nodeColorMetric}
            onChange={(event) => setNodeColorMetric(event.target.value as CommunityNodeColorMetric)}
          >
            <option value="community">Stable community palette</option>
            <option value="gene_count">Gene count (low → high)</option>
            <option value="avg_degree">Avg degree centrality (low → high)</option>
          </select>
        </label>

        <label className="inline-control">
          <span className="muted">Edge aggregation</span>
          <select
            value={edgeWeightMode}
            onChange={(event) => setEdgeWeightMode(event.target.value as CommunityEdgeWeightMode)}
          >
            <option value="total">Total Hi-C interaction (Σ)</option>
            <option value="average">Average Hi-C interaction</option>
          </select>
        </label>

        <label className="inline-control checkbox-control">
          <input
            type="checkbox"
            checked={showEdgeLabels}
            onChange={(event) => setShowEdgeLabels(event.target.checked)}
          />
          <span className="muted">Edge labels</span>
        </label>

        <button
          type="button"
          onClick={() => {
            cyRef.current?.fit(undefined, 32);
          }}
        >
          Fit graph
        </button>
      </div>

      <div className="full-network-meta muted">
        {graphBuild.communityCount} supernodes · {graphBuild.interCommunityEdgeCount} inter-community edges
      </div>

      <CytoscapeComponent
        elements={graphBuild.elements}
        style={{ width: "100%" }}
        className="graph-canvas"
        layout={{
          name: "cose",
          animate: false,
          fit: true,
          padding: 30,
          componentSpacing: 80,
          nodeRepulsion: 11000,
          edgeElasticity: 90,
        }}
        stylesheet={stylesheet}
        cy={(cy: CytoscapeInstance & {
          removeAllListeners: (eventName: string) => void;
          on: {
            (eventName: string, selector: string, handler: (event: CytoscapeTapEvent) => void): void;
            (eventName: string, selector: string, handler: () => void): void;
          };
        }) => {
          cyRef.current = cy;
          cy.removeAllListeners("tap");
          cy.removeAllListeners("mouseover");
          cy.removeAllListeners("mouseout");

          cy.on("tap", "node", (event: CytoscapeTapEvent) => {
            const communityId = Number(event.target.data("communityId"));
            if (Number.isFinite(communityId)) {
              state.onCommunitySelect(communityId);
            }
          });

          cy.on("mouseover", "node", (event: CytoscapeTapEvent) => {
            const communityId = Number(event.target.data("communityId"));
            if (Number.isFinite(communityId)) {
              setHoveredCommunityId(communityId);
            }
          });

          cy.on("mouseout", "node", () => {
            setHoveredCommunityId(null);
          });
        }}
        userZoomingEnabled
        userPanningEnabled
        minZoom={0.2}
        maxZoom={4}
        wheelSensitivity={0.2}
      />

      {selectedAggregate ? (
        <div className="panel" style={{ marginTop: "0.65rem", marginBottom: 0 }}>
          <h3 style={{ marginBottom: "0.45rem" }}>Selected community: C{selectedAggregate.communityId}</h3>
          <p className="muted" style={{ margin: "0.12rem 0" }}>
            Nodes {selectedAggregate.nodeCount} · Genes {selectedAggregate.geneCount}
          </p>
          <p className="muted" style={{ margin: "0.12rem 0" }}>
            Avg degree {selectedAggregate.avgDegree.toFixed(3)} · Avg betweenness {selectedAggregate.avgBetweenness.toFixed(3)}
          </p>
          <p className="muted" style={{ margin: "0.12rem 0 0.5rem" }}>
            Avg closeness {selectedAggregate.avgCloseness.toFixed(3)}
          </p>
          <button type="button" onClick={() => state.onCommunityDrillDown(selectedAggregate.communityId)}>
            Drill down in Full Network
          </button>
        </div>
      ) : null}

      {hoveredAggregate ? (
        <div className="graph-tooltip">
          <strong>Community C{hoveredAggregate.communityId}</strong>
          <p className="muted">
            {hoveredAggregate.nodeCount} bins · {hoveredAggregate.geneCount} genes
          </p>
          <p className="muted">Avg degree {hoveredAggregate.avgDegree.toFixed(3)}</p>
        </div>
      ) : null}
    </div>
  );
}
