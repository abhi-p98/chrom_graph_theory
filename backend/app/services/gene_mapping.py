from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Mapping, Optional

import pandas as pd


@dataclass(frozen=True)
class GeneMappingResult:
    gene_to_bin: Dict[str, Dict[str, object]]
    bin_to_genes: Dict[str, List[str]]
    gene_lookup: Dict[str, List[str]]
    bin_expression: Dict[str, Optional[float]]
    mapped_genes: int
    unmapped_genes: int
    bins_with_genes: int


class GeneMappingService:
    def build_mappings(
        self,
        gene_df: pd.DataFrame,
        target_chromosome: str,
        bin_size: int,
    ) -> GeneMappingResult:
        dataframe = gene_df.copy()
        dataframe["chromosome"] = dataframe["chromosome"].astype(str).str.lower()

        normalized_target = target_chromosome.lower()
        filtered = dataframe[dataframe["chromosome"] == normalized_target].copy()

        if filtered.empty:
            return GeneMappingResult(
                gene_to_bin={},
                bin_to_genes={},
                gene_lookup={},
                bin_expression={},
                mapped_genes=0,
                unmapped_genes=0,
                bins_with_genes=0,
            )

        filtered["gene_name"] = filtered["gene_name"].astype(str).str.strip()
        filtered = filtered[filtered["gene_name"] != ""]

        filtered["gene_start"] = pd.to_numeric(filtered["gene_start"], errors="coerce")
        filtered = filtered.dropna(subset=["gene_start"])
        filtered = filtered[filtered["gene_start"] >= 0]
        filtered["gene_start"] = filtered["gene_start"].astype(int)

        filtered["bin_start"] = (filtered["gene_start"] // bin_size) * bin_size
        filtered["bin_end"] = filtered["bin_start"] + bin_size - 1
        filtered["bin_id"] = filtered.apply(
            lambda row: f"{normalized_target}:{int(row['bin_start'])}-{int(row['bin_start']) + bin_size}",
            axis=1,
        )

        gene_to_bin: Dict[str, Dict[str, object]] = {}
        for _, row in filtered.iterrows():
            unique_gene_key = self._make_unique_gene_key(str(row["gene_name"]), gene_to_bin)
            gene_to_bin[unique_gene_key] = {
                "gene_name": str(row["gene_name"]),
                "chromosome": normalized_target,
                "gene_start": int(row["gene_start"]),
                "bin_start": int(row["bin_start"]),
                "bin_end": int(row["bin_end"]),
                "bin_id": str(row["bin_id"]),
            }

        grouped = filtered.groupby("bin_id")["gene_name"].apply(list)
        bin_to_genes = {str(bin_id): sorted(gene_names) for bin_id, gene_names in grouped.items()}

        gene_lookup: Dict[str, List[str]] = {}
        for _, row in filtered.iterrows():
            gene_name = str(row["gene_name"])
            gene_lookup.setdefault(gene_name, [])
            bin_id = str(row["bin_id"])
            if bin_id not in gene_lookup[gene_name]:
                gene_lookup[gene_name].append(bin_id)

        for gene_name in gene_lookup:
            gene_lookup[gene_name] = sorted(gene_lookup[gene_name])

        if "expression" in filtered.columns:
            expression_grouped = filtered.groupby("bin_id", as_index=False).agg(expression=("expression", "mean"))
            bin_expression = {
                str(row["bin_id"]): float(row["expression"]) if row["expression"] == row["expression"] else None
                for _, row in expression_grouped.iterrows()
            }
        else:
            bin_expression = {str(bin_id): None for bin_id in bin_to_genes.keys()}

        mapped_genes = int(len(filtered))
        unmapped_genes = int(len(dataframe[dataframe["chromosome"] == normalized_target]) - mapped_genes)
        bins_with_genes = int(len(bin_to_genes))

        return GeneMappingResult(
            gene_to_bin=gene_to_bin,
            bin_to_genes=bin_to_genes,
            gene_lookup=gene_lookup,
            bin_expression=bin_expression,
            mapped_genes=mapped_genes,
            unmapped_genes=max(unmapped_genes, 0),
            bins_with_genes=bins_with_genes,
        )

    def save_mappings_json(
        self,
        mapping_result: GeneMappingResult,
        gene_to_bin_path: Path,
        bin_to_genes_path: Path,
        gene_lookup_path: Path,
    ) -> None:
        for target in (gene_to_bin_path, bin_to_genes_path, gene_lookup_path):
            target.parent.mkdir(parents=True, exist_ok=True)

        with gene_to_bin_path.open("w", encoding="utf-8") as handle:
            json.dump(mapping_result.gene_to_bin, handle, indent=2)

        with bin_to_genes_path.open("w", encoding="utf-8") as handle:
            json.dump(mapping_result.bin_to_genes, handle, indent=2)

        with gene_lookup_path.open("w", encoding="utf-8") as handle:
            json.dump(mapping_result.gene_lookup, handle, indent=2)

    @staticmethod
    def _make_unique_gene_key(gene_name: str, current: Mapping[str, object]) -> str:
        if gene_name not in current:
            return gene_name

        suffix = 2
        while f"{gene_name}#{suffix}" in current:
            suffix += 1
        return f"{gene_name}#{suffix}"
