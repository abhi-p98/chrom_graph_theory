import type { CentralityMetric, ColorMode, CommunitySummary, GeneOverlayMode } from "../types";
import { getCentralityGradientCss, getCommunityColor } from "../utils/color";
import { GeneSearch } from "./GeneSearch";

type ControlPanelProps = {
  chromosome: string;
  onChromosomeChange: (chromosome: string) => void;
  loading: boolean;
  centralityMetric: CentralityMetric;
  onCentralityMetricChange: (metric: CentralityMetric) => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  selectedCommunityId: number | null;
  onSelectedCommunityIdChange: (communityId: number | null) => void;
  onResetSelectedCommunity: () => void;
  geneOverlayMode: GeneOverlayMode;
  onGeneOverlayModeChange: (mode: GeneOverlayMode) => void;
  communities: CommunitySummary[];
  geneQuery: string;
  onGeneQueryChange: (query: string) => void;
  geneResults: string[];
  geneSearchLoading: boolean;
  onSelectGeneSuggestion: (gene: string) => void;
  sourceGene: string;
  targetGene: string;
  sourceGeneSuggestions: string[];
  targetGeneSuggestions: string[];
  onSourceGeneChange: (gene: string) => void;
  onTargetGeneChange: (gene: string) => void;
  onSourceGeneSuggestionSelect: (gene: string) => void;
  onTargetGeneSuggestionSelect: (gene: string) => void;
  onLoadChromosome: () => void;
  onSearchGenes: (selectedGene?: string) => void | Promise<string | null>;
  onSearchGenesInLocalView: (selectedGene?: string) => void | Promise<string | null>;
  onRunShortestPath: () => void;
  onResetSelectedNode: () => void;
  onResetSelectedGene: () => void;
  onResetShortestPath: () => void;
  onResetView: () => void;
  onResetSelections: () => void;
  onExportSelectedNode: () => void;
  hasSelectedNode: boolean;
  hasSelectedGene: boolean;
  hasSelectedCommunity: boolean;
  hasShortestPath: boolean;
};

