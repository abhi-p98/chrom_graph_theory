export type GraphMeta = {
  chromosome: string;
  hic_file: string;
  gene_file: string;
  community_method: string;
  community_modularity: number | null;
  mapped_genes: number;
  unmapped_genes: number;
  bins_with_genes: number;
  node_count: number;
  edge_count: number;
};

export type GraphNodeData = {
  id: string;
  label: string;
  chromosome: string;
  start: number;
  end: number;
  degree_raw: number;
  degree_norm: number;
  betweenness_raw: number;
  betweenness_norm: number;
  closeness_raw: number;
  closeness_norm: number;
  community_id: number;
  gene_count: number;
  genes: string[];
};

export type GraphEdgeData = {
  id: string;
  source: string;
  target: string;
  weight: number;
  distance: number;
};

export type GraphNodeElement = {
  data: GraphNodeData;
};

export type GraphEdgeElement = {
  data: GraphEdgeData;
};

export type GraphArtifactResponse = {
  meta?: GraphMeta;
  nodes: GraphNodeElement[];
  edges: GraphEdgeElement[];
};

export type CommunitySummary = {
  community_id: number;
  node_count: number;
  edge_count: number;
  avg_weighted_degree: number;
  avg_betweenness: number;
  avg_closeness: number;
  gene_count: number;
};

export type GeneLookupResponse = {
  chromosome: string;
  query?: string | null;
  total_genes: number;
  lookup: Record<string, string[]>;
};

export type NodeDetailResponse = {
  chromosome: string;
  node: GraphNodeData;
};

export type PathEdge = {
  id: string;
  source: string;
  target: string;
  weight: number;
  distance: number;
};

export type ShortestPathResponse = {
  source_gene: string;
  target_gene: string;
  source_node: string;
  target_node: string;
  path_nodes: string[];
  path_edges: PathEdge[];
  total_distance: number;
  hop_count: number;
};

export type CentralityMetric = "degree" | "betweenness" | "closeness";
export type ColorMode = "centrality" | "community";
export type GeneOverlayMode = "all" | "only" | "emphasize";

export type CytoscapeElement = {
  data: Record<string, string | number | null | string[] | undefined>;
  position?: {
    x: number;
    y: number;
  };
};
