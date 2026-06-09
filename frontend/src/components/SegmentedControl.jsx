export default function SegmentedControl({ value, onChange, options = [], className = "" }) {
  return (
    <div className={`segmented-control ${className}`.trim()} role="tablist" aria-label="Choix">
      {options.map((option) => {
        const active = String(option.value) === String(value);
        return (
          <button
            key={String(option.value)}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented-control__item ${active ? "is-active" : ""}`}
            onClick={() => onChange?.(option.value)}
          >
            {option.icon ? <span className="segmented-control__icon">{option.icon}</span> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
