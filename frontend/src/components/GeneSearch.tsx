import { useMemo } from "react";

type GeneSearchProps = {
  query: string;
  suggestions: string[];
  loading: boolean;
  onQueryChange: (query: string) => void;
  onSelectGene: (gene: string) => void;
  onSearch: (selectedGene?: string) => void | Promise<string | null>;
  onOpenInLocalView?: (selectedGene?: string) => void | Promise<string | null>;
};

export function GeneSearch({
  query,
  suggestions,
  loading,
  onQueryChange,
  onSelectGene,
  onSearch,
  onOpenInLocalView,
}: GeneSearchProps) {
  const visibleSuggestions = useMemo(() => suggestions.slice(0, 10), [suggestions]);

  return (
    <div className="gene-search">
      <label htmlFor="gene-search-input">Gene search</label>
      <input
        id="gene-search-input"
        placeholder="Type gene symbol (e.g. MYT1L)"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />

      <button onClick={() => onSearch()} disabled={loading || !query.trim()}>
        {loading ? "Searching..." : "Find gene node"}
      </button>

      {onOpenInLocalView ? (
        <button
          type="button"
          onClick={() => onOpenInLocalView()}
          disabled={loading || !query.trim()}
          style={{ marginTop: "0.45rem" }}
        >
          Open in Local View
        </button>
      ) : null}

      {visibleSuggestions.length > 0 ? (
        <ul className="gene-suggestion-list">
          {visibleSuggestions.map((gene) => (
            <li key={gene}>
              <button
                type="button"
                className="gene-suggestion-item"
                onClick={() => {
                  onSelectGene(gene);
                  onSearch(gene);
                }}
              >
                {gene}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Start typing to see matching genes.</p>
      )}
    </div>
  );
}
