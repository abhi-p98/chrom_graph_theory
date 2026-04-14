from pathlib import Path

import pandas as pd

from app.services.gene_mapping import GeneMappingService


def test_gene_mapping_rules_and_duplicate_safe_lookup(tmp_path: Path) -> None:
    gene_df = pd.DataFrame(
        {
            "chromosome": ["chr2", "chr2", "chr2", "chr3"],
            "gene_name": ["GENE1", "GENE1", "GENE2", "OTHER"],
            "gene_start": [100, 1_500_000, 1_600_000, 10],
            "expression": [1.0, 2.0, 3.0, 9.9],
        }
    )

    service = GeneMappingService()
    result = service.build_mappings(gene_df=gene_df, target_chromosome="chr2", bin_size=1_000_000)

    assert result.mapped_genes == 3
    assert result.bins_with_genes == 2
    assert result.unmapped_genes == 0

    # floor(start/1Mb)*1Mb rule
    assert result.gene_to_bin["GENE1"]["bin_start"] == 0
    assert result.gene_to_bin["GENE1"]["bin_end"] == 999_999

    # duplicate gene names kept safely in gene_to_bin and aggregated in lookup
    assert "GENE1#2" in result.gene_to_bin
    assert len(result.gene_lookup["GENE1"]) == 2

    # bin to genes mapping
    assert "chr2:1000000-2000000" in result.bin_to_genes
    assert sorted(result.bin_to_genes["chr2:1000000-2000000"]) == ["GENE1", "GENE2"]

    g2b = tmp_path / "gene_to_bin.json"
    b2g = tmp_path / "bin_to_genes.json"
    lookup = tmp_path / "gene_lookup.json"
    service.save_mappings_json(result, g2b, b2g, lookup)

    assert g2b.exists()
    assert b2g.exists()
    assert lookup.exists()
