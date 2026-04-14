import type { VisualizationTab } from "../../types/visualization";

const TAB_OPTIONS: Array<{ id: VisualizationTab; label: string }> = [
  { id: "full-network", label: "Full Network" },
  { id: "genome-arc", label: "Genome Arc View" },
  { id: "community-summary", label: "Community Summary View" },
  { id: "local-graph", label: "Local Graph View" },
];

type VisualizationTabSelectorProps = {
  activeTab: VisualizationTab;
  onChange: (tab: VisualizationTab) => void;
};

export function VisualizationTabSelector({ activeTab, onChange }: VisualizationTabSelectorProps) {
  return (
    <div className="viz-tab-selector" role="tablist" aria-label="Visualization modes">
      {TAB_OPTIONS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={`viz-tab-button${activeTab === tab.id ? " is-active" : ""}`}
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
