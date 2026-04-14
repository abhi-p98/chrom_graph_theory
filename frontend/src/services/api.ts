import axios from "axios";
import type {
  CommunitySummary,
  GeneLookupResponse,
  GraphArtifactResponse,
  NodeDetailResponse,
  ShortestPathResponse,
} from "../types/graph";

const apiClient = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
  timeout: 15000,
});

export const graphApi = {
  async getGraph(chromosome?: string): Promise<GraphArtifactResponse> {
    const { data } = await apiClient.get<GraphArtifactResponse>("/graph", {
      params: chromosome ? { chromosome } : undefined,
    });
    return data;
  },

  async getCommunities(chromosome?: string): Promise<CommunitySummary[]> {
    const { data } = await apiClient.get<CommunitySummary[]>("/communities", {
      params: chromosome ? { chromosome } : undefined,
    });
    return data;
  },

  async getGenes(params: {
    chromosome?: string;
    q?: string;
    limit?: number;
  }): Promise<GeneLookupResponse> {
    const { data } = await apiClient.get<GeneLookupResponse>("/genes", { params });
    return data;
  },

  async getNode(nodeId: string, chromosome?: string): Promise<NodeDetailResponse> {
    const { data } = await apiClient.get<NodeDetailResponse>(`/node/${encodeURIComponent(nodeId)}`, {
      params: chromosome ? { chromosome } : undefined,
    });
    return data;
  },

  async getShortestPath(params: {
    gene1: string;
    gene2: string;
    chromosome?: string;
  }): Promise<ShortestPathResponse> {
    const { data } = await apiClient.get<ShortestPathResponse>("/shortest-path", { params });
    return data;
  },

  async getHealth(): Promise<{ status: string }> {
    const { data } = await apiClient.get<{ status: string }>("/health");
    return data;
  },
};

export function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (detail && typeof detail === "object" && "message" in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string") {
        return message;
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while talking to backend API.";
}
