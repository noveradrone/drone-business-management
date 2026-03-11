export default function DataTable({ children, style, wrapClassName = "", tableClassName = "" }) {
  const wrapperClass = `table-wrap data-table-wrap ${wrapClassName}`.trim();
  const classes = `mobile-cards-table data-table ${tableClassName}`.trim();

  return (
    <div className={wrapperClass} style={style}>
      <table className={classes}>{children}</table>
    </div>
  );
}
