from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict

from app.config import settings
from app.services.centrality import (
    attach_metrics_to_nodes,
    compute_betweenness,
    compute_closeness,
    compute_weighted_degree,
    save_node_metrics,
)
from app.services.communities import (
    attach_community_to_nodes,
    compute_community_summaries,
    detect_communities,
)
from app.services.gene_loader import GeneLoader
from app.services.gene_mapping import GeneMappingService
from app.services.graph_builder import GraphBuilder
from app.services.graph_filter_config import DEFAULT_WEB_FILTER_CONFIG
from app.services.hic_loader import HicLoader


def normalize_chromosome(chromosome: str) -> str:
    text = chromosome.strip().lower()
    if not text.startswith("chr"):
        text = f"chr{text}"
    return text


def resolve_hic_file(chromosome: str, data_dir: Path) -> Path:
    hic_dir = data_dir / "hic_data"
    expected_prefix = chromosome.lower()

    for path in sorted(hic_dir.glob("*.txt")):
        if path.stem.lower().startswith(expected_prefix):
            return path

    available = sorted(path.name for path in hic_dir.glob("*.txt"))
    raise FileNotFoundError(
        f"No Hi-C file found for chromosome '{chromosome}' in {hic_dir}. Available: {available}"
    )


def build_graph_artifacts(
    chromosome: str,
    output_dir: Path,
    data_dir: Path,
    gene_file: Path,
    bin_size: int,
) -> Dict[str, object]:
    chromosome = normalize_chromosome(chromosome)
    hic_file = resolve_hic_file(chromosome, data_dir)

    hic_loader = HicLoader(target_chromosome=chromosome, remove_self_loops=settings.remove_self_loops)
    gene_loader = GeneLoader(target_chromosome=chromosome)

    hic_result = hic_loader.load(hic_file)
    gene_result = gene_loader.load(gene_file)

    builder = GraphBuilder()
    graph_result = builder.build_graph_from_dataframe(
        hic_df=hic_result.dataframe,
        chromosome=chromosome,
        bin_size=bin_size,
        filter_config=DEFAULT_WEB_FILTER_CONFIG,
    )

    filtered_graph = graph_result.filtered_graph
    original_graph = graph_result.original_graph
    distance_graph = graph_result.distance_graph

    weighted_degree = compute_weighted_degree(original_graph)
    betweenness = compute_betweenness(distance_graph)
    closeness = compute_closeness(distance_graph)

    centrality_by_node = attach_metrics_to_nodes(
        original_graph,
        weighted_degree=weighted_degree,
        betweenness=betweenness,
        closeness=closeness,
    )

    filtered_node_metrics = {
        str(node): centrality_by_node.get(str(node), {})
        for node in filtered_graph.nodes
    }

    community_result = detect_communities(filtered_graph)
    attach_community_to_nodes(filtered_graph, community_result.node_to_community)

    gene_mapping_service = GeneMappingService()
    gene_mapping_result = gene_mapping_service.build_mappings(
        gene_df=gene_result.dataframe,
        target_chromosome=chromosome,
        bin_size=bin_size,
    )

    node_has_gene = {}
    for node_id in filtered_graph.nodes:
        node_data = filtered_graph.nodes[node_id]
        start = int(node_data.get("start", 0))
        bin_id = f"{chromosome}:{start}-{start + bin_size}"
        node_has_gene[str(node_id)] = len(gene_mapping_result.bin_to_genes.get(bin_id, [])) > 0

    community_summaries = compute_community_summaries(
        graph=filtered_graph,
        node_to_community=community_result.node_to_community,
        node_metrics=filtered_node_metrics,
        node_has_gene=node_has_gene,
    )

    output_dir.mkdir(parents=True, exist_ok=True)

    # Supporting outputs requested
    node_metrics_csv = output_dir / "node_metrics.csv"
    node_metrics_json = output_dir / "node_metrics.json"
    save_node_metrics(filtered_node_metrics, node_metrics_csv, node_metrics_json)

    community_summary_json = output_dir / "community_summary.json"
    community_summary_csv = output_dir / "community_summary.csv"
    with community_summary_json.open("w", encoding="utf-8") as handle:
        json.dump(community_summaries, handle, indent=2, sort_keys=True)
    # convenience csv
    import pandas as pd

    pd.DataFrame(community_summaries).sort_values("community_id").to_csv(community_summary_csv, index=False)

    gene_lookup_json = output_dir / "gene_lookup.json"
    gene_to_bin_json = output_dir / "gene_to_bin.json"
    bin_to_genes_json = output_dir / "bin_to_genes.json"
    gene_mapping_service.save_mappings_json(
        mapping_result=gene_mapping_result,
        gene_to_bin_path=gene_to_bin_json,
        bin_to_genes_path=bin_to_genes_json,
        gene_lookup_path=gene_lookup_json,
    )

    nodes = []
    sorted_nodes = sorted(
        filtered_graph.nodes(data=True),
        key=lambda item: (int(item[1].get("start", 0)), str(item[0])),
    )

    for node_id, node_data in sorted_nodes:
        start = int(node_data.get("start", 0))
        end = int(node_data.get("end", start + bin_size))
        bin_id = f"{chromosome}:{start}-{start + bin_size}"

        genes = sorted(gene_mapping_result.bin_to_genes.get(bin_id, []))
        metrics = filtered_node_metrics.get(str(node_id), {})

        nodes.append(
            {
                "data": {
                    "id": str(node_id),
                    "label": genes[0] if genes else str(node_data.get("label", node_id)),
                    "chromosome": chromosome,
                    "start": start,
                    "end": end,
                    "degree_raw": float(metrics.get("weighted_degree", 0.0)),
                    "degree_norm": float(metrics.get("weighted_degree_norm", 0.0)),
                    "betweenness_raw": float(metrics.get("betweenness", 0.0)),
                    "betweenness_norm": float(metrics.get("betweenness_norm", 0.0)),
                    "closeness_raw": float(metrics.get("closeness", 0.0)),
                    "closeness_norm": float(metrics.get("closeness_norm", 0.0)),
                    "community_id": int(node_data.get("community_id", -1)),
                    "gene_count": len(genes),
                    "genes": genes,
                }
            }
        )

    edges = []
    sorted_edges = sorted(
        filtered_graph.edges(data=True),
        key=lambda item: (str(min(item[0], item[1])), str(max(item[0], item[1]))),
    )

    for source, target, data in sorted_edges:
        u, v = sorted([str(source), str(target)])
        weight = float(data.get("weight", 0.0))
        distance = None
        if distance_graph.has_edge(source, target):
            distance = float(distance_graph[source][target].get("distance", 0.0))
        else:
            distance = 1.0 / (weight + DEFAULT_WEB_FILTER_CONFIG.distance_epsilon)

        edges.append(
            {
                "data": {
                    "id": f"{u}--{v}",
                    "source": u,
                    "target": v,
                    "weight": weight,
                    "distance": distance,
                }
            }
        )

    graph_json = {
        "meta": {
            "chromosome": chromosome,
            "hic_file": str(hic_file),
            "gene_file": str(gene_file),
            "community_method": community_result.method,
            "community_modularity": float(community_result.modularity)
            if community_result.modularity is not None
            else None,
            "mapped_genes": gene_mapping_result.mapped_genes,
            "unmapped_genes": gene_mapping_result.unmapped_genes,
            "bins_with_genes": gene_mapping_result.bins_with_genes,
            "node_count": len(nodes),
            "edge_count": len(edges),
        },
        "nodes": nodes,
        "edges": edges,
    }

    graph_json_path = output_dir / "graph.json"
    with graph_json_path.open("w", encoding="utf-8") as handle:
        json.dump(graph_json, handle, indent=2, sort_keys=True)

    return {
        "graph_json": str(graph_json_path),
        "community_summary_json": str(community_summary_json),
        "gene_lookup_json": str(gene_lookup_json),
        "node_metrics_csv": str(node_metrics_csv),
        "output_dir": str(output_dir),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build frontend-ready Hi-C graph artifacts")
    parser.add_argument("--chromosome", default=settings.target_chromosome, help="Chromosome (e.g. chr2)")
    parser.add_argument(
        "--output-dir",
        default=str(settings.outputs_dir / "frontend_artifacts"),
        help="Directory to write artifact files",
    )
    parser.add_argument("--gene-file", default=str(settings.gene_file_path), help="Path to cleaned/cleanable gene TSV")
    parser.add_argument("--data-dir", default=str(settings.data_dir), help="Base data directory")
    parser.add_argument("--bin-size", type=int, default=settings.bin_size, help="Bin size (default 1,000,000)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    chromosome = normalize_chromosome(args.chromosome)
    output_dir = Path(args.output_dir) / chromosome

    artifacts = build_graph_artifacts(
        chromosome=chromosome,
        output_dir=output_dir,
        data_dir=Path(args.data_dir),
        gene_file=Path(args.gene_file),
        bin_size=int(args.bin_size),
    )

    print(json.dumps(artifacts, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
