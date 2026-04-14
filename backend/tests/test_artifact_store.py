from pathlib import Path

import pytest

from app.services.artifact_store import ArtifactStore


def test_load_builds_missing_artifacts_on_demand(tmp_path: Path) -> None:
    store = ArtifactStore(artifacts_root=tmp_path / "frontend_artifacts")

    bundle = store.load("chr2")

    graph_json = tmp_path / "frontend_artifacts" / "chr2" / "graph.json"
    assert graph_json.exists()
    assert bundle.chromosome == "chr2"
    assert len(bundle.graph.get("nodes", [])) > 0
    assert len(bundle.graph.get("edges", [])) > 0


def test_load_missing_input_file_raises_clear_error(tmp_path: Path) -> None:
    store = ArtifactStore(artifacts_root=tmp_path / "frontend_artifacts")

    with pytest.raises(FileNotFoundError, match="No Hi-C input file found for chromosome"):
        store.load("chr999")
