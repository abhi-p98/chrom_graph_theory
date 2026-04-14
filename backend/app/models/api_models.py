from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


class GenesResponse(BaseModel):
    chromosome: str
    query: Optional[str] = None
    total_genes: int
    lookup: Dict[str, List[str]]


class NodeDetailResponse(BaseModel):
    chromosome: str
    node: Dict[str, object]


class ShortestPathResponse(BaseModel):
    source_gene: str
    target_gene: str
    source_node: str
    target_node: str
    path_nodes: List[str]
    path_edges: List[Dict[str, object]]
    total_distance: float
    hop_count: int
