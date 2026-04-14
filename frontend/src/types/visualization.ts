import type {
  CentralityMetric,
  ColorMode,
  CommunitySummary,
  GeneOverlayMode,
  GraphArtifactResponse,
  GraphNodeData,
  ShortestPathResponse,
} from "./graph";

export type VisualizationTab =
  | "full-network"
  | "genome-arc"
  | "community-summary"
  | "local-graph";

export type VisualizationStateModel = {
  activeTab: VisualizationTab;
  setActiveTab: (tab: VisualizationTab) => void;
  graph: GraphArtifactResponse | null;
  communities: CommunitySummary[];
  centralityMetric: CentralityMetric;
  colorMode: ColorMode;
  geneOverlayMode: GeneOverlayMode;
  selectedNodeId: string | null;
  selectedNodeDetail: GraphNodeData | null;
  selectedGene: string | null;
  selectedCommunityId: number | null;
  shortestPath: ShortestPathResponse | null;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  focusedNodeId: string | null;
  focusRequestId: number;
  resetViewRequestId: number;
  localCenterNodeId: string | null;
  localImmediateNeighborCount: number;
  loading: boolean;
  error: string | null;
  pathError: string | null;
  onNodeSelect: (nodeId: string) => void;
  onCommunitySelect: (communityId: number) => void;
  onCommunityDrillDown: (communityId: number) => void;
  onLocalGraphCenterChange: (nodeId: string | null, immediateNeighborCount: number) => void;
  onResetHighlights: () => void;
};
