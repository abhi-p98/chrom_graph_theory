from pathlib import Path

import networkx as nx

from app.services.communities import (
    attach_community_to_nodes,
    communities_to_node_map,
    compute_community_summaries,
    detect_communities,
    save_community_outputs,
)


def test_detect_communities_and_stable_integer_ids() -> None:
    graph = nx.Graph()
    graph.add_edge("a", "b", weight=10.0)
    graph.add_edge("b", "c", weight=9.0)
    graph.add_edge("x", "y", weight=11.0)

    result = detect_communities(graph)
    community_ids = sorted(set(result.node_to_community.values()))

    assert result.method in {"louvain", "greedy_modularity"}
    assert community_ids == list(range(len(community_ids)))
    assert all(isinstance(value, int) for value in result.node_to_community.values())


def test_attach_and_summarize_communities() -> None:
    graph = nx.Graph()
    graph.add_edge("n1", "n2", weight=5.0)
    graph.add_edge("n2", "n3", weight=3.0)

    node_to_community = {"n1": 0, "n2": 0, "n3": 1}
    attach_community_to_nodes(graph, node_to_community)

    assert graph.nodes["n1"]["community_id"] == 0

    node_metrics = {
        "n1": {"weighted_degree": 5.0, "betweenness": 0.2, "closeness": 0.3},
        "n2": {"weighted_degree": 8.0, "betweenness": 0.4, "closeness": 0.5},
        "n3": {"weighted_degree": 3.0, "betweenness": 0.1, "closeness": 0.2},
    }
    node_has_gene = {"n1": True, "n2": False, "n3": True}

    summaries = compute_community_summaries(graph, node_to_community, node_metrics, node_has_gene)
    assert len(summaries) == 2

    first = summaries[0]
    assert isinstance(first["community_id"], int)
    assert "avg_weighted_degree" in first
    assert "gene_count" in first


def test_save_community_outputs(tmp_path: Path) -> None:
    node_to_community = {"n1": 0, "n2": 1}
    summaries = [
        {
            "community_id": 0,
            "node_count": 1,
            "edge_count": 0,
            "avg_weighted_degree": 1.0,
            "avg_betweenness": 0.0,
            "avg_closeness": 0.0,
            "gene_count": 1,
        }
    ]

    node_csv = tmp_path / "node_communities.csv"
    node_json = tmp_path / "node_communities.json"
    summary_csv = tmp_path / "community_summary.csv"
    summary_json = tmp_path / "community_summary.json"

    save_community_outputs(
        node_to_community=node_to_community,
        community_summaries=summaries,
        node_csv_path=node_csv,
        node_json_path=node_json,
        summary_csv_path=summary_csv,
        summary_json_path=summary_json,
    )

    assert node_csv.exists()
    assert node_json.exists()
    assert summary_csv.exists()
    assert summary_json.exists()


def test_communities_to_node_map() -> None:
    communities = [set(["a", "b"]), set(["c"])]
    mapping = communities_to_node_map(communities)
    assert mapping["a"] == 0
    assert mapping["c"] == 1
