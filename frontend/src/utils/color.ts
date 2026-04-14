import type { CentralityMetric, GraphNodeData } from "../types";

const CENTRALITY_GRADIENT_STOPS = ["#1e3a8a", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444"];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (channel: number) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateHexColor(startHex: string, endHex: string, t: number): string {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  return rgbToHex(
    start.r + (end.r - start.r) * t,
    start.g + (end.g - start.g) * t,
    start.b + (end.b - start.b) * t,
  );
}

export function getCentralityColor(normalizedValue: number): string {
  const value = clamp01(normalizedValue);
  const lastStopIndex = CENTRALITY_GRADIENT_STOPS.length - 1;
  const scaled = value * lastStopIndex;
  const leftIndex = Math.floor(scaled);
  const rightIndex = Math.min(leftIndex + 1, lastStopIndex);
  const t = scaled - leftIndex;
  return interpolateHexColor(CENTRALITY_GRADIENT_STOPS[leftIndex], CENTRALITY_GRADIENT_STOPS[rightIndex], t);
}

export function getCentralityMetricValue(node: GraphNodeData, metric: CentralityMetric): number {
  if (metric === "degree") {
    return node.degree_norm;
  }
  if (metric === "betweenness") {
    return node.betweenness_norm;
  }
  return node.closeness_norm;
}

export function getCommunityColor(communityId: number): string {
  const hue = (communityId * 47) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

export function getCentralityGradientCss(): string {
  return `linear-gradient(90deg, ${CENTRALITY_GRADIENT_STOPS.join(", ")})`;
}
