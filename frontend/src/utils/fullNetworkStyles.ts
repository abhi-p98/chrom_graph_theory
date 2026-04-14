export type CytoscapeStyleEntry = {
  selector: string;
  style: Record<string, string | number>;
};

export function getFullNetworkStylesheet(): CytoscapeStyleEntry[] {
  return [
    {
      selector: "node",
      style: {
        label: "",
        "background-color": "data(color)",
        color: "#e2e8f0",
        "font-size": 9,
        "text-outline-color": "#0f172a",
        "text-outline-width": 2,
        width: "data(size)",
        height: "data(size)",
        "border-width": 1,
        "border-color": "#94a3b8",
        opacity: "mapData(dimmed, 0, 1, 1, 0.12)",
      },
    },
    {
      selector: "node[selected = 1]",
      style: {
        "border-color": "#f8fafc",
        "border-width": 5,
        opacity: 1,
      },
    },
    {
      selector: "node[hovered = 1]",
      style: {
        "border-color": "#f59e0b",
        "border-width": 6,
        opacity: 1,
      },
    },
    {
      selector: "node[neighborFocus = 1]",
      style: {
        "border-color": "#38bdf8",
        "border-width": 4,
        opacity: 1,
      },
    },
    {
      selector: "node[pathNode = 1]",
      style: {
        "border-color": "#f97316",
        "border-width": 6,
        opacity: 1,
      },
    },
    {
      selector: "edge",
      style: {
        width: "data(strokeWidth)",
        "line-color": "#64748b",
        "curve-style": "bezier",
        label: "data(edgeLabel)",
        color: "#94a3b8",
        "font-size": 7,
        "text-background-color": "#0b1220",
        "text-background-opacity": 0.6,
        "text-background-padding": 2,
        opacity: "mapData(dimmed, 0, 1, 0.55, 0.05)",
      },
    },
    {
      selector: "edge[neighborFocus = 1]",
      style: {
        opacity: 0.9,
      },
    },
    {
      selector: "edge[pathEdge = 1]",
      style: {
        "line-color": "#f97316",
        width: 5,
        opacity: 1,
      },
    },
  ];
}
