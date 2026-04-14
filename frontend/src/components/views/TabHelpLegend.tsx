type LegendItem = {
  label: string;
  value: string;
};

type TabHelpLegendProps = {
  summary: string;
  items: LegendItem[];
};

export function TabHelpLegend({ summary, items }: TabHelpLegendProps) {
  return (
    <div className="tab-help-legend" role="note" aria-label="Visualization help">
      <p className="tab-help-summary">{summary}</p>
      <div className="tab-help-items">
        {items.map((item) => (
          <div key={item.label} className="tab-help-item">
            <span className="tab-help-label">{item.label}</span>
            <span className="tab-help-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
