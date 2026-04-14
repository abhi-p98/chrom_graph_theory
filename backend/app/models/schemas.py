from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Dict, Optional, Union


class Node(BaseModel):
    id: str
    label: str
    chromosome: Optional[str] = None
    bin_start: Optional[int] = None
    bin_end: Optional[int] = None
    community_id: Optional[int] = None
    gene_count: int = 0
    genes: list[str] = Field(default_factory=list)
    expression: Optional[float] = None
    weighted_degree: Optional[float] = None
    weighted_degree_norm: Optional[float] = None
    betweenness: Optional[float] = None
    betweenness_norm: Optional[float] = None
    closeness: Optional[float] = None
    closeness_norm: Optional[float] = None


class Edge(BaseModel):
    source: str
    target: str
    weight: float = 1.0


class GraphMetrics(BaseModel):
    node_count: int
    edge_count: int
    density: float
    average_degree: float
    communities: int


class GraphResponse(BaseModel):
    dataset: str = "demo"
    nodes: list[Node]
    edges: list[Edge]
    metrics: GraphMetrics
    metadata: Dict[str, Union[str, int, float]] = Field(default_factory=dict)
