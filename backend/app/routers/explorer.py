from __future__ import annotations

from typing import Dict, List, Optional

import networkx as nx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import settings
from app.models.api_models import GenesResponse, NodeDetailResponse, ShortestPathResponse
from app.services.artifact_store import ArtifactStore, get_artifact_store

router = APIRouter(tags=["explorer"])


@router.get("/graph")
def get_graph(
    chromosome: str = Query(default=settings.target_chromosome),
    store: ArtifactStore = Depends(get_artifact_store),
) -> Dict[str, object]:
    bundle = _load_bundle_or_404(store, chromosome)
    return bundle.graph


@router.get("/communities")
def get_communities(
    chromosome: str = Query(default=settings.target_chromosome),
    store: ArtifactStore = Depends(get_artifact_store),
) -> List[Dict[str, object]]:
    bundle = _load_bundle_or_404(store, chromosome)
    return bundle.communities


@router.get("/genes", response_model=GenesResponse)
def get_genes(
    chromosome: str = Query(default=settings.target_chromosome),
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=2000),
    store: ArtifactStore = Depends(get_artifact_store),
) -> GenesResponse:
    bundle = _load_bundle_or_404(store, chromosome)

    lookup = _filter_lookup_to_visible_nodes(bundle.gene_lookup, set(bundle.node_index))
    if q:
        query = q.lower().strip()
        filtered = {
            gene: bins
            for gene, bins in lookup.items()
            if query in gene.lower()
        }
    else:
        filtered = dict(lookup)

    trimmed = dict(list(sorted(filtered.items()))[:limit])
    return GenesResponse(
        chromosome=bundle.chromosome,
        query=q,
        total_genes=len(filtered),
        lookup=trimmed,
    )


@router.get("/node/{node_id}", response_model=NodeDetailResponse)
def get_node_detail(
    node_id: str,
    chromosome: str = Query(default=settings.target_chromosome),
    store: ArtifactStore = Depends(get_artifact_store),
) -> NodeDetailResponse:
    bundle = _load_bundle_or_404(store, chromosome)
    if node_id not in bundle.node_index:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Node '{node_id}' not found for chromosome '{bundle.chromosome}'.",
                "example_nodes": list(sorted(bundle.node_index.keys())[:5]),
            },
        )

    return NodeDetailResponse(chromosome=bundle.chromosome, node=bundle.node_index[node_id])


@router.get("/shortest-path", response_model=ShortestPathResponse)
def get_shortest_path(
    gene1: str,
    gene2: str,
    chromosome: str = Query(default=settings.target_chromosome),
    store: ArtifactStore = Depends(get_artifact_store),
) -> ShortestPathResponse:
    bundle = _load_bundle_or_404(store, chromosome)

    source_node = _resolve_gene_to_node(gene1, bundle.gene_lookup)
    target_node = _resolve_gene_to_node(gene2, bundle.gene_lookup)

    if source_node is None:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Gene '{gene1}' not found in lookup for {bundle.chromosome}.",
                "tip": "Use /genes?q=<prefix> to search available gene names.",
            },
        )

    if target_node is None:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Gene '{gene2}' not found in lookup for {bundle.chromosome}.",
                "tip": "Use /genes?q=<prefix> to search available gene names.",
            },
        )

    if source_node not in bundle.node_index:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Gene '{gene1}' is mapped to bin '{source_node}', but that bin is not present in the current graph for {bundle.chromosome}.",
                "tip": "Search genes from /genes to use only genes available in the current graph.",
            },
        )

    if target_node not in bundle.node_index:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Gene '{gene2}' is mapped to bin '{target_node}', but that bin is not present in the current graph for {bundle.chromosome}.",
                "tip": "Search genes from /genes to use only genes available in the current graph.",
            },
        )

    try:
        path_nodes = nx.shortest_path(
            bundle.distance_graph,
            source=source_node,
            target=target_node,
            weight="distance",
        )
        total_distance = float(
            nx.shortest_path_length(
                bundle.distance_graph,
                source=source_node,
                target=target_node,
                weight="distance",
            )
        )
    except nx.NetworkXNoPath:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"No path found between '{gene1}' and '{gene2}' on {bundle.chromosome}.",
                "source_node": source_node,
                "target_node": target_node,
            },
        )

    path_edges = []
    for left, right in zip(path_nodes[:-1], path_nodes[1:]):
        edge_data = bundle.distance_graph[left][right]
        path_edges.append(
            {
                "id": str(edge_data.get("id", f"{left}--{right}")),
                "source": left,
                "target": right,
                "weight": float(edge_data.get("weight", 0.0)),
                "distance": float(edge_data.get("distance", 0.0)),
            }
        )

    return ShortestPathResponse(
        source_gene=gene1,
        target_gene=gene2,
        source_node=source_node,
        target_node=target_node,
        path_nodes=path_nodes,
        path_edges=path_edges,
        total_distance=total_distance,
        hop_count=max(len(path_nodes) - 1, 0),
    )


def _load_bundle_or_404(store: ArtifactStore, chromosome: str):
    try:
        return store.load(chromosome)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _resolve_gene_to_node(gene_name: str, lookup: Dict[str, List[str]]) -> Optional[str]:
    if gene_name in lookup and lookup[gene_name]:
        return sorted(lookup[gene_name])[0]

    lowered = gene_name.lower()
    for key in sorted(lookup.keys()):
        if key.lower() == lowered and lookup[key]:
            return sorted(lookup[key])[0]

    return None


def _filter_lookup_to_visible_nodes(lookup: Dict[str, List[str]], visible_nodes: set[str]) -> Dict[str, List[str]]:
    filtered: Dict[str, List[str]] = {}
    for gene, bins in lookup.items():
        visible_bins = [bin_id for bin_id in bins if bin_id in visible_nodes]
        if visible_bins:
            filtered[gene] = visible_bins
    return filtered
