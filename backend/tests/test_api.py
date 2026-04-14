from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_demo_graph_endpoint() -> None:
    response = client.get("/api/graph/demo")
    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset"] == "local_files"
    assert len(payload["nodes"]) > 0
    assert len(payload["edges"]) > 0
    assert "metrics" in payload
    assert isinstance(payload["nodes"][0].get("community_id"), int)
    assert isinstance(payload["nodes"][0].get("gene_count"), int)
    assert isinstance(payload["nodes"][0].get("genes"), list)


def test_current_graph_endpoint() -> None:
    response = client.get("/api/graph/current")
    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset"] == "local_files"
    assert payload["metadata"]["chromosome"] == "chr2"
    assert payload["metadata"]["hic_edges"] > 0


def test_available_chromosomes_endpoint() -> None:
    response = client.get("/api/graph/chromosomes")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert "chr2" in payload


def test_current_graph_endpoint_accepts_query_chromosome() -> None:
    response = client.get("/api/graph/current", params={"chromosome": "2"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["metadata"]["chromosome"] == "chr2"
