from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ContactRecord:
    source: str
    target: str
    weight: float


@dataclass(frozen=True)
class GeneRecord:
    node_id: str
    gene_symbol: str
    expression: float


class DataLoader:
    """Loads Hi-C and expression data.

    For initial scaffolding we return deterministic demo records so the whole stack
    is runnable before wiring large datasets.
    """

    def load_contact_records(self) -> list[ContactRecord]:
        return [
            ContactRecord("chr1:0-1Mb", "chr1:1-2Mb", 0.82),
            ContactRecord("chr1:1-2Mb", "chr1:2-3Mb", 0.76),
            ContactRecord("chr1:0-1Mb", "chr1:2-3Mb", 0.31),
            ContactRecord("chr1:2-3Mb", "chr1:3-4Mb", 0.44),
            ContactRecord("chr1:1-2Mb", "chr1:3-4Mb", 0.27),
        ]

    def load_gene_records(self) -> list[GeneRecord]:
        return [
            GeneRecord("chr1:0-1Mb", "GENE_A", 5.4),
            GeneRecord("chr1:1-2Mb", "GENE_B", 3.1),
            GeneRecord("chr1:2-3Mb", "GENE_C", 8.2),
            GeneRecord("chr1:3-4Mb", "GENE_D", 2.7),
        ]
