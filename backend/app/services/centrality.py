from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Mapping

import networkx as nx
import pandas as pd


def compute_weighted_degree(weighted_graph: nx.Graph) -> Dict[str, float]:
    return {
        str(node): float(value)
        for node, value in weighted_graph.degree(weight="weight")
    }


def compute_betweenness(distance_graph: nx.Graph) -> Dict[str, float]:
    if distance_graph.number_of_nodes() == 0:
        return {}

    values = nx.betweenness_centrality(
        distance_graph,
        weight="distance",
        normalized=True,
    )
    return {str(node): float(score) for node, score in values.items()}


def compute_closeness(distance_graph: nx.Graph) -> Dict[str, float]:
    if distance_graph.number_of_nodes() == 0:
        return {}

    # wf_improved=True gives stable behavior on disconnected graphs by scaling with
    # reachable node fraction. Isolated nodes evaluate to 0.0.
    values = nx.closeness_centrality(
        distance_graph,
        distance="distance",
        wf_improved=True,
    )
    return {str(node): float(score) for node, score in values.items()}


def normalize_metric_dict(metric: Mapping[str, float]) -> Dict[str, float]:
    if not metric:
        return {}

    values = [float(v) for v in metric.values()]
    minimum = min(values)
    maximum = max(values)

    if maximum == minimum:
        return {str(key): 0.0 for key in metric}

    scale = maximum - minimum
    return {str(key): (float(value) - minimum) / scale for key, value in metric.items()}


def attach_metrics_to_nodes(
    graph: nx.Graph,
    weighted_degree: Mapping[str, float],
    betweenness: Mapping[str, float],
    closeness: Mapping[str, float],
) -> Dict[str, Dict[str, float]]:
    weighted_degree_norm = normalize_metric_dict(weighted_degree)
    betweenness_norm = normalize_metric_dict(betweenness)
    closeness_norm = normalize_metric_dict(closeness)

    attached: Dict[str, Dict[str, float]] = {}

    for node in graph.nodes:
        node_id = str(node)
        node_metrics = {
            "weighted_degree": float(weighted_degree.get(node_id, 0.0)),
            "weighted_degree_norm": float(weighted_degree_norm.get(node_id, 0.0)),
            "betweenness": float(betweenness.get(node_id, 0.0)),
            "betweenness_norm": float(betweenness_norm.get(node_id, 0.0)),
            "closeness": float(closeness.get(node_id, 0.0)),
            "closeness_norm": float(closeness_norm.get(node_id, 0.0)),
        }
        nx.set_node_attributes(graph, {node_id: node_metrics})
        attached[node_id] = node_metrics

    return attached


def save_node_metrics(
    node_metrics: Mapping[str, Mapping[str, float]],
    output_csv_path: Path,
    output_json_path: Path,
) -> None:
    output_csv_path.parent.mkdir(parents=True, exist_ok=True)
    output_json_path.parent.mkdir(parents=True, exist_ok=True)

    records = []
    for node_id, metrics in node_metrics.items():
        row = {"node_id": node_id}
        row.update({key: float(value) for key, value in metrics.items()})
        records.append(row)

    dataframe = pd.DataFrame(records).sort_values("node_id") if records else pd.DataFrame(columns=["node_id"])
    dataframe.to_csv(output_csv_path, index=False)

    with output_json_path.open("w", encoding="utf-8") as handle:
        json.dump(dict(node_metrics), handle, indent=2)
