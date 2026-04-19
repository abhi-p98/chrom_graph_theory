from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from build_graph_artifacts import build_graph_artifacts

client = TestClient(app)


def _ensure_artifacts() -> None:
    graph_json = settings.outputs_dir / "frontend_artifacts" / "chr2" / "graph.json"
    if graph_json.exists():
        return

    build_graph_artifacts(
        chromosome="chr2",
        output_dir=settings.outputs_dir / "frontend_artifacts" / "chr2",
        data_dir=settings.data_dir,
        gene_file=settings.gene_file_path,
        bin_size=settings.bin_size,
    )


def test_graph_route_returns_full_graph_json() -> None:
    _ensure_artifacts()
    response = client.get("/api/graph", params={"chromosome": "chr2"})
    assert response.status_code == 200
    payload = response.json()
    assert "nodes" in payload
    assert "edges" in payload
    assert len(payload["nodes"]) > 0


def test_communities_route_returns_summary() -> None:
    _ensure_artifacts()
    response = client.get("/api/communities", params={"chromosome": "chr2"})
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert "community_id" in payload[0]


def test_genes_route_and_node_detail_route() -> None:
    _ensure_artifacts()
    genes_response = client.get("/api/genes", params={"chromosome": "chr2", "q": "ACP1"})
    assert genes_response.status_code == 200
    lookup = genes_response.json()["lookup"]
    assert "ACP1" in lookup

    node_id = lookup["ACP1"][0]
    node_response = client.get(f"/api/node/{node_id}", params={"chromosome": "chr2"})
    assert node_response.status_code == 200
    assert node_response.json()["node"]["id"] == node_id


def test_shortest_path_success_and_missing_gene() -> None:
    _ensure_artifacts()
    success = client.get(
        "/api/shortest-path",
        params={"chromosome": "chr2", "gene1": "ACP1", "gene2": "FAM110C"},
    )
    assert success.status_code == 200
    payload = success.json()
    assert payload["source_gene"] == "ACP1"
    assert payload["target_gene"] == "FAM110C"
    assert len(payload["path_nodes"]) >= 1

    missing = client.get(
        "/api/shortest-path",
        params={"chromosome": "chr2", "gene1": "NO_SUCH_GENE", "gene2": "FAM110C"},
    )
    assert missing.status_code == 404
    assert "not found" in str(missing.json()["detail"]).lower()


def test_genes_route_only_returns_genes_in_current_graph() -> None:
    _ensure_artifacts()
    response = client.get("/api/genes", params={"chromosome": "chr2", "q": "AAK1"})
    assert response.status_code == 200
    assert "AAK1" not in response.json()["lookup"]


def test_shortest_path_returns_404_for_gene_outside_current_graph() -> None:
    _ensure_artifacts()
    response = client.get(
        "/api/shortest-path",
        params={"chromosome": "chr2", "gene1": "AAK1", "gene2": "ABCA12"},
    )
    assert response.status_code == 404
    assert "current graph" in str(response.json()["detail"]).lower()


def test_shortest_path_edge_ids_match_graph_edges() -> None:
    _ensure_artifacts()
    graph_response = client.get("/api/graph", params={"chromosome": "chr2"})
    assert graph_response.status_code == 200
    graph_edge_ids = {edge["data"]["id"] for edge in graph_response.json()["edges"]}

    path_response = client.get(
        "/api/shortest-path",
        params={"chromosome": "chr2", "gene1": "FAM110C", "gene2": "AC114808.3"},
    )
    assert path_response.status_code == 200
    for edge in path_response.json()["path_edges"]:
        assert edge["id"] in graph_edge_ids
