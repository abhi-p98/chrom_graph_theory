from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

import networkx as nx

from app.config import settings


@dataclass
class ArtifactBundle:
    chromosome: str
    graph: Dict[str, object]
    communities: List[Dict[str, object]]
    gene_lookup: Dict[str, List[str]]
    node_index: Dict[str, Dict[str, object]]
    distance_graph: nx.Graph


class ArtifactStore:
    def __init__(self, artifacts_root: Optional[Path] = None) -> None:
        self.artifacts_root = artifacts_root or (settings.outputs_dir / "frontend_artifacts")
        self._cache: Dict[str, ArtifactBundle] = {}

    def load(self, chromosome: str) -> ArtifactBundle:
        chromosome = self._normalize_chromosome(chromosome)
        if chromosome in self._cache:
            return self._cache[chromosome]

        graph_path = self.artifacts_root / chromosome / "graph.json"
        communities_path = self.artifacts_root / chromosome / "community_summary.json"
        gene_lookup_path = self.artifacts_root / chromosome / "gene_lookup.json"

        if not graph_path.exists():
            self._build_artifacts_on_demand(chromosome)

        if not graph_path.exists():
            raise FileNotFoundError(
                f"Graph artifact not found for {chromosome}: {graph_path}. "
                f"Automatic build was attempted but no artifact was created."
            )

        graph_payload = self._read_json(graph_path)
        communities_payload = self._read_json(communities_path) if communities_path.exists() else []
        gene_lookup_payload = self._read_json(gene_lookup_path) if gene_lookup_path.exists() else {}

        node_index: Dict[str, Dict[str, object]] = {}
        for node in graph_payload.get("nodes", []):
            data = node.get("data", {})
            node_id = str(data.get("id", ""))
            if node_id:
                node_index[node_id] = data

        distance_graph = nx.Graph()
        distance_graph.add_nodes_from(node_index.keys())
        for edge in graph_payload.get("edges", []):
            data = edge.get("data", {})
            source = str(data.get("source", ""))
            target = str(data.get("target", ""))
            if not source or not target:
                continue
            distance_graph.add_edge(
                source,
                target,
                weight=float(data.get("weight", 0.0)),
                distance=float(data.get("distance", 0.0)),
            )

        bundle = ArtifactBundle(
            chromosome=chromosome,
            graph=graph_payload,
            communities=communities_payload,
            gene_lookup={str(k): list(v) for k, v in dict(gene_lookup_payload).items()},
            node_index=node_index,
            distance_graph=distance_graph,
        )
        self._cache[chromosome] = bundle
        return bundle

    def available_chromosomes(self) -> List[str]:
        if not self.artifacts_root.exists():
            return []
        chromosomes = [path.name for path in self.artifacts_root.iterdir() if path.is_dir()]
        return sorted(chromosomes)

    @staticmethod
    def _read_json(path: Path):
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    @staticmethod
    def _normalize_chromosome(chromosome: str) -> str:
        token = chromosome.strip().lower()
        if not token.startswith("chr"):
            token = f"chr{token}"
        return token

    def _build_artifacts_on_demand(self, chromosome: str) -> None:
        # Local import avoids startup overhead and circular import risks.
        from build_graph_artifacts import build_graph_artifacts

        output_dir = self.artifacts_root / chromosome

        try:
            build_graph_artifacts(
                chromosome=chromosome,
                output_dir=output_dir,
                data_dir=settings.data_dir,
                gene_file=settings.gene_file_path,
                bin_size=settings.bin_size,
            )
        except FileNotFoundError as exc:
            raise FileNotFoundError(
                f"No Hi-C input file found for chromosome '{chromosome}' in "
                f"{settings.data_dir / 'hic_data'}. "
                f"Expected a file like '{chromosome}_1mb.txt'."
            ) from exc


@lru_cache(maxsize=1)
def get_artifact_store() -> ArtifactStore:
    return ArtifactStore()
