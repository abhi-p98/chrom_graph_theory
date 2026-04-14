import pandas as pd

from app.services.graph_builder import GraphBuilder
from app.services.graph_filter_config import GraphFilterConfig


def test_graph_builder_constructs_nodes_edges_and_distance_graph() -> None:
    dataframe = pd.DataFrame(
        {
            "bin1_start": [0, 0, 1_000_000, 2_000_000],
            "bin2_start": [1_000_000, 2_000_000, 2_000_000, 3_000_000],
            "contact_count": [100.0, 80.0, 60.0, 40.0],
        }
    )

    builder = GraphBuilder()
    config = GraphFilterConfig(
        min_weight_threshold=0.0,
        top_percent_strongest_edges=1.0,
        top_k_neighbors_per_node=0,
        remove_near_diagonal_bins=None,
        keep_only_positive_enrichment=False,
        distance_epsilon=1e-6,
    )

    result = builder.build_graph_from_dataframe(
        dataframe,
        chromosome="chr2",
        bin_size=1_000_000,
        filter_config=config,
    )

    assert result.original_summary.node_count == 4
    assert result.original_summary.edge_count == 4
    assert result.filtered_summary.edge_count == 4

    node_data = result.original_graph.nodes["chr2:0-1000000"]
    assert node_data["chromosome"] == "chr2"
    assert node_data["start"] == 0
    assert node_data["end"] == 1_000_000
    assert node_data["label"] == "chr2:0Mb"

    edge_data = result.distance_graph["chr2:0-1000000"]["chr2:1000000-2000000"]
    assert edge_data["weight"] == 100.0
    assert edge_data["distance"] > 0


def test_graph_builder_filters_for_web_visualization() -> None:
    dataframe = pd.DataFrame(
        {
            "bin1_start": [0, 0, 0, 1_000_000, 1_000_000, 2_000_000],
            "bin2_start": [1_000_000, 2_000_000, 3_000_000, 2_000_000, 3_000_000, 3_000_000],
            "contact_count": [100.0, 90.0, 80.0, 20.0, 10.0, 5.0],
        }
    )

    builder = GraphBuilder()
    config = GraphFilterConfig(
        min_weight_threshold=15.0,
        top_percent_strongest_edges=0.5,
        top_k_neighbors_per_node=1,
        remove_near_diagonal_bins=None,
        keep_only_positive_enrichment=False,
        distance_epsilon=1e-6,
    )

    result = builder.build_graph_from_dataframe(
        dataframe,
        chromosome="chr2",
        bin_size=1_000_000,
        filter_config=config,
    )

    # After filtering: low-weight edges removed and strongest edge neighborhood retained.
    assert result.original_summary.edge_count == 6
    assert result.filtered_summary.edge_count >= 1
    assert result.filtered_summary.edge_count <= 3

    filtered_raw_weights = [
        data["raw_weight"] for _, _, data in result.filtered_graph.edges(data=True)
    ]
    assert all(weight >= 15.0 for weight in filtered_raw_weights)


def test_graph_builder_removes_self_loops_and_near_diagonal_and_adds_enrichment() -> None:
    dataframe = pd.DataFrame(
        {
            "bin1_start": [0, 0, 0, 1_000_000, 0],
            "bin2_start": [0, 1_000_000, 2_000_000, 3_000_000, 3_000_000],
            "contact_count": [500.0, 200.0, 80.0, 60.0, 120.0],
        }
    )

    builder = GraphBuilder()
    config = GraphFilterConfig(
        min_weight_threshold=0.0,
        top_percent_strongest_edges=1.0,
        top_k_neighbors_per_node=0,
        remove_near_diagonal_bins=1,
        keep_only_positive_enrichment=False,
        distance_epsilon=1e-6,
    )

    result = builder.build_graph_from_dataframe(
        dataframe,
        chromosome="chr2",
        bin_size=1_000_000,
        filter_config=config,
    )

    filtered_edges = list(result.filtered_graph.edges(data=True))
    assert all(source != target for source, target, _ in filtered_edges)

    # distance <= 1 bin is excluded, so only long-range (>=2 bins) edges remain.
    assert len(filtered_edges) == 3
    for _, _, edge_data in filtered_edges:
        assert edge_data["distance_bins"] >= 2
        assert "observed_expected" in edge_data
        assert "enrichment_score" in edge_data
