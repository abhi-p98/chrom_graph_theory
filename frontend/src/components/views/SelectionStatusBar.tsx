type SelectionStatusBarProps = {
  selectedNodeId: string | null;
  selectedGene: string | null;
  selectedCommunityId: number | null;
  hasShortestPath: boolean;
  onResetHighlights: () => void;
};

export function SelectionStatusBar({
  selectedNodeId,
  selectedGene,
  selectedCommunityId,
  hasShortestPath,
  onResetHighlights,
}: SelectionStatusBarProps) {
  return (
    <div className="selection-status-bar" role="status" aria-live="polite">
      <div className="selection-status-chips">
        <span className={`selection-chip${selectedNodeId ? " is-active" : ""}`}>
          Node: {selectedNodeId ?? "none"}
        </span>
        <span className={`selection-chip${selectedGene ? " is-active" : ""}`}>
          Gene: {selectedGene ?? "none"}
        </span>
        <span className={`selection-chip${selectedCommunityId !== null ? " is-active" : ""}`}>
          Community: {selectedCommunityId === null ? "none" : `#${selectedCommunityId}`}
        </span>
        <span className={`selection-chip${hasShortestPath ? " is-active" : ""}`}>
          Path: {hasShortestPath ? "active" : "none"}
        </span>
      </div>
      <button type="button" className="selection-reset-btn" onClick={onResetHighlights}>
        Reset highlights
      </button>
    </div>
  );
}
