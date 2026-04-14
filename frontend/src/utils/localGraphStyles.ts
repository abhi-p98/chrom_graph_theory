export type CytoscapeStyleEntry = {
  selector: string;
  style: Record<string, string | number>;
};

export function getLocalGraphStylesheet(): CytoscapeStyleEntry[] {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "background-color": "data(color)",
        width: "data(size)",
        height: "data(size)",
        color: "#e2e8f0",
        "font-size": 9,
        "text-wrap": "ellipsis",
        "text-max-width": 90,
        "text-outline-color": "#0f172a",
        "text-outline-width": 2,
        "border-width": 1,
        "border-color": "#94a3b8",
        opacity: "mapData(dimmed, 0, 1, 1, 0.14)",
      },
    },
    {
      selector: "node[center = 1]",
      style: {
        "border-width": 7,
        "border-color": "#f8fafc",
        "font-size": 11,
        "font-weight": 700,
        opacity: 1,
      },
    },
    {
      selector: "node[selected = 1]",
      style: {
        "border-width": 5,
        "border-color": "#38bdf8",
        opacity: 1,
      },
    },
    {
      selector: "node[pathNode = 1]",
      style: {
        "border-width": 5,
        "border-color": "#f97316",
        opacity: 1,
      },
    },
    {
      selector: "edge",
      style: {
        width: "data(strokeWidth)",
        "line-color": "#64748b",
        "curve-style": "bezier",
        opacity: 0.78,
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
