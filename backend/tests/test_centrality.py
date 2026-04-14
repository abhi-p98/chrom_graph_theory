from pathlib import Path

import networkx as nx

from app.services.centrality import (
    attach_metrics_to_nodes,
    compute_betweenness,
    compute_closeness,
    compute_weighted_degree,
    normalize_metric_dict,
    save_node_metrics,
)


def test_centrality_metrics_and_normalization_on_disconnected_graph(tmp_path: Path) -> None:
    graph = nx.Graph()
    graph.add_edge("a", "b", weight=10.0)
    graph.add_edge("b", "c", weight=5.0)
    graph.add_node("d")  # isolated node for disconnected behavior

    distance_graph = nx.Graph()
    distance_graph.add_edge("a", "b", distance=1.0 / 10.0, weight=10.0)
    distance_graph.add_edge("b", "c", distance=1.0 / 5.0, weight=5.0)
    distance_graph.add_node("d")

    degree = compute_weighted_degree(graph)
    between = compute_betweenness(distance_graph)
    close = compute_closeness(distance_graph)

    assert degree["b"] == 15.0
    assert close["d"] == 0.0

    normalized = normalize_metric_dict(degree)
    assert min(normalized.values()) >= 0.0
    assert max(normalized.values()) <= 1.0

    attached = attach_metrics_to_nodes(
        graph,
        weighted_degree=degree,
        betweenness=between,
        closeness=close,
    )
    assert "weighted_degree_norm" in attached["a"]
    assert "closeness_norm" in attached["d"]

    csv_path = tmp_path / "node_metrics.csv"
    json_path = tmp_path / "node_metrics.json"
    save_node_metrics(attached, output_csv_path=csv_path, output_json_path=json_path)

    assert csv_path.exists()
    assert json_path.exists()
