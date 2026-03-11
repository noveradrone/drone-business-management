export default function DataRowList({
  items = [],
  getKey = (item, index) => item?.id ?? index,
  emptyMessage = "Aucune donnee.",
  renderTitle,
  renderSubtitle,
  renderDetails,
  renderMeta,
  renderActions,
  className = ""
}) {
  if (!items.length) {
    return <p className="data-row-empty">{emptyMessage}</p>;
  }

  return (
    <div className={`data-row-list ${className}`.trim()}>
      {items.map((item, index) => (
        <article key={getKey(item, index)} className="data-row-card">
          <div className="data-row-main">
            <h3 className="data-row-title">{renderTitle ? renderTitle(item, index) : "-"}</h3>
            {renderSubtitle ? <p className="data-row-subtitle">{renderSubtitle(item, index)}</p> : null}
          </div>
          <div className="data-row-secondary">
            {renderDetails ? renderDetails(item, index) : null}
            {renderMeta ? <div className="data-row-meta">{renderMeta(item, index)}</div> : null}
          </div>
          <div className="data-row-actions">{renderActions ? renderActions(item, index) : null}</div>
        </article>
      ))}
    </div>
  );
}
