from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple


@dataclass(frozen=True)
class Settings:
    app_name: str = "Chromosome Hi-C Graph Explorer API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    cors_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")
    target_chromosome: str = "chr2"
    remove_self_loops: bool = True
    bin_size: int = 1_000_000
    data_dir: Path = Path("backend/data")
    outputs_dir: Path = Path("backend/outputs")
    hic_file_path: Path = Path("backend/data/hic_data/chr2_1mb.txt")
    gene_file_path: Path = Path("backend/data/GM12878_gene_expression.tsv")



def _parse_cors_origins(raw: Optional[str]) -> Tuple[str, ...]:
    if not raw:
        return ("http://localhost:5173", "http://127.0.0.1:5173")

    origins = tuple(origin.strip() for origin in raw.split(",") if origin.strip())
    return origins or ("http://localhost:5173", "http://127.0.0.1:5173")


def _parse_bool(raw: Optional[str], default: bool) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = BACKEND_ROOT / "data"
DEFAULT_OUTPUTS_DIR = BACKEND_ROOT / "outputs"
DEFAULT_HIC_FILE = DEFAULT_DATA_DIR / "hic_data" / "chr2_1mb.txt"
DEFAULT_GENE_FILE = DEFAULT_DATA_DIR / "GM12878_gene_expression.tsv"


settings = Settings(
    app_name=os.getenv("APP_NAME", "Chromosome Hi-C Graph Explorer API"),
    app_version=os.getenv("APP_VERSION", "0.1.0"),
    api_prefix=os.getenv("API_PREFIX", "/api"),
    backend_host=os.getenv("BACKEND_HOST", "127.0.0.1"),
    backend_port=int(os.getenv("BACKEND_PORT", "8000")),
    cors_origins=_parse_cors_origins(os.getenv("CORS_ORIGINS")),
    target_chromosome=os.getenv("TARGET_CHROMOSOME", "chr2"),
    remove_self_loops=_parse_bool(os.getenv("REMOVE_SELF_LOOPS"), True),
    bin_size=int(os.getenv("BIN_SIZE", "1000000")),
    data_dir=Path(os.getenv("DATA_DIR", str(DEFAULT_DATA_DIR))),
    outputs_dir=Path(os.getenv("OUTPUTS_DIR", str(DEFAULT_OUTPUTS_DIR))),
    hic_file_path=Path(os.getenv("HIC_FILE_PATH", str(DEFAULT_HIC_FILE))),
    gene_file_path=Path(os.getenv("GENE_FILE_PATH", str(DEFAULT_GENE_FILE))),
)
