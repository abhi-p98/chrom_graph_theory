from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import pandas as pd

from app.services.validators import (
    DataValidationError,
    filter_by_chromosome,
    normalize_columns,
    require_column,
    to_float_series,
    to_integer_series,
)


@dataclass
class GeneLoadResult:
    dataframe: pd.DataFrame
    summary: Dict[str, int]


class GeneLoader:
    def __init__(self, target_chromosome: str, logger: Optional[logging.Logger] = None) -> None:
        self.target_chromosome = target_chromosome
        self.logger = logger or logging.getLogger(__name__)

    def load(self, file_path: Path) -> GeneLoadResult:
        if not file_path.exists():
            raise FileNotFoundError(f"Gene file not found: {file_path}")

        dataframe = pd.read_csv(file_path, sep="\t", engine="python")
        dataframe = normalize_columns(dataframe)

        mapping = self._resolve_columns(dataframe)

        cleaned = pd.DataFrame(
            {
                "chromosome": dataframe[mapping["chromosome"]],
                "gene_name": dataframe[mapping["gene_name"]],
                "gene_start": dataframe[mapping["gene_start"]],
                "gene_end": dataframe[mapping["gene_end"]],
            }
        )

        if mapping.get("expression"):
            cleaned["expression"] = to_float_series(dataframe[mapping["expression"]], "expression")

        cleaned = filter_by_chromosome(cleaned, "chromosome", self.target_chromosome)

        cleaned["gene_start"] = to_integer_series(cleaned["gene_start"], "gene_start")
        cleaned["gene_end"] = to_integer_series(cleaned["gene_end"], "gene_end")

        cleaned = cleaned.dropna(subset=["gene_name", "gene_start", "gene_end"])
        cleaned = cleaned[(cleaned["gene_start"] >= 0) & (cleaned["gene_end"] >= cleaned["gene_start"])]
        cleaned["gene_name"] = cleaned["gene_name"].astype(str).str.strip()
        cleaned = cleaned[cleaned["gene_name"] != ""]

        cleaned["gene_start"] = cleaned["gene_start"].astype(int)
        cleaned["gene_end"] = cleaned["gene_end"].astype(int)
        cleaned = cleaned.sort_values(["gene_start", "gene_end"]).reset_index(drop=True)

        if cleaned.empty:
            raise DataValidationError(
                f"No valid gene rows left after cleaning for chromosome '{self.target_chromosome}'."
            )

        summary = {
            "gene_count": int(len(cleaned)),
            "gene_position_min": int(cleaned["gene_start"].min()),
            "gene_position_max": int(cleaned["gene_end"].max()),
        }

        self.logger.info(
            "Gene ingest summary | chromosome=%s genes=%d pos_range=%d-%d",
            self.target_chromosome,
            summary["gene_count"],
            summary["gene_position_min"],
            summary["gene_position_max"],
        )

        return GeneLoadResult(dataframe=cleaned, summary=summary)

    def _resolve_columns(self, dataframe: pd.DataFrame) -> Dict[str, str]:
        column_map: Dict[str, str] = {}

        column_map["chromosome"] = require_column(
            dataframe,
            aliases=("chromosome", "chrom", "chr"),
            logical_name="chromosome",
        )

        gene_name_col = None
        for aliases in (("gene_name", "gene", "symbol"), ("gene_id", "id")):
            try:
                gene_name_col = require_column(dataframe, aliases=aliases, logical_name="gene_name")
                break
            except DataValidationError:
                continue
        if gene_name_col is None:
            raise DataValidationError(
                "Missing required gene name column. Expected one of: gene_name, gene, symbol, gene_id"
            )
        column_map["gene_name"] = gene_name_col

        has_tss = any(column in dataframe.columns for column in ["tss", "transcription_start_site"])
        if has_tss:
            tss_col = require_column(
                dataframe,
                aliases=("tss", "transcription_start_site"),
                logical_name="tss",
            )
            column_map["gene_start"] = tss_col
            column_map["gene_end"] = tss_col
        else:
            column_map["gene_start"] = require_column(
                dataframe,
                aliases=("gene_start", "start", "tx_start"),
                logical_name="gene_start",
            )
            column_map["gene_end"] = require_column(
                dataframe,
                aliases=("gene_end", "end", "tx_end"),
                logical_name="gene_end",
            )

        expression_col = None
        for aliases in (
            ("gene_expr_log2_mean", "expression", "expr", "log2_expression"),
            ("bin_expr_log2_mean",),
        ):
            try:
                expression_col = require_column(dataframe, aliases=aliases, logical_name="expression")
                break
            except DataValidationError:
                continue

        if expression_col is not None:
            column_map["expression"] = expression_col

        return column_map
