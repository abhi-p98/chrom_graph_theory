import { useEffect, useMemo, useState } from "react";
import { graphApi } from "../services/api";
import type { CytoscapeElement, GraphArtifactResponse } from "../types/graph";

export function useGraphData() {
  const [graph, setGraph] = useState<GraphArtifactResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChromosome, setSelectedChromosome] = useState<string>("chr2");

  async function loadGraph(chromosome?: string) {
    setLoading(true);
    setError(null);
    try {
      const requestedChromosome = chromosome ?? selectedChromosome;
      const result = await graphApi.getGraph(requestedChromosome);
      setGraph(result);
      const resolvedChromosome = String(result.meta?.chromosome ?? requestedChromosome);
      setSelectedChromosome(resolvedChromosome);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load graph";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGraph(selectedChromosome);
  }, []);

  const elements = useMemo<CytoscapeElement[]>(() => {
    if (!graph) {
      return [];
    }

    const nodeElements: CytoscapeElement[] = graph.nodes.map((node) => ({
      data: {
        id: node.data.id,
        label: node.data.label,
      },
    }));

    const edgeElements: CytoscapeElement[] = graph.edges.map((edge) => ({
      data: {
        id: edge.data.id,
        source: edge.data.source,
        target: edge.data.target,
        weight: edge.data.weight,
      },
    }));

    return [...nodeElements, ...edgeElements];
  }, [graph]);

  return {
    graph,
    elements,
    loading,
    error,
  chromosomes: [selectedChromosome],
    selectedChromosome,
    setSelectedChromosome,
    reload: loadGraph,
  };
}
