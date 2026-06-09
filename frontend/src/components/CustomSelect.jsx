import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Choisir",
  className = "",
  disabled = false,
  compact = false
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)) || null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return undefined;
    function handlePointer(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`ui-select ${compact ? "ui-select-compact" : ""} ${open ? "is-open" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        className="ui-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`ui-select__value ${selectedOption ? "" : "is-placeholder"}`.trim()}>
          {selectedOption?.icon ? <span className="ui-select__icon">{selectedOption.icon}</span> : null}
          <span>{selectedOption?.label || placeholder}</span>
        </span>
        <span className="ui-select__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="ui-select__menu" id={listboxId} role="listbox">
          {options.map((option) => {
            const active = String(option.value) === String(value);
            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={active}
                className={`ui-select__option ${active ? "is-selected" : ""}`}
                onClick={() => {
                  onChange?.(option.value);
                  setOpen(false);
                }}
              >
                <span className="ui-select__option-main">
                  {option.icon ? <span className="ui-select__icon">{option.icon}</span> : null}
                  <span>{option.label}</span>
                </span>
                {option.description ? <small>{option.description}</small> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
