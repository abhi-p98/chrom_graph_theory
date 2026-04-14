from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Dict, Optional

from app.config import settings
from app.models.schemas import Edge, GraphMetrics, GraphResponse, Node
from app.services.centrality import (
    attach_metrics_to_nodes,
    compute_betweenness,
    compute_closeness,
    compute_weighted_degree,
    save_node_metrics,
)
from app.services.communities import (
    attach_community_to_nodes,
    compute_community_summaries,
    detect_communities,
    save_community_outputs,
)
from app.services.gene_loader import GeneLoader
from app.services.gene_mapping import GeneMappingService
from app.services.graph_builder import GraphBuilder
from app.services.graph_filter_config import DEFAULT_WEB_FILTER_CONFIG
from app.services.hic_loader import HicLoader
from app.services.metrics import MetricsService


class GraphService:
    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.graph_builder = GraphBuilder()
        self.metrics_service = MetricsService()
        self.hic_loader = HicLoader(
            target_chromosome=settings.target_chromosome,
            remove_self_loops=settings.remove_self_loops,
        )
        self.gene_loader = GeneLoader(target_chromosome=settings.target_chromosome)
        self.gene_mapping_service = GeneMappingService()

    def list_available_chromosomes(self) -> list[str]:
        chromosome_to_file = self._discover_hic_files()
        return sorted(chromosome_to_file.keys(), key=self._chromosome_sort_key)

    def build_graph_from_files(self, chromosome: Optional[str] = None) -> GraphResponse:
        selected_chromosome = self._normalize_chromosome(chromosome or settings.target_chromosome)

        hic_loader = HicLoader(
            target_chromosome=selected_chromosome,
            remove_self_loops=settings.remove_self_loops,
        )
        gene_loader = GeneLoader(target_chromosome=selected_chromosome)

        hic_file_path = self._resolve_hic_file(selected_chromosome)

        hic_result = hic_loader.load(hic_file_path)
        gene_result = gene_loader.load(settings.gene_file_path)
        gene_mapping_result = self.gene_mapping_service.build_mappings(
            gene_df=gene_result.dataframe,
            target_chromosome=selected_chromosome,
            bin_size=settings.bin_size,
        )

        gene_to_bin_json = settings.outputs_dir / f"gene_to_bin_{selected_chromosome}.json"
        bin_to_genes_json = settings.outputs_dir / f"bin_to_genes_{selected_chromosome}.json"
        gene_lookup_json = settings.outputs_dir / f"gene_lookup_{selected_chromosome}.json"
        self.gene_mapping_service.save_mappings_json(
            mapping_result=gene_mapping_result,
            gene_to_bin_path=gene_to_bin_json,
            bin_to_genes_path=bin_to_genes_json,
            gene_lookup_path=gene_lookup_json,
        )

        graph_result = self.graph_builder.build_graph_from_dataframe(
            hic_result.dataframe,
            chromosome=selected_chromosome,
            bin_size=settings.bin_size,
            filter_config=DEFAULT_WEB_FILTER_CONFIG,
        )
        graph = graph_result.filtered_graph
        original_graph = graph_result.original_graph
        distance_graph = graph_result.distance_graph

        weighted_degree = compute_weighted_degree(original_graph)
        betweenness = compute_betweenness(distance_graph)
        closeness = compute_closeness(distance_graph)

        centrality_by_node = attach_metrics_to_nodes(
            original_graph,
            weighted_degree=weighted_degree,
            betweenness=betweenness,
            closeness=closeness,
        )

        filtered_centrality = {
            str(node_id): centrality_by_node.get(str(node_id), {})
            for node_id in graph.nodes
        }

        community_result = detect_communities(graph)
        attach_community_to_nodes(graph, community_result.node_to_community)

        node_has_gene = {}
        for node_id in graph.nodes:
            node_data = graph.nodes[node_id]
            bin_start = int(node_data.get("start", 0))
            bin_id = f"{selected_chromosome}:{bin_start}-{bin_start + settings.bin_size}"
            node_has_gene[str(node_id)] = len(gene_mapping_result.bin_to_genes.get(bin_id, [])) > 0

        community_summaries = compute_community_summaries(
            graph=graph,
            node_to_community=community_result.node_to_community,
            node_metrics=filtered_centrality,
            node_has_gene=node_has_gene,
        )

        csv_path = settings.outputs_dir / f"node_metrics_{selected_chromosome}.csv"
        json_path = settings.outputs_dir / f"node_metrics_{selected_chromosome}.json"
        save_node_metrics(filtered_centrality, output_csv_path=csv_path, output_json_path=json_path)

        community_node_csv = settings.outputs_dir / f"node_communities_{selected_chromosome}.csv"
        community_node_json = settings.outputs_dir / f"node_communities_{selected_chromosome}.json"
        community_summary_csv = settings.outputs_dir / f"community_summary_{selected_chromosome}.csv"
        community_summary_json = settings.outputs_dir / f"community_summary_{selected_chromosome}.json"
        save_community_outputs(
            node_to_community=community_result.node_to_community,
            community_summaries=community_summaries,
            node_csv_path=community_node_csv,
            node_json_path=community_node_json,
            summary_csv_path=community_summary_csv,
            summary_json_path=community_summary_json,
        )

        nodes = []
        for node_id in graph.nodes:
            node_data = graph.nodes[node_id]
            chromosome = str(node_data.get("chromosome", selected_chromosome))
            bin_start = int(node_data.get("start", 0))
            bin_end = int(node_data.get("end", bin_start + settings.bin_size))

            bin_id = f"{selected_chromosome}:{bin_start}-{bin_start + settings.bin_size}"
            genes = gene_mapping_result.bin_to_genes.get(bin_id, [])
            gene_name = genes[0] if genes else node_id
            expression = gene_mapping_result.bin_expression.get(bin_id)
            centrality = filtered_centrality.get(node_id, {})
            community_id = int(graph.nodes[node_id].get("community_id", -1))
            nodes.append(
                Node(
                    id=node_id,
                    label=gene_name,
                    chromosome=chromosome,
                    bin_start=bin_start,
                    bin_end=bin_end,
                    community_id=community_id,
                    gene_count=len(genes),
                    genes=genes,
                    expression=expression,
                    weighted_degree=float(centrality.get("weighted_degree", 0.0)),
                    weighted_degree_norm=float(centrality.get("weighted_degree_norm", 0.0)),
                    betweenness=float(centrality.get("betweenness", 0.0)),
                    betweenness_norm=float(centrality.get("betweenness_norm", 0.0)),
                    closeness=float(centrality.get("closeness", 0.0)),
                    closeness_norm=float(centrality.get("closeness_norm", 0.0)),
                )
            )

        edges = [
            Edge(
                source=str(data.get("source", u)),
                target=str(data.get("target", v)),
                weight=float(data.get("weight", 1.0)),
            )
            for u, v, data in graph.edges(data=True)
        ]

        metric_values = self.metrics_service.compute(graph)
        metrics = GraphMetrics(**metric_values)

        original_summary = graph_result.original_summary
        filtered_summary = graph_result.filtered_summary
        distance_summary = self.graph_builder.summarize_graph(graph_result.distance_graph)
        filter_summary = graph_result.filter_config

        metadata: Dict[str, object] = {
            "description": "Graph built from local Hi-C + gene files",
            "chromosome": selected_chromosome,
            "hic_file": str(hic_file_path),
            "gene_file": str(settings.gene_file_path),
            "hic_edges": hic_result.summary["hic_edges"],
            "unique_bins": hic_result.summary["unique_bins"],
            "genes": gene_result.summary["gene_count"],
            "position_min": hic_result.summary["position_min"],
            "position_max": hic_result.summary["position_max"],
            "original_node_count": original_summary.node_count,
            "original_edge_count": original_summary.edge_count,
            "original_connected_components": original_summary.connected_components,
            "original_density": original_summary.density,
            "filtered_node_count": filtered_summary.node_count,
            "filtered_edge_count": filtered_summary.edge_count,
            "filtered_connected_components": filtered_summary.connected_components,
            "filtered_density": filtered_summary.density,
            "distance_node_count": distance_summary.node_count,
            "distance_edge_count": distance_summary.edge_count,
            "distance_connected_components": distance_summary.connected_components,
            "distance_density": distance_summary.density,
            "filter_min_weight_threshold": filter_summary.min_weight_threshold,
            "filter_top_percent_strongest_edges": filter_summary.top_percent_strongest_edges,
            "filter_top_k_neighbors_per_node": filter_summary.top_k_neighbors_per_node,
            "filter_distance_epsilon": filter_summary.distance_epsilon,
            "mapped_genes": gene_mapping_result.mapped_genes,
            "unmapped_genes": gene_mapping_result.unmapped_genes,
            "bins_with_genes": gene_mapping_result.bins_with_genes,
            "gene_to_bin_json": str(gene_to_bin_json),
            "bin_to_genes_json": str(bin_to_genes_json),
            "gene_lookup_json": str(gene_lookup_json),
            "node_metrics_csv": str(csv_path),
            "node_metrics_json": str(json_path),
            "community_method": community_result.method,
            "community_modularity": float(community_result.modularity)
            if community_result.modularity is not None
            else -1.0,
            "community_count": len(community_summaries),
            "node_communities_csv": str(community_node_csv),
            "node_communities_json": str(community_node_json),
            "community_summary_csv": str(community_summary_csv),
            "community_summary_json": str(community_summary_json),
            "closeness_disconnected_behavior": "wf_improved_true",
        }

        self.logger.info(
            "Ingestion summary | chromosome=%s hic_edges=%d unique_bins=%d genes=%d pos_range=%d-%d",
            selected_chromosome,
            hic_result.summary["hic_edges"],
            hic_result.summary["unique_bins"],
            gene_result.summary["gene_count"],
            hic_result.summary["position_min"],
            hic_result.summary["position_max"],
        )

        return GraphResponse(
            dataset="local_files",
            nodes=nodes,
            edges=edges,
            metrics=metrics,
            metadata=metadata,
        )

    def build_demo_graph(self) -> GraphResponse:
        # Backward compatibility route alias.
        return self.build_graph_from_files()

    def _discover_hic_files(self) -> Dict[str, Path]:
        hic_dir = settings.data_dir / "hic_data"
        if not hic_dir.exists():
            return {}

        files: Dict[str, Path] = {}
        for file_path in hic_dir.glob("*.txt"):
            chromosome = self._extract_chromosome_from_filename(file_path.name)
            if chromosome is not None:
                files[chromosome] = file_path

        return files

    def _resolve_hic_file(self, chromosome: str) -> Path:
        discovered = self._discover_hic_files()
        if chromosome in discovered:
            return discovered[chromosome]

        raise FileNotFoundError(
            f"No Hi-C file found for chromosome '{chromosome}'. "
            f"Available: {sorted(discovered.keys()) if discovered else []}"
        )

    @staticmethod
    def _normalize_chromosome(chromosome: str) -> str:
        text = chromosome.strip().lower()
        if not text.startswith("chr"):
            text = f"chr{text}"
        return text

    @staticmethod
    def _extract_chromosome_from_filename(filename: str) -> Optional[str]:
        match = re.match(r"^(chr[0-9xy]+)(?:[_\.-].*)?\.txt$", filename.lower())
        if not match:
            return None
        return match.group(1)

    @staticmethod
    def _chromosome_sort_key(chromosome: str) -> tuple[int, str]:
        token = chromosome.replace("chr", "")
        if token.isdigit():
            return (0, f"{int(token):03d}")
        if token == "x":
            return (1, token)
        if token == "y":
            return (2, token)
        return (3, token)
