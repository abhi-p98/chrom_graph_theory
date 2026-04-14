from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import pandas as pd

from app.services.validators import (
    DataValidationError,
    filter_by_chromosome,
    get_position_range,
    normalize_columns,
    require_column,
    to_float_series,
    to_integer_series,
)


@dataclass
class HicLoadResult:
    dataframe: pd.DataFrame
    summary: Dict[str, int]


class HicLoader:
    def __init__(
        self,
        target_chromosome: str,
        remove_self_loops: bool = False,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self.target_chromosome = target_chromosome
        self.remove_self_loops = remove_self_loops
        self.logger = logger or logging.getLogger(__name__)

    def load(self, file_path: Path) -> HicLoadResult:
        if not file_path.exists():
            raise FileNotFoundError(f"Hi-C file not found: {file_path}")

        dataframe = self._read_raw(file_path)
        dataframe = normalize_columns(dataframe)

        mapping = self._resolve_columns(dataframe)

        cleaned = pd.DataFrame(
            {
                "chromosome": dataframe[mapping["chromosome"]],
                "bin1_start": dataframe[mapping["bin1_start"]],
                "bin2_start": dataframe[mapping["bin2_start"]],
                "contact_count": dataframe[mapping["contact_count"]],
            }
        )

        cleaned = filter_by_chromosome(cleaned, "chromosome", self.target_chromosome)

        cleaned["bin1_start"] = to_integer_series(cleaned["bin1_start"], "bin1_start")
        cleaned["bin2_start"] = to_integer_series(cleaned["bin2_start"], "bin2_start")
        cleaned["contact_count"] = to_float_series(cleaned["contact_count"], "contact_count")

        cleaned = cleaned.dropna(subset=["bin1_start", "bin2_start", "contact_count"])
        cleaned = cleaned[
            (cleaned["bin1_start"] >= 0)
            & (cleaned["bin2_start"] >= 0)
            & (cleaned["contact_count"] > 0)
        ]

        cleaned["bin1_start"] = cleaned["bin1_start"].astype(int)
        cleaned["bin2_start"] = cleaned["bin2_start"].astype(int)

        if self.remove_self_loops:
            cleaned = cleaned[cleaned["bin1_start"] != cleaned["bin2_start"]]

        cleaned = cleaned.sort_values(["bin1_start", "bin2_start"]).reset_index(drop=True)

        if cleaned.empty:
            raise DataValidationError(
                f"No valid Hi-C rows left after filtering/cleaning for chromosome '{self.target_chromosome}'."
            )

        unique_bins = pd.unique(pd.concat([cleaned["bin1_start"], cleaned["bin2_start"]]))
        min_pos, max_pos = get_position_range(cleaned, "bin1_start", "bin2_start")

        summary = {
            "hic_edges": int(len(cleaned)),
            "unique_bins": int(len(unique_bins)),
            "position_min": int(min_pos),
            "position_max": int(max_pos),
        }

        self.logger.info(
            "Hi-C ingest summary | chromosome=%s edges=%d unique_bins=%d pos_range=%d-%d self_loops_removed=%s",
            self.target_chromosome,
            summary["hic_edges"],
            summary["unique_bins"],
            summary["position_min"],
            summary["position_max"],
            self.remove_self_loops,
        )

        return HicLoadResult(dataframe=cleaned, summary=summary)

    def _read_raw(self, file_path: Path) -> pd.DataFrame:
        with file_path.open("r", encoding="utf-8") as handle:
            first_line = handle.readline().strip()

        has_header = any(character.isalpha() for character in first_line)

        dataframe = pd.read_csv(
            file_path,
            sep=r"\t+|\s+|,",
            engine="python",
            header=0 if has_header else None,
            comment="#",
        )

        if not has_header:
            if dataframe.shape[1] < 3:
                raise DataValidationError(
                    f"Expected at least 3 columns in Hi-C file without header, found {dataframe.shape[1]}"
                )
            column_names = ["bin1_start", "bin2_start", "contact_count"]
            if dataframe.shape[1] >= 4:
                column_names = ["chromosome", "bin1_start", "bin2_start", "contact_count"]
            dataframe = dataframe.iloc[:, : len(column_names)]
            dataframe.columns = column_names

        return dataframe

    def _resolve_columns(self, dataframe: pd.DataFrame) -> Dict[str, str]:
        column_map: Dict[str, str] = {}

        chromosome_col = require_column(
            dataframe,
            aliases=("chromosome", "chrom", "chr"),
            logical_name="chromosome",
        ) if any(col in dataframe.columns for col in ["chromosome", "chrom", "chr"]) else None

        if chromosome_col is None:
            dataframe["chromosome"] = self.target_chromosome
            chromosome_col = "chromosome"

        column_map["chromosome"] = chromosome_col
        column_map["bin1_start"] = require_column(
            dataframe,
            aliases=("bin1_start", "bin1", "start1", "x1", "start_bin1"),
            logical_name="bin1_start",
        )
        column_map["bin2_start"] = require_column(
            dataframe,
            aliases=("bin2_start", "bin2", "start2", "x2", "start_bin2"),
            logical_name="bin2_start",
        )
        column_map["contact_count"] = require_column(
            dataframe,
            aliases=("contact_count", "count", "contacts", "weight", "hic_count", "value"),
            logical_name="contact_count",
        )

        return column_map
