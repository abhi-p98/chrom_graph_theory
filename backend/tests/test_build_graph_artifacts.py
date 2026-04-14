import json
from pathlib import Path

from app.config import settings
from build_graph_artifacts import build_graph_artifacts


def test_build_graph_artifacts_outputs_frontend_ready_files(tmp_path: Path) -> None:
    output_dir = tmp_path / "artifacts"

    result = build_graph_artifacts(
        chromosome="chr2",
        output_dir=output_dir,
        data_dir=settings.data_dir,
        gene_file=settings.gene_file_path,
        bin_size=settings.bin_size,
    )

    graph_json_path = Path(result["graph_json"])
    assert graph_json_path.exists()

    payload = json.loads(graph_json_path.read_text())
    assert "nodes" in payload
    assert "edges" in payload
    assert len(payload["nodes"]) > 0
    assert len(payload["edges"]) > 0

    node_data = payload["nodes"][0]["data"]
    assert "degree_raw" in node_data
    assert "community_id" in node_data
    assert "genes" in node_data

    edge_data = payload["edges"][0]["data"]
    assert "distance" in edge_data

    assert Path(result["community_summary_json"]).exists()
    assert Path(result["gene_lookup_json"]).exists()
    assert Path(result["node_metrics_csv"]).exists()
