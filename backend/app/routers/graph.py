from __future__ import annotations

from fastapi import APIRouter
from typing import Optional

from app.models.schemas import GraphResponse
from app.services.graph_service import GraphService

router = APIRouter(prefix="/graph", tags=["graph"])
service = GraphService()


@router.get("/current", response_model=GraphResponse)
def get_current_graph(chromosome: Optional[str] = None) -> GraphResponse:
    return service.build_graph_from_files(chromosome=chromosome)


@router.get("/chromosomes", response_model=list[str])
def get_available_chromosomes() -> list[str]:
    return service.list_available_chromosomes()


@router.get("/demo", response_model=GraphResponse)
def get_demo_graph(chromosome: Optional[str] = None) -> GraphResponse:
    return service.build_graph_from_files(chromosome=chromosome)
