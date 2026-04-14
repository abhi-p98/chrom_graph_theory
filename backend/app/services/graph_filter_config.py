from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class GraphFilterConfig:
    """Filtering controls for web-friendly Hi-C graph visualization."""

    min_weight_threshold: float = 10_000.0
    top_percent_strongest_edges: float = 1.0
    top_k_neighbors_per_node: int = 8
    remove_near_diagonal_bins: Optional[int] = 1
    keep_only_positive_enrichment: bool = True
    distance_epsilon: float = 1e-6


DEFAULT_WEB_FILTER_CONFIG = GraphFilterConfig()
