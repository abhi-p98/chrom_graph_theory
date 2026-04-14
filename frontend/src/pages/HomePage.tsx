import { useEffect, useMemo, useState } from "react";
import { ControlPanel, InfoPanel, VisualizationTabSelector, VisualizationViewport } from "../components";
import { VisualizationProvider } from "../context/VisualizationContext";
import { graphApi, toErrorMessage } from "../services";
import type {
  CentralityMetric,
  ColorMode,
  CommunitySummary,
  GeneOverlayMode,
  GraphArtifactResponse,
  ShortestPathResponse,
  VisualizationStateModel,
  VisualizationTab,
} from "../types";

export function HomePage() {
  const [chromosome, setChromosome] = useState<string>("chr2");
  const [graph, setGraph] = useState<GraphArtifactResponse | null>(null);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [centralityMetric, setCentralityMetric] = useState<CentralityMetric>("degree");
  const [colorMode, setColorMode] = useState<ColorMode>("community");
  const [activeTab, setActiveTab] = useState<VisualizationTab>("full-network");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<GraphArtifactResponse["nodes"][number]["data"] | null>(null);
  const [geneOverlayMode, setGeneOverlayMode] = useState<GeneOverlayMode>("all");
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusRequestId, setFocusRequestId] = useState<number>(0);
  const [resetViewRequestId, setResetViewRequestId] = useState<number>(0);

  const [geneQuery, setGeneQuery] = useState<string>("");
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [geneResults, setGeneResults] = useState<string[]>([]);
  const [geneSearchLoading, setGeneSearchLoading] = useState<boolean>(false);
  const [sourceGene, setSourceGene] = useState<string>("");
  const [targetGene, setTargetGene] = useState<string>("");
  const [sourceGeneSuggestions, setSourceGeneSuggestions] = useState<string[]>([]);
  const [targetGeneSuggestions, setTargetGeneSuggestions] = useState<string[]>([]);
  const [shortestPath, setShortestPath] = useState<ShortestPathResponse | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);
  const [localCenterNodeId, setLocalCenterNodeId] = useState<string | null>(null);
  const [localImmediateNeighborCount, setLocalImmediateNeighborCount] = useState<number>(0);

  async function loadChromosomeData() {
    setLoading(true);
    setError(null);
    setPathError(null);
    setShortestPath(null);
    try {
      const [graphData, communityData] = await Promise.all([
        graphApi.getGraph(chromosome),
        graphApi.getCommunities(chromosome),
      ]);

      setGraph(graphData);
      setCommunities(communityData);

      const firstNode = graphData.nodes[0]?.data ?? null;
      setSelectedNodeId(firstNode?.id ?? null);
      setSelectedNodeDetail(firstNode);
      setSelectedCommunityId(null);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    const fallbackNode = graph?.nodes.find((node) => node.data.id === nodeId)?.data ?? null;
    setSelectedNodeDetail(fallbackNode);

    try {
      const detail = await graphApi.getNode(nodeId, chromosome);
      setSelectedNodeDetail(detail.node);
    } catch {
      // We already have a local fallback node.
    }
  }

  function handleSelectCommunity(communityId: number) {
    setSelectedCommunityId(communityId);
  }

  function handleCommunityDrillDown(communityId: number) {
    setSelectedCommunityId(communityId);
    setActiveTab("full-network");

    const representative =
      graph?.nodes
        .filter((node) => node.data.community_id === communityId)
        .sort((left, right) => right.data.degree_norm - left.data.degree_norm)[0]?.data ?? null;

    if (representative) {
      setFocusedNodeId(representative.id);
      setFocusRequestId((current) => current + 1);
    }
  }

  function handleResetSelectedCommunity() {
    setSelectedCommunityId(null);
  }

  function handleResetSelectedNode() {
    setSelectedNodeId(null);
    setSelectedNodeDetail(null);
    setFocusedNodeId(null);
    setLocalCenterNodeId(null);
  }

  function handleResetSelectedGene() {
    setSelectedGene(null);
    setGeneQuery("");
    setGeneResults([]);
  }

  function handleResetShortestPath() {
    setShortestPath(null);
    setPathError(null);
  }

  function handleResetHighlights() {
    setSelectedNodeId(null);
    setSelectedNodeDetail(null);
    setSelectedCommunityId(null);
    setShortestPath(null);
    setPathError(null);
    setFocusedNodeId(null);
    setLocalCenterNodeId(null);
    setLocalImmediateNeighborCount(0);
    setFocusRequestId((value) => value + 1);
  }

  function handleResetView() {
    setResetViewRequestId((value) => value + 1);
  }

  function handleResetSelections() {
    setSelectedNodeId(null);
    setSelectedNodeDetail(null);
    setSelectedCommunityId(null);
    setShortestPath(null);
    setPathError(null);
    setFocusedNodeId(null);
    setSourceGene("");
    setTargetGene("");
    setGeneQuery("");
    setSelectedGene(null);
    setGeneResults([]);
    setSourceGeneSuggestions([]);
    setTargetGeneSuggestions([]);
    setLocalCenterNodeId(null);
    setLocalImmediateNeighborCount(0);
    setFocusRequestId((value) => value + 1);
    handleResetView();
  }

  function handleExportSelectedNode() {
    if (!selectedNodeDetail) {
      return;
    }

    const content = JSON.stringify(selectedNodeDetail, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `node_${selectedNodeDetail.id.replace(/[:]/g, "_")}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  async function fetchGeneSuggestions(query: string) {
    if (!query.trim()) {
      setGeneResults([]);
      return;
    }

    setGeneSearchLoading(true);
    try {
      const result = await graphApi.getGenes({ chromosome, q: query.trim(), limit: 20 });
      const lookup = result.lookup;
      setGeneResults(Object.keys(lookup));
    } catch {
      setGeneResults([]);
    } finally {
      setGeneSearchLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchGeneSuggestions(geneQuery);
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [chromosome, geneQuery]);

  async function handleGeneSearch(selectedGeneOverride?: string): Promise<string | null> {
    setError(null);

    const requestedGene = (selectedGeneOverride ?? geneQuery).trim();
    if (!requestedGene) {
      return null;
    }

    setGeneSearchLoading(true);
    try {
      const response = await graphApi.getGenes({ chromosome, q: requestedGene, limit: 50 });
      const lookup = response.lookup;
      setGeneResults(Object.keys(lookup));

      const exactKey = Object.keys(lookup).find((gene) => gene.toLowerCase() === requestedGene.toLowerCase());
      const fallbackKey = Object.keys(lookup)[0];
      const geneKey = exactKey ?? fallbackKey;

      if (!geneKey) {
        setError(`No matching gene found for '${requestedGene}'.`);
        return null;
      }

      const nodeId = lookup[geneKey]?.[0];
      if (!nodeId) {
        setError(`Gene '${geneKey}' has no mapped graph bin.`);
        return null;
      }

      setGeneQuery(geneKey);
      setSelectedGene(geneKey);
      await handleSelectNode(nodeId);
      setFocusedNodeId(nodeId);
      setFocusRequestId((current) => current + 1);
      return nodeId;
    } catch (err) {
      setError(toErrorMessage(err));
      return null;
    } finally {
      setGeneSearchLoading(false);
    }
  }

  async function handleGeneSearchInLocalView(selectedGeneOverride?: string): Promise<string | null> {
    const nodeId = await handleGeneSearch(selectedGeneOverride);
    if (!nodeId) {
      return null;
    }
    setActiveTab("local-graph");
    return nodeId;
  }

  async function handleShortestPath() {
    if (!sourceGene.trim() || !targetGene.trim()) {
      setPathError("Please provide both Gene A and Gene B.");
      return;
    }

    setLoading(true);
    setError(null);
    setPathError(null);
    try {
      const result = await graphApi.getShortestPath({
        chromosome,
        gene1: sourceGene.trim(),
        gene2: targetGene.trim(),
      });
      setShortestPath(result);
      setFocusedNodeId(result.source_node);
      setFocusRequestId((current) => current + 1);
    } catch (err) {
      setShortestPath(null);
      setPathError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function fetchPathGeneSuggestions(query: string): Promise<string[]> {
    if (!query.trim()) {
      return [];
    }

    try {
      const result = await graphApi.getGenes({ chromosome, q: query.trim(), limit: 8 });
      return Object.keys(result.lookup);
    } catch {
      return [];
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const suggestions = await fetchPathGeneSuggestions(sourceGene);
        setSourceGeneSuggestions(suggestions);
      })();
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [chromosome, sourceGene]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const suggestions = await fetchPathGeneSuggestions(targetGene);
        setTargetGeneSuggestions(suggestions);
      })();
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [chromosome, targetGene]);

  const highlightedNodes = useMemo(() => {
    if (!shortestPath) {
      return new Set<string>();
    }
    return new Set<string>(shortestPath.path_nodes);
  }, [shortestPath]);

  const highlightedEdges = useMemo(() => {
    if (!shortestPath) {
      return new Set<string>();
    }
    return new Set<string>(shortestPath.path_edges.map((edge) => edge.id));
  }, [shortestPath]);

  const visualizationState = useMemo<VisualizationStateModel>(
    () => ({
      activeTab,
      setActiveTab,
      graph,
      communities,
      centralityMetric,
      colorMode,
      geneOverlayMode,
      selectedNodeId,
      selectedNodeDetail,
      selectedGene,
      selectedCommunityId,
      shortestPath,
      highlightedNodeIds: highlightedNodes,
      highlightedEdgeIds: highlightedEdges,
      focusedNodeId,
      focusRequestId,
      resetViewRequestId,
  localCenterNodeId,
  localImmediateNeighborCount,
      loading,
      error,
      pathError,
      onNodeSelect: (nodeId: string) => {
        void handleSelectNode(nodeId);
      },
      onCommunitySelect: (communityId: number) => {
        handleSelectCommunity(communityId);
      },
      onCommunityDrillDown: (communityId: number) => {
        handleCommunityDrillDown(communityId);
      },
      onLocalGraphCenterChange: (nodeId: string | null, immediateNeighborCount: number) => {
        setLocalCenterNodeId(nodeId);
        setLocalImmediateNeighborCount(immediateNeighborCount);
      },
      onResetHighlights: () => {
        handleResetHighlights();
      },
    }),
    [
      activeTab,
      centralityMetric,
      colorMode,
      communities,
      error,
      focusedNodeId,
      focusRequestId,
      geneOverlayMode,
      graph,
      highlightedEdges,
      highlightedNodes,
      loading,
  localCenterNodeId,
  localImmediateNeighborCount,
      pathError,
      resetViewRequestId,
      selectedCommunityId,
      selectedGene,
      selectedNodeDetail,
      selectedNodeId,
      shortestPath,
    ],
  );

  return (
    <main className="app-shell">
      <header>
        <h1>Chromosome Hi-C Graph Explorer</h1>
        <p className="muted">Artifact-backed interactive graph exploration with centrality, communities, and gene paths.</p>
      </header>

      <VisualizationProvider value={visualizationState}>
        <div className="layout layout-3col">
          <aside className="column-panel">
            <ControlPanel
              chromosome={chromosome}
              onChromosomeChange={setChromosome}
              loading={loading}
              centralityMetric={centralityMetric}
              onCentralityMetricChange={setCentralityMetric}
              colorMode={colorMode}
              onColorModeChange={setColorMode}
              selectedCommunityId={selectedCommunityId}
              onSelectedCommunityIdChange={setSelectedCommunityId}
              onResetSelectedCommunity={handleResetSelectedCommunity}
              geneOverlayMode={geneOverlayMode}
              onGeneOverlayModeChange={setGeneOverlayMode}
              communities={communities}
              geneQuery={geneQuery}
              onGeneQueryChange={setGeneQuery}
              geneResults={geneResults}
              geneSearchLoading={geneSearchLoading}
              onSelectGeneSuggestion={setGeneQuery}
              sourceGene={sourceGene}
              targetGene={targetGene}
              sourceGeneSuggestions={sourceGeneSuggestions}
              targetGeneSuggestions={targetGeneSuggestions}
              onSourceGeneChange={setSourceGene}
              onTargetGeneChange={setTargetGene}
              onSourceGeneSuggestionSelect={setSourceGene}
              onTargetGeneSuggestionSelect={setTargetGene}
              onLoadChromosome={loadChromosomeData}
              onSearchGenes={handleGeneSearch}
              onSearchGenesInLocalView={handleGeneSearchInLocalView}
              onRunShortestPath={handleShortestPath}
              onResetSelectedNode={handleResetSelectedNode}
              onResetSelectedGene={handleResetSelectedGene}
              onResetShortestPath={handleResetShortestPath}
              onResetView={handleResetView}
              onResetSelections={handleResetSelections}
              onExportSelectedNode={handleExportSelectedNode}
              hasSelectedNode={Boolean(selectedNodeDetail)}
              hasSelectedGene={Boolean(selectedGene)}
              hasSelectedCommunity={selectedCommunityId !== null}
              hasShortestPath={Boolean(shortestPath)}
            />
          </aside>

          <section className="graph-column">
            <VisualizationTabSelector activeTab={activeTab} onChange={setActiveTab} />
            <VisualizationViewport activeTab={activeTab} />
          </section>

          <aside className="column-panel">
            <InfoPanel
              graph={graph}
              selectedNode={selectedNodeDetail}
              selectedCommunity={
                selectedCommunityId === null
                  ? null
                  : communities.find((community) => community.community_id === selectedCommunityId) ?? null
              }
              shortestPath={shortestPath}
              activeTab={activeTab}
              localCenterNodeId={localCenterNodeId}
              localImmediateNeighborCount={localImmediateNeighborCount}
              pathError={pathError}
              error={error}
            />
          </aside>
        </div>
      </VisualizationProvider>
    </main>
  );
}