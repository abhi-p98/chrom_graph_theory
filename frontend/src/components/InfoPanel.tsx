import type {
  CommunitySummary,
  GraphArtifactResponse,
  GraphNodeData,
  ShortestPathResponse,
} from "../types/graph";
import type { VisualizationTab } from "../types/visualization";

type InfoPanelProps = {
  graph: GraphArtifactResponse | null;
  selectedNode: GraphNodeData | null;
  selectedCommunity: CommunitySummary | null;
  shortestPath: ShortestPathResponse | null;
  activeTab: VisualizationTab;
  localCenterNodeId: string | null;
  localImmediateNeighborCount: number;
  pathError: string | null;
  error: string | null;
};

export function InfoPanel({
  graph,
  selectedNode,
  selectedCommunity,
  shortestPath,
  activeTab,
  localCenterNodeId,
  localImmediateNeighborCount,
  pathError,
  error,
}: InfoPanelProps) {
  const tabSummary =
    activeTab === "full-network"
      ? "Full Network: global exploration of all visible bins and interactions."
      : activeTab === "genome-arc"
        ? "Genome Arc View: nodes ordered by genomic position with long-range contact arcs."
        : activeTab === "community-summary"
          ? "Community Summary View: supernode modules and inter-community connectivity."
          : "Local Graph View: focused ego neighborhood around current local center.";

  const localCenterNode =
    localCenterNodeId && graph ? graph.nodes.find((node) => node.data.id === localCenterNodeId)?.data ?? null : null;

  return (
    <section className="panel info-panel">
      <h2>Details</h2>
      {error ? <p className="error">{error}</p> : null}

      {!graph ? (
        <p className="muted">No graph loaded yet.</p>
      ) : (
        <>
          <h3>Active view</h3>
          <p className="muted" style={{ marginTop: "0.1rem", marginBottom: "0.55rem" }}>
            {tabSummary}
          </p>

          <h3>Graph summary</h3>
          <ul>
            <li>Chromosome: {graph.meta?.chromosome ?? "unknown"}</li>
            <li>Nodes: {graph.nodes.length}</li>
            <li>Edges: {graph.edges.length}</li>
          </ul>

          <h3>Selected node</h3>
          {selectedNode ? (
            <>
              <ul>
                <li>ID: {selectedNode.id}</li>
                <li>Chromosome: {selectedNode.chromosome}</li>
                <li>
                  Genomic interval: {selectedNode.start.toLocaleString()} - {selectedNode.end.toLocaleString()}
                </li>
                <li>Weighted degree: {selectedNode.degree_raw.toFixed(2)}</li>
                <li>Weighted degree (norm): {selectedNode.degree_norm.toFixed(4)}</li>
                <li>Betweenness (norm): {selectedNode.betweenness_norm.toFixed(4)}</li>
                <li>Closeness (norm): {selectedNode.closeness_norm.toFixed(4)}</li>
                <li>Community ID: {selectedNode.community_id}</li>
                <li>Gene count: {selectedNode.gene_count}</li>
              </ul>

              <p className="muted" style={{ marginTop: "0.5rem" }}>
                Gene list
              </p>
              {selectedNode.genes.length > 0 ? (
                <div className="gene-pill-list">
                  {selectedNode.genes.map((gene) => (
                    <span key={gene} className="gene-pill">
                      {gene}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">No genes mapped to this bin.</p>
              )}
            </>
          ) : (
            <p className="muted">Click a node in the graph to inspect it.</p>
          )}

          <h3>Selected community</h3>
          {selectedCommunity ? (
            <ul>
              <li>Community ID: {selectedCommunity.community_id}</li>
              <li>Node count: {selectedCommunity.node_count}</li>
              <li>Edges: {selectedCommunity.edge_count}</li>
              <li>Gene count: {selectedCommunity.gene_count}</li>
              <li>Average centrality (degree): {selectedCommunity.avg_weighted_degree.toFixed(4)}</li>
              <li>Average centrality (betweenness): {selectedCommunity.avg_betweenness.toFixed(4)}</li>
              <li>Average centrality (closeness): {selectedCommunity.avg_closeness.toFixed(4)}</li>
            </ul>
          ) : (
            <p className="muted">No community filter selected.</p>
          )}

          <h3>Shortest path</h3>
          {pathError ? <p className="error">{pathError}</p> : null}
          {shortestPath ? (
            <ul>
              <li>Source gene: {shortestPath.source_gene}</li>
              <li>Target gene: {shortestPath.target_gene}</li>
              <li>Source node: {shortestPath.source_node}</li>
              <li>Target node: {shortestPath.target_node}</li>
              <li>Hop count: {shortestPath.hop_count}</li>
              <li>Total distance: {shortestPath.total_distance.toExponential(4)}</li>
            </ul>
          ) : (
            <p className="muted">Run path search to view results.</p>
          )}

          {activeTab === "local-graph" ? (
            <>
              <h3>Local graph focus</h3>
              {localCenterNode ? (
                <>
                  <ul>
                    <li>Center node: {localCenterNode.id}</li>
                    <li>Immediate neighbors: {localImmediateNeighborCount}</li>
                    <li>Community ID: {localCenterNode.community_id}</li>
                    <li>Weighted degree (norm): {localCenterNode.degree_norm.toFixed(4)}</li>
                    <li>Gene count: {localCenterNode.gene_count}</li>
                  </ul>

                  <p className="muted" style={{ marginTop: "0.5rem" }}>
                    Center node genes
                  </p>
                  {localCenterNode.genes.length > 0 ? (
                    <div className="gene-pill-list">
                      {localCenterNode.genes.map((gene) => (
                        <span key={`local-center-${gene}`} className="gene-pill">
                          {gene}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No genes mapped to local center node.</p>
                  )}
                </>
              ) : (
                <p className="muted">Select a node or gene to initialize local focus.</p>
              )}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
