export type CytoscapeStyleEntry = {
  selector: string;
  style: Record<string, string | number>;
};

export function getCommunitySummaryStylesheet(): CytoscapeStyleEntry[] {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "background-color": "data(color)",
        width: "data(size)",
        height: "data(size)",
        color: "#f8fafc",
        "font-size": 11,
        "font-weight": 700,
        "text-valign": "center",
        "text-halign": "center",
        "text-outline-color": "#0f172a",
        "text-outline-width": 3,
        "border-width": 2,
        "border-color": "#94a3b8",
      },
    },
    {
      selector: "node[selected = 1]",
      style: {
        "border-width": 5,
        "border-color": "#f8fafc",
      },
    },
    {
      selector: "node[pathNode = 1]",
      style: {
        "border-width": 5,
        "border-color": "#f97316",
      },
    },
    {
      selector: "edge",
      style: {
        width: "data(width)",
        label: "data(label)",
        "font-size": 8,
        color: "#cbd5e1",
        "text-background-color": "#0b1220",
        "text-background-opacity": 0.8,
        "text-background-padding": 2,
        "curve-style": "bezier",
        "line-color": "#64748b",
        "target-arrow-shape": "none",
        opacity: 0.78,
      },
    },
    {
      selector: "edge[pathEdge = 1]",
      style: {
        "line-color": "#f97316",
        opacity: 1,
        width: 7,
      },
    },
  ];
}