export function ControlPanel({
  chromosome,
  onChromosomeChange,
  loading,
  centralityMetric,
  onCentralityMetricChange,
  colorMode,
  onColorModeChange,
  selectedCommunityId,
  onSelectedCommunityIdChange,
  onResetSelectedCommunity,
  geneOverlayMode,
  onGeneOverlayModeChange,
  communities,
  geneQuery,
  onGeneQueryChange,
  geneResults,
  geneSearchLoading,
  onSelectGeneSuggestion,
  sourceGene,
  targetGene,
  sourceGeneSuggestions,
  targetGeneSuggestions,
  onSourceGeneChange,
  onTargetGeneChange,
  onSourceGeneSuggestionSelect,
  onTargetGeneSuggestionSelect,
  onLoadChromosome,
  onSearchGenes,
  onSearchGenesInLocalView,
  onRunShortestPath,
  onResetSelectedNode,
  onResetSelectedGene,
  onResetShortestPath,
  onResetView,
  onResetSelections,
  onExportSelectedNode,
  hasSelectedNode,
  hasSelectedGene,
  hasSelectedCommunity,
  hasShortestPath,
}: ControlPanelProps) {
  return (
    <section className="panel control-panel">
      <h2>Controls</h2>
      {loading ? <p className="status-chip">Loading data…</p> : null}

      <label htmlFor="chromosome-input">Chromosome</label>
      <input id="chromosome-input" value={chromosome} onChange={(event) => onChromosomeChange(event.target.value)} />

      <button onClick={onLoadChromosome} disabled={loading}>
        {loading ? "Loading..." : "Load Graph"}
      </button>

      <label htmlFor="centrality-select">Centrality metric</label>
      <select
        id="centrality-select"
        value={centralityMetric}
        onChange={(event) => onCentralityMetricChange(event.target.value as CentralityMetric)}
      >
        <option value="degree">Weighted degree</option>
        <option value="betweenness">Betweenness</option>
        <option value="closeness">Closeness</option>
      </select>

      <label htmlFor="color-select">Node coloring mode</label>
      <select id="color-select" value={colorMode} onChange={(event) => onColorModeChange(event.target.value as ColorMode)}>
        <option value="community">Community</option>
        <option value="centrality">Centrality</option>
      </select>

      <div className="legend-block" aria-live="polite">
        <p className="muted" style={{ marginBottom: "0.35rem" }}>
          Legend
        </p>
        {colorMode === "centrality" ? (
          <>
            <div className="gradient-legend" style={{ background: getCentralityGradientCss() }} />
            <div className="legend-scale">
              <span>Low</span>
              <span>{centralityMetric === "degree" ? "Weighted degree" : centralityMetric}</span>
              <span>High</span>
            </div>
          </>
        ) : (
          <div className="community-legend-list">
            {communities.slice(0, 6).map((community) => (
              <div key={community.community_id} className="community-legend-item">
                <span
                  className="community-chip"
                  style={{ background: getCommunityColor(community.community_id) }}
                  aria-hidden="true"
                />
                <span>
                  #{community.community_id} ({community.node_count})
                </span>
              </div>
            ))}
            {communities.length > 6 ? <p className="muted">…and {communities.length - 6} more communities</p> : null}
          </div>
        )}

        <div className="path-legend-row">
          <span className="path-node-chip" aria-hidden="true" />
          <span className="muted">Path node</span>
          <span className="path-edge-line" aria-hidden="true" />
          <span className="muted">Path edge</span>
        </div>
      </div>

  <label htmlFor="community-select">Community focus</label>
      <select
        id="community-select"
        value={selectedCommunityId ?? "all"}
        onChange={(event) =>
          onSelectedCommunityIdChange(event.target.value === "all" ? null : Number(event.target.value))
        }
      >
  <option value="all">All communities (no focus)</option>
        {communities.map((community) => (
          <option key={community.community_id} value={community.community_id}>
            #{community.community_id} ({community.node_count} nodes)
          </option>
        ))}
      </select>

      <button type="button" onClick={onResetSelectedCommunity} disabled={selectedCommunityId === null}>
        Reset selected community
      </button>

      <div className="selection-reset-grid">
        <button type="button" className="mini-suggestion-item" onClick={onResetSelectedNode} disabled={!hasSelectedNode}>
          Reset node
        </button>
        <button type="button" className="mini-suggestion-item" onClick={onResetSelectedGene} disabled={!hasSelectedGene}>
          Reset gene
        </button>
        <button
          type="button"
          className="mini-suggestion-item"
          onClick={onResetSelectedCommunity}
          disabled={!hasSelectedCommunity}
        >
          Reset community
        </button>
        <button
          type="button"
          className="mini-suggestion-item"
          onClick={onResetShortestPath}
          disabled={!hasShortestPath}
        >
          Reset shortest path
        </button>
      </div>

      <label htmlFor="gene-overlay-select">Gene overlay</label>
      <select
        id="gene-overlay-select"
        value={geneOverlayMode}
        onChange={(event) => onGeneOverlayModeChange(event.target.value as GeneOverlayMode)}
      >
        <option value="all">Show all bins</option>
        <option value="only">Show only bins containing genes</option>
        <option value="emphasize">Emphasize bins containing genes</option>
      </select>

      <hr />

      <GeneSearch
        query={geneQuery}
        suggestions={geneResults}
        loading={geneSearchLoading}
        onQueryChange={onGeneQueryChange}
        onSelectGene={onSelectGeneSuggestion}
        onSearch={onSearchGenes}
        onOpenInLocalView={onSearchGenesInLocalView}
      />

      <h3>Shortest path between genes</h3>

      <label htmlFor="gene-a-input">Gene A</label>
      <input
        id="gene-a-input"
        value={sourceGene}
        placeholder="Source gene"
        onChange={(event) => onSourceGeneChange(event.target.value)}
      />
      {sourceGeneSuggestions.length > 0 ? (
        <ul className="mini-suggestion-list">
          {sourceGeneSuggestions.slice(0, 5).map((gene) => (
            <li key={`source-${gene}`}>
              <button
                type="button"
                className="mini-suggestion-item"
                onClick={() => onSourceGeneSuggestionSelect(gene)}
              >
                {gene}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label htmlFor="gene-b-input">Gene B</label>
      <input
        id="gene-b-input"
        value={targetGene}
        placeholder="Target gene"
        onChange={(event) => onTargetGeneChange(event.target.value)}
      />
      {targetGeneSuggestions.length > 0 ? (
        <ul className="mini-suggestion-list">
          {targetGeneSuggestions.slice(0, 5).map((gene) => (
            <li key={`target-${gene}`}>
              <button
                type="button"
                className="mini-suggestion-item"
                onClick={() => onTargetGeneSuggestionSelect(gene)}
              >
                {gene}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button onClick={onRunShortestPath} disabled={loading || !sourceGene.trim() || !targetGene.trim()}>
        Find shortest path
      </button>

      <hr />

      <div className="control-actions-row">
        <button type="button" onClick={onResetView}>
          Reset view
        </button>
        <button type="button" onClick={onResetSelections}>
          Reset selections
        </button>
      </div>

      <button type="button" onClick={onExportSelectedNode} disabled={!hasSelectedNode}>
        Export selected node JSON
      </button>
    </section>
  );
}
