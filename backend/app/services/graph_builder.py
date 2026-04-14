from __future__ import annotations

from dataclasses import asdict, dataclass
from math import ceil
from typing import Dict, List, Sequence, Tuple

import networkx as nx
import pandas as pd

from app.services.data_loader import ContactRecord
from app.services.graph_filter_config import GraphFilterConfig


@dataclass(frozen=True)
class GraphSummary:
    node_count: int
    edge_count: int
    connected_components: int
    density: float


@dataclass(frozen=True)
class GraphBuildResult:
    original_graph: nx.Graph
    filtered_graph: nx.Graph
    distance_graph: nx.Graph
    original_summary: GraphSummary
    filtered_summary: GraphSummary
    filter_config: GraphFilterConfig


class GraphBuilder:
    def build_graph(self, contacts: list[ContactRecord]) -> nx.Graph:
        graph = nx.Graph()

        for record in contacts:
            graph.add_edge(record.source, record.target, weight=record.weight)

        return graph

    def build_graph_from_dataframe(
        self,
        hic_df: pd.DataFrame,
        chromosome: str,
        bin_size: int,
        filter_config: GraphFilterConfig,
    ) -> GraphBuildResult:
        unique_bins = self._infer_unique_bins(hic_df)
        original_graph = self._build_weighted_graph(hic_df, chromosome, bin_size, unique_bins)
        filtered_graph = self._apply_filters(original_graph, filter_config)
        distance_graph = self._build_distance_graph(original_graph, filter_config.distance_epsilon)

        return GraphBuildResult(
            original_graph=original_graph,
            filtered_graph=filtered_graph,
            distance_graph=distance_graph,
            original_summary=self._summarize_graph(original_graph),
            filtered_summary=self._summarize_graph(filtered_graph),
            filter_config=filter_config,
        )

    def _infer_unique_bins(self, hic_df: pd.DataFrame) -> List[int]:
        bins = pd.unique(pd.concat([hic_df["bin1_start"], hic_df["bin2_start"]], ignore_index=True))
        return sorted(int(position) for position in bins)

    def _build_weighted_graph(
        self,
        hic_df: pd.DataFrame,
        chromosome: str,
        bin_size: int,
        unique_bins: Sequence[int],
    ) -> nx.Graph:
        graph = nx.Graph()

        for bin_start in unique_bins:
            node_id = self._format_bin_id(chromosome, bin_start, bin_size)
            graph.add_node(
                node_id,
                id=node_id,
                chromosome=chromosome,
                start=int(bin_start),
                end=int(bin_start + bin_size),
                label=f"{chromosome}:{bin_start // 1_000_000}Mb",
            )

        for _, row in hic_df.iterrows():
            source = self._format_bin_id(chromosome, int(row["bin1_start"]), bin_size)
            target = self._format_bin_id(chromosome, int(row["bin2_start"]), bin_size)
            graph.add_edge(source, target, source=source, target=target, weight=float(row["contact_count"]))

        return graph

    def _apply_filters(self, graph: nx.Graph, config: GraphFilterConfig) -> nx.Graph:
        candidate_edges: List[Tuple[str, str, Dict[str, float]]] = []
        distance_to_weights: Dict[int, List[float]] = {}

        for source, target, data in graph.edges(data=True):
            raw_weight = float(data.get("weight", 0.0))
            if raw_weight < config.min_weight_threshold:
                continue

            # Explicitly remove self loops for community graph construction.
            if source == target:
                continue

            distance_bins = self._edge_distance_in_bins(graph, source, target)
            near_diagonal_cutoff = config.remove_near_diagonal_bins
            if near_diagonal_cutoff is not None and near_diagonal_cutoff >= 0 and distance_bins <= near_diagonal_cutoff:
                continue

            distance_to_weights.setdefault(distance_bins, []).append(raw_weight)
            candidate_edges.append(
                (
                    source,
                    target,
                    {
                        "source": source,
                        "target": target,
                        "raw_weight": raw_weight,
                        "distance_bins": float(distance_bins),
                    },
                )
            )

        if not candidate_edges:
            filtered_graph = nx.Graph()
            filtered_graph.add_nodes_from(graph.nodes(data=True))
            filtered_graph.remove_nodes_from(list(filtered_graph.nodes))
            return filtered_graph

        expected_by_distance = {
            distance: (sum(values) / len(values))
            for distance, values in distance_to_weights.items()
            if values
        }

        weighted_edges: List[Tuple[str, str, Dict[str, float]]] = []
        for source, target, data in candidate_edges:
            raw_weight = float(data.get("raw_weight", 0.0))
            distance_bins = int(float(data.get("distance_bins", 0.0)))
            expected_weight = float(expected_by_distance.get(distance_bins, 0.0))
            observed_expected = raw_weight / expected_weight if expected_weight > 0 else 0.0
            enrichment_score = observed_expected - 1.0
            weighted_edges.append(
                (
                    source,
                    target,
                    {
                        "source": source,
                        "target": target,
                        "raw_weight": raw_weight,
                        "expected_weight": expected_weight,
                        "observed_expected": observed_expected,
                        "enrichment_score": enrichment_score,
                        "distance_bins": float(distance_bins),
                        "weight": observed_expected,
                    },
                )
            )

        if config.keep_only_positive_enrichment:
            positive_edges = [
                edge for edge in weighted_edges if float(edge[2].get("enrichment_score", 0.0)) > 0.0
            ]
            weighted_edges = positive_edges if positive_edges else weighted_edges

        weighted_edges.sort(
            key=lambda edge: float(edge[2].get("enrichment_score", edge[2].get("weight", 0.0))),
            reverse=True,
        )

        if config.top_percent_strongest_edges < 1.0:
            keep_count = max(1, ceil(len(weighted_edges) * max(config.top_percent_strongest_edges, 0.0)))
            weighted_edges = weighted_edges[:keep_count]

        if config.top_k_neighbors_per_node > 0:
            weighted_edges = self._top_k_neighbor_filter(weighted_edges, config.top_k_neighbors_per_node)

        filtered_graph = nx.Graph()
        filtered_graph.add_nodes_from(graph.nodes(data=True))
        filtered_graph.add_edges_from(weighted_edges)

        isolates = [node for node in filtered_graph.nodes if filtered_graph.degree(node) == 0]
        filtered_graph.remove_nodes_from(isolates)

        return filtered_graph

    def _top_k_neighbor_filter(
        self,
        weighted_edges: Sequence[Tuple[str, str, Dict[str, float]]],
        top_k_neighbors: int,
    ) -> List[Tuple[str, str, Dict[str, float]]]:
        adjacency: Dict[str, List[Tuple[str, str, Dict[str, float]]]] = {}
        for edge in weighted_edges:
            source, target, _ = edge
            adjacency.setdefault(source, []).append(edge)
            adjacency.setdefault(target, []).append(edge)

        kept_edge_keys = set()
        for node, edges in adjacency.items():
            sorted_edges = sorted(
                edges,
                key=lambda edge: float(edge[2].get("enrichment_score", edge[2].get("weight", 0.0))),
                reverse=True,
            )
            for edge in sorted_edges[:top_k_neighbors]:
                source, target, _ = edge
                kept_edge_keys.add(tuple(sorted((source, target))))

        filtered = []
        for edge in weighted_edges:
            source, target, _ = edge
            if tuple(sorted((source, target))) in kept_edge_keys:
                filtered.append(edge)

        return filtered

    @staticmethod
    def _edge_distance_in_bins(graph: nx.Graph, source: str, target: str) -> int:
        source_start = int(graph.nodes[source].get("start", 0))
        target_start = int(graph.nodes[target].get("start", 0))
        source_end = int(graph.nodes[source].get("end", source_start + 1))
        inferred_bin_size = max(source_end - source_start, 1)
        return int(abs(source_start - target_start) // inferred_bin_size)

    def _build_distance_graph(self, weighted_graph: nx.Graph, epsilon: float) -> nx.Graph:
        distance_graph = nx.Graph()
        distance_graph.add_nodes_from(weighted_graph.nodes(data=True))

        for source, target, data in weighted_graph.edges(data=True):
            weight = float(data.get("weight", 0.0))
            distance = 1.0 / (weight + epsilon)
            distance_graph.add_edge(
                source,
                target,
                source=source,
                target=target,
                weight=weight,
                distance=distance,
            )

        return distance_graph

    def _summarize_graph(self, graph: nx.Graph) -> GraphSummary:
        node_count = graph.number_of_nodes()
        edge_count = graph.number_of_edges()
        components = nx.number_connected_components(graph) if node_count > 0 else 0
        density = nx.density(graph) if node_count > 1 else 0.0
        return GraphSummary(
            node_count=node_count,
            edge_count=edge_count,
            connected_components=components,
            density=round(float(density), 6),
        )

    def summarize_graph(self, graph: nx.Graph) -> GraphSummary:
        return self._summarize_graph(graph)

    @staticmethod
    def summary_to_dict(summary: GraphSummary) -> Dict[str, float]:
        return {
            "node_count": float(summary.node_count),
            "edge_count": float(summary.edge_count),
            "connected_components": float(summary.connected_components),
            "density": float(summary.density),
        }

    @staticmethod
    def filter_config_to_dict(config: GraphFilterConfig) -> Dict[str, float]:
        raw = asdict(config)
        return {key: float(value) for key, value in raw.items()}

    @staticmethod
    def _format_bin_id(chromosome: str, bin_start: int, bin_size: int) -> str:
        return f"{chromosome}:{bin_start}-{bin_start + bin_size}"
