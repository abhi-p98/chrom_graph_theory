from __future__ import annotations

import networkx as nx
from typing import Dict, Union


class MetricsService:
    def compute(self, graph: nx.Graph) -> Dict[str, Union[float, int]]:
        node_count = graph.number_of_nodes()
        edge_count = graph.number_of_edges()

        if node_count == 0:
            return {
                "node_count": 0,
                "edge_count": 0,
                "density": 0.0,
                "average_degree": 0.0,
                "communities": 0,
            }

        degrees = dict(graph.degree())
        avg_degree = sum(degrees.values()) / max(node_count, 1)

        communities = 1
        try:
            from community import community_louvain

            partition = community_louvain.best_partition(graph) if edge_count > 0 else {}
            communities = len(set(partition.values())) if partition else 1
        except Exception:
            communities = nx.number_connected_components(graph)

        return {
            "node_count": node_count,
            "edge_count": edge_count,
            "density": round(nx.density(graph), 4),
            "average_degree": round(avg_degree, 4),
            "communities": int(communities),
        }
