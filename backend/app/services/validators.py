from __future__ import annotations

import re
from typing import Iterable, Optional, Sequence, Tuple

import pandas as pd


class DataValidationError(ValueError):
    """Raised when required input schema or values are invalid."""


def normalize_column_name(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", str(name).strip().lower())
    return normalized.strip("_")


def normalize_columns(dataframe: pd.DataFrame) -> pd.DataFrame:
    dataframe = dataframe.copy()
    dataframe.columns = [normalize_column_name(col) for col in dataframe.columns]
    return dataframe


def first_present_column(columns: Sequence[str], aliases: Iterable[str]) -> Optional[str]:
    alias_set = {normalize_column_name(alias) for alias in aliases}
    for column in columns:
        if normalize_column_name(column) in alias_set:
            return column
    return None


def require_column(
    dataframe: pd.DataFrame,
    aliases: Iterable[str],
    logical_name: str,
) -> str:
    matched = first_present_column(list(dataframe.columns), aliases)
    if matched is None:
        raise DataValidationError(
            f"Missing required column for '{logical_name}'. "
            f"Expected one of: {sorted({normalize_column_name(a) for a in aliases})}. "
            f"Found columns: {list(dataframe.columns)}"
        )
    return matched


def normalize_chromosome_label(value: object) -> str:
    text = str(value).strip().lower().replace(" ", "")
    if not text:
        return ""
    if text.startswith("chr"):
        suffix = text[3:]
    else:
        suffix = text
    return f"chr{suffix}"


def filter_by_chromosome(
    dataframe: pd.DataFrame,
    chromosome_col: str,
    target_chromosome: str,
) -> pd.DataFrame:
    dataframe = dataframe.copy()
    normalized_target = normalize_chromosome_label(target_chromosome)
    dataframe[chromosome_col] = dataframe[chromosome_col].map(normalize_chromosome_label)
    return dataframe[dataframe[chromosome_col] == normalized_target].copy()


def to_integer_series(series: pd.Series, column_name: str) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    return numeric.astype("Int64")


def to_float_series(series: pd.Series, column_name: str) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def get_position_range(dataframe: pd.DataFrame, first_col: str, second_col: str) -> Tuple[int, int]:
    min_position = int(min(dataframe[first_col].min(), dataframe[second_col].min()))
    max_position = int(max(dataframe[first_col].max(), dataframe[second_col].max()))
    return min_position, max_position
