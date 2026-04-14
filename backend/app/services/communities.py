from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Mapping, Optional, Sequence, Set

import networkx as nx
import pandas as pd


@dataclass(frozen=True)
class CommunityDetectionResult:
    node_to_community: Dict[str, int]
    method: str
    modularity: Optional[float]


def detect_communities(weighted_graph: nx.Graph) -> CommunityDetectionResult:
    if weighted_graph.number_of_nodes() == 0:
        return CommunityDetectionResult(node_to_community={}, method="none", modularity=None)

    try:
        from community import community_louvain  # type: ignore

        raw_partition = community_louvain.best_partition(weighted_graph, weight="weight", random_state=42)
        node_to_community = {str(node): int(comm) for node, comm in raw_partition.items()}
        node_to_community = _stable_integer_remap(node_to_community)
        modularity = float(community_louvain.modularity(raw_partition, weighted_graph, weight="weight"))
        return CommunityDetectionResult(
            node_to_community=node_to_community,
            method="louvain",
            modularity=modularity,
        )
    except Exception:
        communities = list(nx.algorithms.community.greedy_modularity_communities(weighted_graph, weight="weight"))
        node_to_community = communities_to_node_map(communities)
        node_to_community = _stable_integer_remap(node_to_community)
        modularity = float(nx.algorithms.community.modularity(weighted_graph, communities, weight="weight"))
        return CommunityDetectionResult(
            node_to_community=node_to_community,
            method="greedy_modularity",
            modularity=modularity,
        )


def communities_to_node_map(communities: Sequence[Set[str]]) -> Dict[str, int]:
    mapping: Dict[str, int] = {}
    for community_id, members in enumerate(communities):
        for node in members:
            mapping[str(node)] = int(community_id)
    return mapping


def attach_community_to_nodes(
    graph: nx.Graph,
    node_to_community: Mapping[str, int],
) -> Dict[str, Dict[str, int]]:
    attached: Dict[str, Dict[str, int]] = {}
    attributes = {
        str(node): {"community_id": int(node_to_community.get(str(node), -1))}
        for node in graph.nodes
    }
    nx.set_node_attributes(graph, attributes)

    for node_id, attr in attributes.items():
        attached[node_id] = dict(attr)

    return attached


def compute_community_summaries(
    graph: nx.Graph,
    node_to_community: Mapping[str, int],
    node_metrics: Mapping[str, Mapping[str, float]],
    node_has_gene: Mapping[str, bool],
) -> List[Dict[str, object]]:
    community_groups: Dict[int, List[str]] = {}
    for node_id, community_id in node_to_community.items():
        community_groups.setdefault(int(community_id), []).append(str(node_id))

    summaries: List[Dict[str, object]] = []

    for community_id in sorted(community_groups.keys()):
        members = sorted(community_groups[community_id])
        subgraph = graph.subgraph(members)

        weighted_degree_values = [
            float(node_metrics.get(node, {}).get("weighted_degree", 0.0))
            for node in members
        ]
        betweenness_values = [
            float(node_metrics.get(node, {}).get("betweenness", 0.0))
            for node in members
        ]
        closeness_values = [
            float(node_metrics.get(node, {}).get("closeness", 0.0))
            for node in members
        ]

        gene_count = sum(1 for node in members if bool(node_has_gene.get(node, False)))

        summaries.append(
            {
                "community_id": int(community_id),
                "node_count": int(len(members)),
                "edge_count": int(subgraph.number_of_edges()),
                "avg_weighted_degree": _safe_average(weighted_degree_values),
                "avg_betweenness": _safe_average(betweenness_values),
                "avg_closeness": _safe_average(closeness_values),
                "gene_count": int(gene_count),
            }
        )

    return summaries


def save_community_outputs(
    node_to_community: Mapping[str, int],
    community_summaries: Sequence[Mapping[str, object]],
    node_csv_path: Path,
    node_json_path: Path,
    summary_csv_path: Path,
    summary_json_path: Path,
) -> None:
    for target in (node_csv_path, node_json_path, summary_csv_path, summary_json_path):
        target.parent.mkdir(parents=True, exist_ok=True)

    node_records = [
        {"node_id": str(node_id), "community_id": int(community_id)}
        for node_id, community_id in node_to_community.items()
    ]
    node_dataframe = pd.DataFrame(node_records).sort_values(["community_id", "node_id"]) if node_records else pd.DataFrame(columns=["node_id", "community_id"])
    node_dataframe.to_csv(node_csv_path, index=False)

    with node_json_path.open("w", encoding="utf-8") as handle:
        json.dump({str(node): int(cid) for node, cid in node_to_community.items()}, handle, indent=2)

    summary_dataframe = pd.DataFrame(list(community_summaries))
    if not summary_dataframe.empty:
        summary_dataframe = summary_dataframe.sort_values("community_id")
    summary_dataframe.to_csv(summary_csv_path, index=False)

    with summary_json_path.open("w", encoding="utf-8") as handle:
        json.dump(list(community_summaries), handle, indent=2)


def _stable_integer_remap(node_to_community: Mapping[str, int]) -> Dict[str, int]:
    groups: Dict[int, List[str]] = {}
    for node, community in node_to_community.items():
        groups.setdefault(int(community), []).append(str(node))

    sorted_groups = sorted(
        groups.items(),
        key=lambda item: (-len(item[1]), min(item[1])),
    )

    remap = {old_id: new_id for new_id, (old_id, _) in enumerate(sorted_groups)}
    return {node: remap[int(comm)] for node, comm in node_to_community.items()}


def _safe_average(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return float(sum(values) / len(values))
