import type { VisualizationTab } from "../../types/visualization";
import { CommunitySummaryView } from "./CommunitySummaryView";
import { FullNetworkView } from "./FullNetworkView";
import { GenomeArcView } from "./GenomeArcView";
import { LocalGraphView } from "./LocalGraphView";

type VisualizationViewportProps = {
  activeTab: VisualizationTab;
};

export function VisualizationViewport({ activeTab }: VisualizationViewportProps) {
  const content =
    activeTab === "genome-arc" ? (
      <GenomeArcView />
    ) : activeTab === "community-summary" ? (
      <CommunitySummaryView />
    ) : activeTab === "local-graph" ? (
      <LocalGraphView />
    ) : (
      <FullNetworkView />
    );

  return (
    <div key={activeTab} className="viz-tab-content" data-tab={activeTab}>
      {content}
    </div>
  );
}
